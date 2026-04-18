import type { AppRequest, Domain } from "../types.js";
import { priorityScore, formatWhy } from "./scoring.js";

export interface QueueEntry {
  request: AppRequest;
  score: number;
  breakdown: ReturnType<typeof priorityScore>["breakdown"];
  why: string;
  matchedRules: string[];
}

export function buildQueue(requests: AppRequest[], domain?: Domain): QueueEntry[] {
  return requests
    .filter(r => (!domain || r.domain === domain) && r.status === "waiting")
    .map(r => {
      const { score, breakdown, matchedRules } = priorityScore(r);
      return { request: r, score, breakdown, matchedRules, why: formatWhy(r, matchedRules) };
    })
    .sort((a, b) => b.score - a.score);
}
