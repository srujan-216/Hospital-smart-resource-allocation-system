/**
 * Matching pipeline:
 *   1. Score every waiting request with the transparent formula.
 *   2. Build a cost matrix where cost[i][j] reflects the "badness"
 *      of assigning request i to resource j.
 *      - Lower cost = better match
 *      - INF = infeasible (domain mismatch, bad resource type, unavailable)
 *   3. Run Hungarian to find the globally optimal assignment.
 *   4. Return (request, resource, score, breakdown, why) tuples.
 *
 * Hungarian gives us the mathematically optimal matching across all pairs —
 * a critical patient isn't starved of ICU just because a routine case arrived first.
 */
import type { AppAllocation, AppRequest, AppResource } from "../types.js";
import { priorityScore, formatWhy } from "./scoring.js";
import { hungarian } from "./hungarian.js";
import { nanoid } from "nanoid";

const INF = 1e15;

function haversineKm(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const A = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
}

function preferenceAdjust(req: AppRequest, res: AppResource): number {
  let adj = 0;
  if (req.domain === "hospital") {
    const acuity = req.ai_extracted?.acuity_hint;
    const type = res.metadata?.type;
    if (acuity === "critical" && type !== "icu") adj += 200;         // strongly prefer ICU for critical
    if (acuity === "urgent" && type === "general") adj += 30;        // mild pref for step-down/oxygen
    if (acuity === "routine" && type === "icu") adj += 150;          // don't waste ICU on routine
  }
  if (req.domain === "ambulance") {
    const callerCity = req.city;
    // Seed ambulances have coords; callers don't — approximate via resource base name vs city
    // (real deployment would pass caller coords on submission)
    const anchor = res.location;
    const caller = { lat: res.location.lat, lng: res.location.lng };
    const d = haversineKm(anchor, caller); // symbolic — if both have coords
    if (d != null) adj += d * 0.5;
    // For seed data: simple string-match between resource base and caller city
    const resBase = (res.metadata?.base || res.name).toLowerCase();
    const callerArea = (req.requester_name || "").toLowerCase();
    if (callerArea.includes(resBase.split(" ")[0])) adj -= 10;        // same base → small bonus
  }
  return adj;
}

export function buildCostMatrix(requests: AppRequest[], resources: AppResource[]) {
  const n = requests.length;
  const m = resources.length;
  const cost: number[][] = Array.from({ length: n }, () => new Array(m).fill(INF));
  const meta: Array<Array<{ score: number; breakdown: any; matchedRules: string[]; rejectReason?: string }>> =
    Array.from({ length: n }, () => Array.from({ length: m }, () => ({ score: 0, breakdown: {}, matchedRules: [] as string[] })));

  for (let i = 0; i < n; i++) {
    const req = requests[i];
    const { score, breakdown, matchedRules } = priorityScore(req);
    const base = 1000 / Math.max(1, score);
    for (let j = 0; j < m; j++) {
      const res = resources[j];
      meta[i][j] = { score, breakdown, matchedRules };
      if (!res.available) { meta[i][j].rejectReason = "resource not available"; continue; }
      if (res.domain !== req.domain) { meta[i][j].rejectReason = "domain mismatch"; continue; }
      cost[i][j] = base + preferenceAdjust(req, res);
    }
  }
  return { cost, meta };
}

export interface MatchResult {
  request: AppRequest;
  resource: AppResource;
  score: number;
  breakdown: any;
  matchedRules: string[];
  why: string;
}

export function runHungarian(requests: AppRequest[], resources: AppResource[]): MatchResult[] {
  const openReqs = requests.filter(r => r.status === "waiting");
  const openRes = resources.filter(r => r.available);
  if (openReqs.length === 0 || openRes.length === 0) return [];

  // Sort requests by priority so the algorithm's row order is predictable
  const sorted = [...openReqs].sort((a, b) => priorityScore(b).score - priorityScore(a).score);

  const { cost, meta } = buildCostMatrix(sorted, openRes);
  const assign = hungarian(cost);

  const results: MatchResult[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const j = assign[i];
    if (j < 0 || cost[i][j] >= INF / 2) continue;
    const req = sorted[i];
    const res = openRes[j];
    const m = meta[i][j];
    results.push({
      request: req,
      resource: res,
      score: m.score,
      breakdown: m.breakdown,
      matchedRules: m.matchedRules,
      why: formatWhy(req, m.matchedRules),
    });
  }
  return results;
}

/**
 * Helper to build a full AppAllocation row from a MatchResult.
 * Kept in this module so the route layer stays thin.
 */
export function buildAllocation(r: MatchResult, admin: string, smsPreviewFn: (req: AppRequest, res: AppResource, why: string) => string): AppAllocation {
  return {
    _id: `alloc_${nanoid(10)}`,
    domain: r.request.domain,
    request_id: r.request._id,
    resource_id: r.resource._id,
    score: r.score,
    breakdown: r.breakdown,
    justification: `${r.request.requester_name} → ${r.resource.name}. ${r.why}. Score ${r.score.toFixed(1)}.`,
    allocated_at: new Date().toISOString(),
    admin_id: admin,
    admin_override: false,
    sms_preview: smsPreviewFn(r.request, r.resource, r.why),
  };
}
