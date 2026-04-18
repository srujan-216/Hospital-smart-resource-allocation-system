import { z } from "zod";

export const DomainSchema = z.enum(["hospital", "lab", "govt", "ambulance"]);
export type Domain = z.infer<typeof DomainSchema>;

export const VulnerabilityFlagSchema = z.enum([
  "senior_citizen", "pregnant", "disabled", "low_income", "minor",
]);
export type VulnerabilityFlag = z.infer<typeof VulnerabilityFlagSchema>;

export const RequestStatusSchema = z.enum(["waiting", "allocated", "served", "cancelled"]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export interface AppResource {
  _id: string;
  domain: Domain;
  name: string;
  capacity: number;
  available: boolean;
  location: { city: string; lat?: number; lng?: number };
  metadata?: Record<string, any>;
}

export interface AppRequest {
  _id: string;
  domain: Domain;
  requester_name: string;
  phone: string;
  city: string;
  description: string;
  urgency: number; // 1..10
  vulnerability_flags: VulnerabilityFlag[];
  photo_url: string | null;
  submitted_at: string;
  wait_start_at: string;
  status: RequestStatus;
  ai_extracted?: {
    chief_complaint?: string;
    age_estimate?: number;
    acuity_hint?: "critical" | "urgent" | "routine";
    domain_keywords?: string[];
    source: "claude" | "rule";
  };
}

export interface ScoreBreakdown {
  urgency: number;
  wait: number;
  vulnerability: number;
  rules: number;
  total: number;
  distance_km?: number;
}

export interface AppAllocation {
  _id: string;
  domain: Domain;
  request_id: string;
  resource_id: string;
  score: number;
  breakdown: ScoreBreakdown;
  justification: string;
  allocated_at: string;
  admin_id: string;
  admin_override: boolean;
  sms_preview: string;
}

export interface AuditEvent {
  _id: string;
  domain: Domain | "system";
  event: string;
  actor: string;
  payload: any;
  timestamp: string;
}

export const SubmitRequestBody = z.object({
  domain: DomainSchema,
  requester_name: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  city: z.string().min(1).max(60),
  description: z.string().min(3).max(1000),
  vulnerability_flags: z.array(VulnerabilityFlagSchema).default([]),
  urgency: z.number().min(1).max(10).optional(),
  photo_url: z.string().url().nullable().optional(),
});
export type SubmitRequestInput = z.infer<typeof SubmitRequestBody>;

export const LoginBody = z.object({
  username: z.string(),
  password: z.string(),
});
