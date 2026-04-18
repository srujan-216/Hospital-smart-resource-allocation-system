/**
 * Triage: extracts urgency (1–10) and structured hints from a free-text description.
 * Rule-based implementation (no API key needed). Claude path can slot in later.
 */
import type { Domain } from "../types.js";

export interface TriageOutput {
  urgency: number;
  acuity_hint: "critical" | "urgent" | "routine";
  chief_complaint: string;
  age_estimate?: number;
  domain_keywords: string[];
  source: "rule" | "claude";
}

const CRITICAL = /(no pulse|unresponsive|cardiac arrest|unconscious|gcs [3-8]\b|spo2 ?[0-7]\d|gasping|heavy bleeding|shock|labour.*contraction|stroke|overdose|drowning|respiratory failure)/i;
const URGENT = /(chest pain|heart attack|bleeding|fracture|fever|dengue|labour|water broke|dyspnea|breathless|saans|platelet|sepsis|accident|severe|flight tomorrow|ICU|medical emergency|final year|deadline tomorrow|demo tomorrow|guest lecture|pregnan)/i;

export function ruleTriage(description: string, domain: Domain): TriageOutput {
  const text = description || "";
  const lower = text.toLowerCase();
  let urgency = 3;
  let acuity: TriageOutput["acuity_hint"] = "routine";

  if (CRITICAL.test(text)) { urgency = 10; acuity = "critical"; }
  else if (URGENT.test(text)) { urgency = 7; acuity = "urgent"; }

  // Pull numeric SpO2 if present — below 90 bumps urgency
  const spo2 = /spo2 ?(\d{2,3})/i.exec(text);
  if (spo2) {
    const v = Number(spo2[1]);
    if (v < 85) urgency = Math.max(urgency, 10);
    else if (v < 90) urgency = Math.max(urgency, 9);
    else if (v < 94) urgency = Math.max(urgency, 7);
  }

  // Extract rough age
  const age = /(\d{1,3})\s*(?:y|yr|year|yrs|वर्ष|साल)/i.exec(text);
  const age_estimate = age ? Number(age[1]) : undefined;

  // Extract domain keywords that fired
  const keywords: string[] = [];
  for (const re of [CRITICAL, URGENT]) {
    const m = [...text.matchAll(new RegExp(re, "gi"))];
    for (const x of m) keywords.push(x[0].toLowerCase());
  }

  // First sentence as chief complaint
  const firstSentence = text.split(/[.!?\n]/)[0].trim().slice(0, 140) || text.slice(0, 80);

  return {
    urgency,
    acuity_hint: acuity,
    chief_complaint: firstSentence,
    age_estimate,
    domain_keywords: Array.from(new Set(keywords)).slice(0, 5),
    source: "rule",
  };
}

export async function triage(description: string, domain: Domain): Promise<TriageOutput> {
  // Claude path intentionally omitted — wire it later by swapping this function.
  return ruleTriage(description, domain);
}
