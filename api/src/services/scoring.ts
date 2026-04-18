/**
 * Transparent priority scoring.
 *
 *   score = urgency × 40  +  wait × 20  +  vulnerability × 20  +  domain_rules × 20
 *
 * Every component is in [0, 1]. Max total = 100.
 * The full breakdown is always returned so the UI can show why.
 */
import type { AppRequest, ScoreBreakdown, Domain } from "../types.js";

const DOMAIN_KEYWORDS: Record<Domain, RegExp> = {
  hospital: /chest pain|cardiac|heart attack|bleeding|unconscious|gasping|saans|spo2|sp02|accident|unresponsive|stroke|sepsis|labour|labor|water broke|platelet|dengue|seizure|infant|newborn|icu|ventilator/i,
  lab: /final[- ]year|demo|deadline|thesis|viva|guest lecture|research|assignment due|hackathon|prototype|submission tomorrow/i,
  govt: /medical emergency|icu|hospital|flight tomorrow|flight in \d+ (day|days)|senior citizen|tatkal|urgent/i,
  ambulance: /cardiac|no pulse|unresponsive|bleeding|accident|stroke|labour|labor|contractions|asthma attack|overdose|drowning|burn|chest pain/i,
};

export function extractDomainRuleBoost(req: Pick<AppRequest, "description" | "domain" | "ai_extracted" | "vulnerability_flags">): { hit: boolean; matched: string[] } {
  const text = (req.description || "") + " " + (req.ai_extracted?.chief_complaint || "");
  const re = DOMAIN_KEYWORDS[req.domain];
  const matches = [...text.matchAll(new RegExp(re, "gi"))].map(m => m[0]);
  const unique = Array.from(new Set(matches.map(m => m.toLowerCase())));
  return { hit: unique.length > 0, matched: unique.slice(0, 3) };
}

export function waitMinutes(req: AppRequest): number {
  const start = new Date(req.wait_start_at || req.submitted_at).getTime();
  return Math.max(0, (Date.now() - start) / 60000);
}

export function priorityScore(req: AppRequest): { score: number; breakdown: ScoreBreakdown; matchedRules: string[] } {
  const urgencyNorm = Math.min(1, Math.max(0, (req.urgency || 1) / 10));
  const wait = Math.min(1, waitMinutes(req) / 60);
  const flagsCount = req.vulnerability_flags?.length || 0;
  const vulnerability = Math.min(1, flagsCount * 0.34);
  const { hit, matched } = extractDomainRuleBoost(req);
  const rules = hit ? 1 : 0;

  const urgencyPts = +(urgencyNorm * 40).toFixed(1);
  const waitPts = +(wait * 20).toFixed(1);
  const vulnerabilityPts = +(vulnerability * 20).toFixed(1);
  const rulesPts = +(rules * 20).toFixed(1);
  const total = +(urgencyPts + waitPts + vulnerabilityPts + rulesPts).toFixed(1);

  return {
    score: total,
    breakdown: {
      urgency: urgencyPts,
      wait: waitPts,
      vulnerability: vulnerabilityPts,
      rules: rulesPts,
      total,
    },
    matchedRules: matched,
  };
}

export function formatWhy(req: AppRequest, matchedRules: string[]): string {
  const bits: string[] = [];
  if (req.urgency >= 8) bits.push(`urgency ${req.urgency}/10`);
  else if (req.urgency >= 5) bits.push(`urgency ${req.urgency}`);
  const w = Math.round(waitMinutes(req));
  if (w > 0) bits.push(`waited ${w} min`);
  if (req.vulnerability_flags?.length) {
    const pretty: Record<string, string> = {
      senior_citizen: "senior citizen",
      pregnant: "pregnant",
      disabled: "disabled",
      low_income: "low-income",
      minor: "minor (child)",
    };
    bits.push(req.vulnerability_flags.map(f => pretty[f] || f).join(" + "));
  }
  if (matchedRules.length) bits.push(`matched "${matchedRules[0]}"`);
  return bits.join(" · ") || "routine request";
}
