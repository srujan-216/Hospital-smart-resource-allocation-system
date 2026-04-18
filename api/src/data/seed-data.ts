import type { AppRequest, AppResource, Domain, VulnerabilityFlag } from "../types.js";
import { nanoid } from "nanoid";
import { ruleTriage } from "../services/triage.js";
import { buildBedResources, buildLabResources, BED_BLOCKS } from "./dashboard-seed.js";

function R(
  domain: Domain, name: string, capacity: number, city: string,
  metadata: Record<string, any> = {},
  available = true,
  coords?: { lat: number; lng: number },
): AppResource {
  return {
    _id: `res_${nanoid(8)}`,
    domain, name, capacity, available,
    location: { city, ...(coords || {}) },
    metadata,
  };
}

function Q(
  domain: Domain, requester_name: string, phone: string, city: string,
  description: string, vulnerability_flags: VulnerabilityFlag[] = [],
  minutesAgo = 0,
): AppRequest {
  const submitted = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
  const wait_start_at = submitted;
  const ai = ruleTriage(description, domain);
  return {
    _id: `req_${nanoid(8)}`,
    domain,
    requester_name,
    phone,
    city,
    description,
    urgency: ai.urgency,
    vulnerability_flags,
    photo_url: null,
    submitted_at: submitted,
    wait_start_at,
    status: "waiting",
    ai_extracted: { ...ai },
  };
}

// ──────────────────────────────── HOSPITAL ────────────────────────────────
// Lucknow Civil Hospital
export function hospitalSeed() {
  const beds = buildBedResources();
  const labs = buildLabResources();

  // Pre-occupy a handful of beds with existing patients so the dashboard has
  // content on first boot. Occupy some priority beds and some regular beds.
  const occupy = (bed: AppResource, patient: { name: string; medical_condition: string; risk_level: "low" | "medium" | "high" }) => {
    bed.available = false;
    bed.metadata = {
      ...(bed.metadata || {}),
      patient: {
        patient_id: `P-${String(Math.floor(Math.random() * 90000) + 10000)}`,
        name: patient.name,
        medical_condition: patient.medical_condition,
        risk_level: patient.risk_level,
        admitted_at: new Date(Date.now() - Math.floor(Math.random() * 3 * 60 * 60 * 1000)).toISOString(),
      },
    };
  };

  // Find some beds to pre-occupy by block + row
  const bedsByKey = (blockId: string, row: "priority" | "regular") =>
    beds.filter(b => b.metadata?.block_id === blockId && b.metadata?.row === row);

  const icuPri = bedsByKey("icu", "priority");
  const icuReg = bedsByKey("icu", "regular");
  const genPri = bedsByKey("general", "priority");
  const genReg = bedsByKey("general", "regular");
  const pedPri = bedsByKey("pediatric", "priority");
  const pedReg = bedsByKey("pediatric", "regular");
  const isoPri = bedsByKey("isolation", "priority");

  if (icuPri[0]) occupy(icuPri[0], { name: "Ramesh Yadav",    medical_condition: "Cardiac arrest · post-CPR",    risk_level: "high" });
  if (icuPri[1]) occupy(icuPri[1], { name: "Asha Devi",       medical_condition: "Severe respiratory distress · SpO2 85%", risk_level: "high" });
  if (icuReg[0]) occupy(icuReg[0], { name: "Vikram Singh",    medical_condition: "Post-op observation · stable",  risk_level: "medium" });
  if (genPri[0]) occupy(genPri[0], { name: "Priya Singh",     medical_condition: "Dengue · platelets 40k",         risk_level: "high" });
  if (genReg[0]) occupy(genReg[0], { name: "Mohammed Imran",  medical_condition: "Road accident · leg fracture",   risk_level: "low" });
  if (genReg[1]) occupy(genReg[1], { name: "Sunita Patel",    medical_condition: "Pneumonia · IV antibiotics",     risk_level: "medium" });
  if (genReg[2]) occupy(genReg[2], { name: "Kavita Nair",     medical_condition: "Gastritis · observation",        risk_level: "low" });
  if (pedPri[0]) occupy(pedPri[0], { name: "Arjun (8yr)",     medical_condition: "Severe asthma attack",           risk_level: "high" });
  if (pedReg[0]) occupy(pedReg[0], { name: "Neha (6yr)",      medical_condition: "Dehydration · IV fluids",        risk_level: "medium" });
  if (isoPri[0]) occupy(isoPri[0], { name: "Rajesh Kumar",    medical_condition: "Suspected H1N1 · airborne precautions", risk_level: "high" });

  // Put two labs into distinctive states so the dashboard demos maintenance / emergency / in-use.
  if (labs[1]) labs[1].metadata = { ...labs[1].metadata, status: "maintenance" };
  if (labs[7]) labs[7].metadata = { ...labs[7].metadata, status: "in_use", assigned_to: "P-48123 · CBC", assigned_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() };
  if (labs[12]) labs[12].metadata = { ...labs[12].metadata, status: "in_use", emergency: true, assigned_to: "P-90012 · STAT troponin", assigned_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() };
  if (labs[20]) labs[20].metadata = { ...labs[20].metadata, status: "maintenance" };

  const resources: AppResource[] = [...beds, ...labs];

  const requests: AppRequest[] = [
    Q("hospital", "Ramesh Yadav", "+91 98765 43210", "Lucknow",
      "Dada ji sweating, chest pain, BP 160/100, heart attack suspected",
      ["senior_citizen"], 22),
    Q("hospital", "Priya Singh", "+91 98700 11223", "Lucknow",
      "Dengue, platelets dropped to 40k, fever 5 days, very weak",
      [], 48),
    Q("hospital", "Asha Devi", "+91 90111 22333", "Lucknow",
      "Saans lene mein takleef, SpO2 85%, diabetic",
      ["senior_citizen"], 12),
    Q("hospital", "Mohammed Imran", "+91 99887 66554", "Lucknow",
      "Road accident near Charbagh, leg fracture, stable, conscious",
      [], 8),
    Q("hospital", "Geeta Verma", "+91 98999 77667", "Lucknow",
      "Labour pains, water broke 20 min ago, 38 weeks pregnant",
      ["pregnant"], 5),
  ];

  return { resources, requests };
}

