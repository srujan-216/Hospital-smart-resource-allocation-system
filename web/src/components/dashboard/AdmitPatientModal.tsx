import { useState } from "react";
import { Modal } from "../Modal";
import { VulnerabilityChips } from "../VulnerabilityChips";
import type { RiskLevel, VulnerabilityFlag } from "../../lib/api";
import {
  validateName, validatePhone, validateDate, validateDescription,
  normalisePhone, toDateTimeLocalValue,
} from "../../lib/validators";
import { BED_BLOCK_CHOICES } from "./blockChoices";

export interface AdmitPayload {
  name: string;
  phone: string;
  medical_condition: string;
  risk_level: RiskLevel;
  admitted_at: string;
  preferred_block: string;
  vulnerability_flags: VulnerabilityFlag[];
}

export function AdmitPatientModal({
  open, onClose, onSubmit, busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: AdmitPayload) => Promise<void> | void;
  busy?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [condition, setCondition] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [admittedAt, setAdmittedAt] = useState(toDateTimeLocalValue());
  const [block, setBlock] = useState<string>("general");
  const [flags, setFlags] = useState<VulnerabilityFlag[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setName(""); setPhone(""); setCondition(""); setRisk("medium");
    setAdmittedAt(toDateTimeLocalValue()); setBlock("general"); setFlags([]); setErrors({});
  }

  async function handleSubmit() {
    const checks = {
      name: validateName(name),
      phone: validatePhone(phone),
      condition: validateDescription(condition),
      admittedAt: validateDate(admittedAt, { maxDaysAgo: 1, maxHoursAhead: 1, fieldLabel: "Admission time" }),
    };
    const nextErr: Record<string, string> = {};
    for (const [k, v] of Object.entries(checks)) if (!v.ok) nextErr[k] = v.error!;
    setErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    await onSubmit({
      name: name.trim(),
      phone: normalisePhone(phone),
      medical_condition: condition.trim(),
      risk_level: risk,
      admitted_at: new Date(admittedAt).toISOString(),
      preferred_block: block,
      vulnerability_flags: flags,
    });
    reset();
    onClose();
  }

  const riskOptions: { value: RiskLevel; label: string; tone: "ok" | "warn" | "danger" }[] = [
    { value: "low",    label: "Low",    tone: "ok" },
    { value: "medium", label: "Medium", tone: "warn" },
    { value: "high",   label: "High",   tone: "danger" },
  ];

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Admit patient"
      footer={
        <>
          <button className="btn-outline" onClick={() => { reset(); onClose(); }}>Cancel</button>
          <button disabled={busy} onClick={handleSubmit} className="btn-primary">
            {busy ? "Admitting…" : "Admit & auto-allocate"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Patient name" error={errors.name}>
          <input
            className={`input ${errors.name ? "border-danger focus:ring-danger/30" : ""}`}
            value={name}
            onChange={e => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: "" }); }}
            placeholder="Ramesh Yadav"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={errors.phone}>
            <input
              inputMode="tel"
              className={`input ${errors.phone ? "border-danger focus:ring-danger/30" : ""}`}
              value={phone}
              onChange={e => { setPhone(e.target.value); if (errors.phone) setErrors({ ...errors, phone: "" }); }}
              placeholder="+91 9876543210"
            />
          </Field>
          <Field label="Admission time" error={errors.admittedAt}>
            <input
              type="datetime-local"
              className={`input ${errors.admittedAt ? "border-danger focus:ring-danger/30" : ""}`}
              value={admittedAt}
              onChange={e => { setAdmittedAt(e.target.value); if (errors.admittedAt) setErrors({ ...errors, admittedAt: "" }); }}
              max={toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000))}
            />
          </Field>
        </div>

        <Field label="Medical condition" error={errors.condition}>
          <textarea
            className={`input min-h-[80px] ${errors.condition ? "border-danger focus:ring-danger/30" : ""}`}
            value={condition}
            onChange={e => { setCondition(e.target.value); if (errors.condition) setErrors({ ...errors, condition: "" }); }}
            placeholder="e.g. chest pain · BP 160/100 · suspected MI"
          />
        </Field>

        <div>
          <div className="label mb-1.5">Risk level</div>
          <div className="grid grid-cols-3 gap-1.5">
            {riskOptions.map(opt => {
              const active = risk === opt.value;
              const activeClass = {
                ok: "bg-successLight border-success text-success",
                warn: "bg-warnLight border-warn text-warn",
                danger: "bg-dangerLight border-danger text-danger",
              }[opt.tone];
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRisk(opt.value)}
                  className={`px-2 py-2 rounded-lg border-2 text-xs font-bold transition-colors ${
                    active ? activeClass : "border-border text-muted hover:border-ink hover:text-ink"
                  }`}
                >{opt.label}</button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label mb-1.5">Preferred block</div>
          <div className="grid grid-cols-2 gap-1.5">
            {BED_BLOCK_CHOICES.map(b => {
              const active = block === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBlock(b.id)}
                  className={`px-2.5 py-1.5 rounded-lg border-2 text-xs transition-colors flex items-center gap-2 ${
                    active ? "border-accent bg-accentLight text-accent font-semibold" : "border-border text-inkMuted hover:border-accent/60"
                  }`}
                >
                  <span className="text-base">{b.emoji}</span>
                  <span>{b.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="label mb-1.5">Vulnerabilities (optional)</div>
          <VulnerabilityChips value={flags} onChange={setFlags} />
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
      {error && <div className="text-[11px] text-danger mt-1">{error}</div>}
    </div>
  );
}
