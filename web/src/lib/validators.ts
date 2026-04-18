/**
 * Form validators used across the app. Kept tiny and dependency-free.
 *
 *  - Indian phone numbers: accept +91 (optional), with optional space/dash,
 *    followed by a 10-digit number starting with 6–9 (the only valid
 *    leading digits for Indian mobile numbers).
 *  - Dates: must parse as a real Date and fall within a hospital-realistic
 *    window (not in the far past, not in the far future).
 */

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const PHONE_RE = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/;

export function normalisePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

export function validatePhone(raw: string): ValidationResult {
  if (!raw || !raw.trim()) return { ok: false, error: "Phone is required." };
  const cleaned = normalisePhone(raw);
  if (!PHONE_RE.test(cleaned)) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number (optionally prefixed with +91)." };
  }
  return { ok: true };
}

export function validateName(raw: string): ValidationResult {
  const v = raw.trim();
  if (v.length < 2) return { ok: false, error: "Name must be at least 2 characters." };
  if (v.length > 80) return { ok: false, error: "Name is too long (max 80 characters)." };
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(v)) return { ok: false, error: "Name contains invalid characters." };
  return { ok: true };
}

export function validateCity(raw: string): ValidationResult {
  const v = raw.trim();
  if (v.length < 2) return { ok: false, error: "City is required." };
  if (v.length > 60) return { ok: false, error: "City name is too long." };
  return { ok: true };
}

export function validateDescription(raw: string): ValidationResult {
  const v = raw.trim();
  if (v.length < 3) return { ok: false, error: "Describe the situation in at least 3 characters." };
  if (v.length > 1000) return { ok: false, error: "Description is too long (max 1000 characters)." };
  return { ok: true };
}

/**
 * Validate a datetime-local or ISO string against a sensible hospital window.
 * Defaults: not earlier than 30 days ago, not later than 24 hours from now.
 */
export function validateDate(
  raw: string,
  opts: { maxDaysAgo?: number; maxHoursAhead?: number; fieldLabel?: string } = {},
): ValidationResult {
  const { maxDaysAgo = 30, maxHoursAhead = 24, fieldLabel = "Date" } = opts;
  if (!raw) return { ok: false, error: `${fieldLabel} is required.` };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { ok: false, error: `${fieldLabel} is not a valid date.` };
  const now = Date.now();
  if (d.getTime() < now - maxDaysAgo * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `${fieldLabel} is too far in the past (limit ${maxDaysAgo} days).` };
  }
  if (d.getTime() > now + maxHoursAhead * 60 * 60 * 1000) {
    return { ok: false, error: `${fieldLabel} cannot be more than ${maxHoursAhead}h in the future.` };
  }
  return { ok: true };
}

/** Pre-fills an `<input type="datetime-local">` value from a Date. */
export function toDateTimeLocalValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