// ──────────────────────────────── COLLEGE LAB ────────────────────────────────
// IIIT Hyderabad
export function labSeed() {
  const resources: AppResource[] = [
    R("lab", "Lab-1 (40 PCs)", 40, "Hyderabad", { type: "computer_lab", seats: 40 }),
    R("lab", "Lab-2 (30 PCs)", 30, "Hyderabad", { type: "computer_lab", seats: 30 }, false),
    R("lab", "Project Room A", 8, "Hyderabad", { type: "project_room", seats: 8 }),
    R("lab", "Project Room B", 8, "Hyderabad", { type: "project_room", seats: 8 }),
    R("lab", "Oscilloscope Room", 4, "Hyderabad", { type: "equipment" }, false),
    R("lab", "3D Printer", 1, "Hyderabad", { type: "equipment" }),
    R("lab", "GPU Server (shared)", 2, "Hyderabad", { type: "equipment" }),
  ];

  const requests: AppRequest[] = [
    Q("lab", "Ananya Reddy", "+91 98112 33445", "Hyderabad",
      "Final year project demo tomorrow 10 AM, need Lab-2 for 3 hours",
      [], 15),
    Q("lab", "Karthik Menon", "+91 97000 55443", "Hyderabad",
      "DSA assignment due tonight midnight, need any lab for 2 hours",
      [], 3),
    Q("lab", "Prof. Suresh Iyer", "+91 94433 00122", "Hyderabad",
      "Guest lecture from Infosys CTO, Friday 3–5 PM, need Lab-1",
      [], 90),
    Q("lab", "Divya Nair", "+91 98212 66778", "Hyderabad",
      "3D printer slot for prosthetic thesis prototype, research deadline next week",
      [], 40),
    Q("lab", "Sneha Joshi", "+91 98700 99887", "Hyderabad",
      "Group of 5 needs Project Room A for hackathon practice tomorrow evening",
      [], 10),
  ];

  return { resources, requests };
}

// ──────────────────────────────── GOVERNMENT SERVICES ────────────────────────────────
// Bangalore Passport Seva Kendra, Koramangala
export function govtSeed() {
  const resources: AppResource[] = [
    ...Array.from({ length: 6 }, (_, i) => R("govt", `Counter-${i + 1}`, 1, "Bangalore", { type: "counter" }, i !== 2 && i !== 4)),
    ...Array.from({ length: 4 }, (_, i) => R("govt", `Officer-${i + 1}`, 1, "Bangalore", { type: "officer" }, i !== 1)),
  ];

  const requests: AppRequest[] = [
    Q("govt", "Rajesh Kumar", "+91 99876 54321", "Bangalore",
      "Urgent tatkal passport, mother in ICU Dubai medical emergency, flight tomorrow",
      [], 6),
    Q("govt", "Nandini Sharma", "+91 98440 67788", "Bangalore",
      "Tatkal passport, flight in 15 days for Infosys onsite Zurich",
      [], 20),
    Q("govt", "Mohammed Ali", "+91 97401 22334", "Bangalore",
      "Renewal, senior citizen, no urgency",
      ["senior_citizen"], 45),
    Q("govt", "Sunita Patel", "+91 94488 00990", "Bangalore",
      "First-time passport for vaccination trip to London",
      ["senior_citizen"], 30),
    Q("govt", "Vinod Reddy", "+91 98802 44556", "Bangalore",
      "Address change only, routine",
      [], 55),
  ];

  return { resources, requests };
}

