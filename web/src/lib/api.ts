import axios from "axios";

// In dev, Vite proxies /api → localhost:4000 (or whatever API_URL env is set to).
// In production, point Vercel at the deployed API via VITE_API_URL, e.g.
//   VITE_API_URL=https://smart-beds-api.onrender.com
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api`
  : "/api";

const client = axios.create({ baseURL: API_BASE, timeout: 15000 });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("admin_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export type Domain = "hospital" | "lab" | "govt" | "ambulance";
export type VulnerabilityFlag = "senior_citizen" | "pregnant" | "disabled" | "low_income" | "minor";

export interface DomainRow {
  id: Domain;
  label: string; emoji: string;
  resource_singular: string; resource_plural: string;
  request_label: string; submit_cta: string;
  venue: string;
  stats: { free: number; total_resources: number; waiting: number; allocated_today: number };
}
export interface ResourceRow {
  _id: string; domain: Domain; name: string; capacity: number; available: boolean;
  location: { city: string; lat?: number; lng?: number };
  metadata?: Record<string, any>;
}
export interface RequestRow {
  _id: string; domain: Domain;
  requester_name: string; phone: string; city: string;
  description: string;
  urgency: number;
  vulnerability_flags: VulnerabilityFlag[];
  photo_url: string | null;
  submitted_at: string; wait_start_at: string;
  status: "waiting" | "allocated" | "served" | "cancelled";
  ai_extracted?: any;
}
export interface QueueEntry {
  request: RequestRow;
  score: number;
  breakdown: { urgency: number; wait: number; vulnerability: number; rules: number; total: number };
  matchedRules: string[];
  why: string;
}
export interface AllocationRow {
  _id: string; domain: Domain;
  request_id: string; resource_id: string;
  score: number;
  breakdown: QueueEntry["breakdown"];
  justification: string;
  allocated_at: string;
  admin_id: string; admin_override: boolean;
  sms_preview: string;
}
export interface AuditRow { _id: string; domain: string; event: string; actor: string; payload: any; timestamp: string; }

export type BedRow = "priority" | "regular";
export type RiskLevel = "low" | "medium" | "high";

export interface PatientInfo {
  patient_id: string;
  name: string;
  medical_condition: string;
  risk_level: RiskLevel;
  admitted_at: string;
}

export interface BedUnit {
  _id: string;
  block: string;            // e.g. "ICU Wing"
  block_id: string;         // e.g. "icu"
  row: BedRow;
  number: number;           // continuous 1..N
  status: "available" | "occupied";
  patient?: PatientInfo | null;
}

export interface LabUnit {
  _id: string;
  block: string;
  block_id: string;
  number: number;
  lab_id: string;           // human code like LAB-07
  room_no: string;
  status: "available" | "in_use" | "maintenance";
  emergency: boolean;
  assigned_to?: string | null;
  assigned_at?: string | null;
}

export interface TransferEvent {
  _id: string;
  kind: "queue" | "bump_to_regular" | "upgrade_to_priority" | "block_transfer" | "preempt_lab" | "admit" | "discharge";
  patient_id?: string;
  patient_name?: string;
  from?: string;
  to?: string;
  reason: string;
  timestamp: string;
  resource_ids?: string[];
}

export interface BedsState {
  beds: BedUnit[];
  queue: PatientInfo[];
  transfers: TransferEvent[];
}

export interface LabsState {
  labs: LabUnit[];
  queue: { patient_id: string; patient_name: string; request_type: string; queued_at: string }[];
  transfers: TransferEvent[];
}

export const api = {
  health: () => client.get("/health").then(r => r.data),
  domains: () => client.get<DomainRow[]>("/domains").then(r => r.data),
  resources: (domain: Domain) => client.get<ResourceRow[]>("/resources", { params: { domain } }).then(r => r.data),
  requests: (domain: Domain) => client.get<RequestRow[]>("/requests", { params: { domain } }).then(r => r.data),
  queue: (domain: Domain) => client.get<QueueEntry[]>("/queue", { params: { domain } }).then(r => r.data),
  allocations: (domain: Domain) => client.get<AllocationRow[]>("/allocations", { params: { domain } }).then(r => r.data),
  audit: (domain?: Domain) => client.get<AuditRow[]>("/audit", { params: domain ? { domain } : {} }).then(r => r.data),
  triage: (description: string, domain: Domain) => client.post("/triage", { description, domain }).then(r => r.data),
  submitRequest: (body: any) => client.post<RequestRow & { auto_allocated?: boolean; allocation?: AllocationRow | null }>("/requests", body).then(r => r.data),
  autoAllocate: (domain: Domain) =>
    client.post<{ created: number; allocations: AllocationRow[]; algorithm: string }>(
      "/allocations/auto", undefined, { params: { domain } }
    ).then(r => r.data),
  login: (username: string, password: string) =>
    client.post<{ token: string; username: string }>("/auth/login", { username, password }).then(r => r.data),
  reset: (domain?: Domain) =>
    client.post("/seed", undefined, { params: domain ? { domain } : {} }).then(r => r.data),

  // Smart bed dashboard
  bedsState: () => client.get<BedsState>("/beds").then(r => r.data),
  admitPatient: (body: { name: string; medical_condition: string; risk_level: RiskLevel; preferred_block?: string }) =>
    client.post<BedsState>("/beds/admit", body).then(r => r.data),
  changeRisk: (bedId: string, risk_level: RiskLevel) =>
    client.post<BedsState>(`/beds/${bedId}/risk`, { risk_level }).then(r => r.data),
  transferBed: (bedId: string, target: "priority" | "regular") =>
    client.post<BedsState>(`/beds/${bedId}/transfer`, { target }).then(r => r.data),
  dischargePatient: (bedId: string) =>
    client.post<BedsState>(`/beds/${bedId}/discharge`).then(r => r.data),

  // Smart labs dashboard
  labsState: () => client.get<LabsState>("/labs").then(r => r.data),
  labToggleEmergency: (labId: string) =>
    client.post<LabsState>(`/labs/${labId}/emergency`).then(r => r.data),
  labToggleMaintenance: (labId: string) =>
    client.post<LabsState>(`/labs/${labId}/maintenance`).then(r => r.data),
  labAssign: (labId: string, body: { patient_name: string; request_type: string }) =>
    client.post<LabsState>(`/labs/${labId}/assign`, body).then(r => r.data),
  labReset: (labId: string) =>
    client.post<LabsState>(`/labs/${labId}/reset`).then(r => r.data),
};
