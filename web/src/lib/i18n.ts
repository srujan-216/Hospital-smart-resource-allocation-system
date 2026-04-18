import { useState } from "react";

// Single-language (English) i18n helper. Kept as a `t(key)` function so existing
// call sites (`t("audit_log")` etc.) don't need to change.

const STRINGS = {
  app_title: "Smart Bed Allocation",
  app_subtitle: "Hospital Bed Allocation System",
  hospital_name: "City General Hospital · Emergency & Admissions",
  tagline: "Fair · Fast · Auditable",

  landing_headline: "Every bed. Every patient. One fair system.",
  landing_family_title: "For patients & families",
  landing_family_cta: "Request a bed",
  landing_staff_cta: "Staff login",

  beds_free: "Beds free",
  waiting: "Waiting",
  free: "Free",
  allocated_today: "Allocated today",
  avg_wait: "Avg wait",
  minutes: "min",

  intake_title: "Request a hospital bed",
  patient_name: "Patient name",
  contact_phone: "Contact phone",
  city_location: "City / location",
  describe_situation: "Describe the situation in plain words",
  describe_help: "Include symptoms, vitals if known, and any concerns.",
  vulnerabilities: "Does any of this apply to the patient?",
  senior_citizen: "Senior citizen (60+)",
  pregnant: "Pregnant",
  disabled: "Disabled",
  low_income: "Low income / BPL",
  minor: "Child (under 13)",
  submit_request: "Submit request",
  submitting: "Submitting…",
  your_score: "Your priority score",
  you_are_in_queue: "You are #{pos} in the queue",
  est_wait: "Estimated wait",
  go_to_queue: "View the queue",
  view_queue: "View the queue",

  queue_header: "Waiting patients",
  beds_header: "Bed availability",
  no_waiting: "No patients waiting right now.",
  audit_log: "Audit log",
  admin_console: "Staff dashboard",
  reset_demo: "Reset demo data",
  close: "Close",
  allocate: "Allocate",
  resource: "Resource",

  login_title: "Staff login",
  username: "Username",
  password: "Password",
  login: "Log in",
  logout: "Log out",
  dashboard_role: "Triage Coordinator",

  how_we_decide: "How priority is calculated",
  formula_expl: "urgency × 40  +  wait × 20  +  vulnerability × 20  +  clinical keywords × 20",
  formula_note: "Every factor is visible. Nothing is hidden.",
  no_black_box: "Every factor is visible. Nothing is hidden.",
  pick_domain: "Pick a service",
  home_hero: "Priority-aware, transparent, and Hungarian-backed — every bed decision has a reason on record.",

  back: "Back",
  loading: "Loading…",
  request_form_title: "Request a bed",
  your_name: "Patient name",
  your_phone: "Phone",
  city: "City",
  describe: "Describe the situation",
  submit: "Submit",
} as const;

type StringKey = keyof typeof STRINGS;

export function useI18n() {
  // `lang` retained as a constant so Layout / existing components that read it
  // compile without changes. The public API is English-only.
  const [lang] = useState<"en">("en");

  const t = (key: StringKey, vars?: Record<string, string | number>) => {
    let v: string = (STRINGS as any)[key] || (key as string);
    if (vars) for (const k of Object.keys(vars)) v = v.replace(`{${k}}`, String(vars[k]));
    return v;
  };

  return { t, lang };
}
