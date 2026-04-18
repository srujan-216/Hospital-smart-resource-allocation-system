import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, type AllocationRow, type Domain, type DomainRow, type RequestRow, type VulnerabilityFlag } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { VulnerabilityChips } from "../components/VulnerabilityChips";
import { ScoreBars } from "../components/ScoreBars";
import {
  validateName, validatePhone, validateCity, validateDescription, validateDate,
  normalisePhone, toDateTimeLocalValue,
} from "../lib/validators";

interface SubmitResult {
  request: RequestRow;
  score: number;
  breakdown: any;
  position: number | null;
  allocation: AllocationRow | null;
  auto_allocated: boolean;
}

export function RequestPage() {
  const { t } = useI18n();
  const { domain } = useParams<{ domain: Domain }>();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<DomainRow | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [flags, setFlags] = useState<VulnerabilityFlag[]>([]);
  const [onsetAt, setOnsetAt] = useState(toDateTimeLocalValue());
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    api.domains().then(list => {
      const m = list.find(x => x.id === domain);
      if (m) { setMeta(m); setCity(c => c || m.venue.split(",").pop()?.trim() || ""); }
    });
  }, [domain]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain) return;
    setErr(null);

    // Field-level validation
    const checks: Record<string, ReturnType<typeof validateName>> = {
      name: validateName(name),
      phone: validatePhone(phone),
      city: validateCity(city),
      description: validateDescription(description),
      onsetAt: validateDate(onsetAt, { maxDaysAgo: 7, maxHoursAhead: 1, fieldLabel: "Onset time" }),
    };
    const errors: Record<string, string> = {};
    for (const [k, v] of Object.entries(checks)) if (!v.ok) errors[k] = v.error!;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const created = await api.submitRequest({
        domain,
        requester_name: name.trim(),
        phone: normalisePhone(phone),
        city: city.trim() || "Unknown",
        description: `${description.trim()} (onset: ${new Date(onsetAt).toLocaleString()})`,
        vulnerability_flags: flags,
      });

      const allocation = (created as any).allocation as AllocationRow | null;
      const autoAllocated = !!(created as any).auto_allocated;

      let score = allocation?.score ?? 0;
      let breakdown = allocation?.breakdown ?? null;
      let position: number | null = null;

      // If not auto-allocated, look it up in the waiting queue for position
      if (!autoAllocated) {
        try {
          const queue = await api.queue(domain);
          const myEntry = queue.find(e => e.request._id === created._id);
          if (myEntry) {
            score = myEntry.score;
            breakdown = myEntry.breakdown;
            position = queue.findIndex(e => e.request._id === created._id) + 1;
          }
        } catch { /* fall through with what we have */ }
      }

      setResult({
        request: created,
        score,
        breakdown,
        position,
        allocation,
        auto_allocated: autoAllocated,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Something went wrong";
      setErr(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  if (!meta) return <div className="text-sm text-muted py-8 text-center">Loading…</div>;

  // ─────────── success screen ───────────
  if (result) {
    const allocated = result.auto_allocated && result.allocation;
    return (
      <div className="max-w-lg mx-auto space-y-4">
        {allocated ? (
          <div className="card slide-up border-success/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-successLight text-success flex items-center justify-center text-xl font-bold">✓</div>
              <div>
                <div className="chip-success text-[10px] mb-1">BED ASSIGNED · AUTOMATIC</div>
                <div className="font-bold text-lg">{result.allocation!.justification.split("·")[0] || "Bed assigned"}</div>
              </div>
            </div>

            <div className="bg-accentLight/60 rounded-lg p-4 text-center">
              <div className="text-[11px] text-accent uppercase tracking-wider font-semibold">Your bed</div>
              <div className="text-3xl font-extrabold text-accent mt-1">
                {result.allocation!.justification.match(/Bed \d+/)?.[0] || "Assigned"}
              </div>
              <div className="text-[12px] text-inkMuted mt-1">Score {result.score.toFixed(0)}/100</div>
            </div>

            {result.breakdown && (
              <div className="mt-4">
                <div className="label mb-2">Why this bed</div>
                <ScoreBars breakdown={result.breakdown} />
              </div>
            )}

            <div className="mt-4 rounded-lg bg-surface2 border border-border px-3 py-2">
              <div className="text-[10px] text-muted uppercase font-semibold mb-1">SMS preview</div>
              <div className="text-[12px] text-ink">{result.allocation!.sms_preview}</div>
            </div>

            <div className="flex gap-2 mt-5">
              <Link to={`/d/${domain}/queue`} className="btn-primary flex-1">{t("go_to_queue")}</Link>
              <button onClick={() => { setResult(null); setName(""); setPhone(""); setDescription(""); setFlags([]); }} className="btn-outline flex-1">
                Submit another
              </button>
            </div>
          </div>
        ) : (
          <div className="card slide-up border-warn/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-warnLight text-warn flex items-center justify-center text-xl font-bold">⏳</div>
              <div>
                <div className="chip-warn text-[10px] mb-1">ADDED TO PRIORITY QUEUE</div>
                <div className="font-bold text-lg">All beds currently full</div>
              </div>
            </div>

            <div className="bg-warnLight/60 rounded-lg p-4 text-center">
              <div className="text-[11px] text-warn uppercase tracking-wider font-semibold">Your score</div>
              <div className="text-4xl font-extrabold text-warn mt-1">{result.score.toFixed(0)}<span className="text-warn/60 text-xl">/100</span></div>
              {result.position != null && (
                <div className="text-[12px] text-inkMuted mt-1">Position #{result.position} in queue</div>
              )}
            </div>

            {result.breakdown && (
              <div className="mt-4">
                <div className="label mb-2">Why this score</div>
                <ScoreBars breakdown={result.breakdown} />
              </div>
            )}

            <div className="text-[12px] text-muted mt-4 italic">
              You'll be assigned a bed the moment one becomes free. Hungarian runs automatically.
            </div>

            <div className="flex gap-2 mt-5">
              <Link to={`/d/${domain}/queue`} className="btn-primary flex-1">{t("go_to_queue")}</Link>
              <button onClick={() => setResult(null)} className="btn-outline flex-1">Submit another</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────── form ───────────
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">{meta.emoji}</div>
          <div>
            <div className="font-bold text-base">Request a bed</div>
            <div className="text-xs text-muted">{meta.label} · {meta.venue}</div>
          </div>
        </div>

        <div className="rounded-lg bg-accentLight/40 border border-accent/20 px-3 py-2 mb-4 text-[12px] text-inkMuted">
          The system reads your words, scores priority, and assigns a bed automatically — no forms to route.
        </div>

        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label="Patient name" error={fieldErrors.name}>
            <input
              className={`input ${fieldErrors.name ? "border-danger focus:ring-danger/30" : ""}`}
              value={name}
              onChange={e => { setName(e.target.value); if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: "" }); }}
              placeholder="Ramesh Yadav"
              autoComplete="name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone (Indian mobile)" error={fieldErrors.phone}>
              <input
                inputMode="tel"
                className={`input ${fieldErrors.phone ? "border-danger focus:ring-danger/30" : ""}`}
                value={phone}
                onChange={e => { setPhone(e.target.value); if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: "" }); }}
                placeholder="+91 9876543210"
                autoComplete="tel"
              />
            </Field>
            <Field label="City" error={fieldErrors.city}>
              <input
                className={`input ${fieldErrors.city ? "border-danger focus:ring-danger/30" : ""}`}
                value={city}
                onChange={e => { setCity(e.target.value); if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: "" }); }}
                placeholder="Lucknow"
              />
            </Field>
          </div>

          <Field label="Symptom onset" error={fieldErrors.onsetAt} hint="When did the problem start? Within the past week.">
            <input
              type="datetime-local"
              className={`input ${fieldErrors.onsetAt ? "border-danger focus:ring-danger/30" : ""}`}
              value={onsetAt}
              onChange={e => { setOnsetAt(e.target.value); if (fieldErrors.onsetAt) setFieldErrors({ ...fieldErrors, onsetAt: "" }); }}
              max={toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000))}
            />
          </Field>

          <Field label="Describe the emergency" error={fieldErrors.description}>
            <textarea
              className={`input min-h-[110px] ${fieldErrors.description ? "border-danger focus:ring-danger/30" : ""}`}
              value={description}
              onChange={e => { setDescription(e.target.value); if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: "" }); }}
              placeholder="Chest pain, sweating, BP 160/100, diabetic…"
            />
          </Field>

          <div>
            <div className="label mb-1.5">Vulnerabilities (if any)</div>
            <VulnerabilityChips value={flags} onChange={setFlags} />
          </div>

          {err && (
            <div className="rounded-md bg-dangerLight border border-danger/30 text-danger text-sm px-3 py-2">
              {err}
            </div>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <><span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
            ) : (
              "Submit request"
            )}
          </button>
        </form>
      </div>

      <button onClick={() => navigate(-1)} className="btn-ghost w-full text-xs">← Cancel</button>
    </div>
  );
}

function Field({
  label, error, hint, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      {children}
      {error ? (
        <div className="text-[11px] text-danger mt-1">{error}</div>
      ) : hint ? (
        <div className="text-[11px] text-muted mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