// ──────────────────────────────── AMBULANCE (108) ────────────────────────────────
// Chennai dispatch
export function ambulanceSeed() {
  const resources: AppResource[] = [
    R("ambulance", "Amb-1 (Anna Nagar)", 1, "Chennai", { type: "als", base: "Anna Nagar" }, true, { lat: 13.0850, lng: 80.2101 }),
    R("ambulance", "Amb-2 (T Nagar)", 1, "Chennai", { type: "als", base: "T Nagar" }, true, { lat: 13.0418, lng: 80.2341 }),
    R("ambulance", "Amb-3 (Adyar)", 1, "Chennai", { type: "bls", base: "Adyar" }, true, { lat: 13.0067, lng: 80.2570 }),
    R("ambulance", "Amb-4 (Velachery)", 1, "Chennai", { type: "als", base: "Velachery" }, true, { lat: 12.9752, lng: 80.2212 }),
    R("ambulance", "Amb-5 (Porur)", 1, "Chennai", { type: "bls", base: "Porur" }, false, { lat: 13.0382, lng: 80.1565 }),
    R("ambulance", "Amb-6 (Kodambakkam)", 1, "Chennai", { type: "bls", base: "Kodambakkam" }, true, { lat: 13.0524, lng: 80.2218 }),
  ];

  const requests: AppRequest[] = [
    Q("ambulance", "Anna Nagar caller", "+91 99625 11223", "Chennai",
      "58 yr old man, cardiac arrest, no pulse, family calling, unresponsive",
      [], 0),
    Q("ambulance", "T Nagar caller", "+91 98400 33221", "Chennai",
      "Road accident near Pondy Bazaar, 2 injured, heavy bleeding",
      [], 1),
    Q("ambulance", "Velachery caller", "+91 97860 44556", "Chennai",
      "Pregnant woman, water broke, contractions every 5 minutes",
      ["pregnant"], 0),
    Q("ambulance", "Adyar caller", "+91 94440 99887", "Chennai",
      "80 year old fall at home, conscious, hip pain, stable",
      ["senior_citizen"], 2),
    Q("ambulance", "Kodambakkam caller", "+91 98840 77665", "Chennai",
      "Asthma attack, 12 year old child, struggling to breathe",
      ["minor"], 0),
  ];

  return { resources, requests };
}

export function seedForDomain(domain: Domain) {
  switch (domain) {
    case "lab": return labSeed();
    case "govt": return govtSeed();
    case "ambulance": return ambulanceSeed();
    default: return hospitalSeed();
  }
}

export function seedAll() {
  // Confined to hospital domain only. The engine still supports others —
  // extend this array to re-enable them.
  const domains: Domain[] = ["hospital"];
  const resources: AppResource[] = [];
  const requests: AppRequest[] = [];
  for (const d of domains) {
    const s = seedForDomain(d);
    resources.push(...s.resources);
    requests.push(...s.requests);
  }
  return { resources, requests };
}

export const DOMAIN_META: Record<Domain, {
  label: string; emoji: string;
  resource_singular: string; resource_plural: string;
  request_label: string; submit_cta: string;
  venue: string;
}> = {
  hospital: {
    label: "Hospital Beds", emoji: "🏥",
    resource_singular: "bed", resource_plural: "beds",
    request_label: "patient", submit_cta: "Request a bed",
    venue: "Lucknow Civil Hospital",
  },
  lab: {
    label: "College Labs", emoji: "🎓",
    resource_singular: "slot", resource_plural: "slots",
    request_label: "booking", submit_cta: "Book a slot",
    venue: "IIIT Hyderabad",
  },
  govt: {
    label: "Govt Services", emoji: "🏛️",
    resource_singular: "counter", resource_plural: "counters",
    request_label: "applicant", submit_cta: "Request a slot",
    venue: "Passport Seva Kendra, Bangalore",
  },
  ambulance: {
    label: "Ambulance / 108", emoji: "🚑",
    resource_singular: "ambulance", resource_plural: "ambulances",
    request_label: "emergency call", submit_cta: "Dispatch",
    venue: "Chennai 108 Dispatch",
  },
};
