/**
 * Tiny pub-sub toast system. No context, no provider — just a function you call
 * from anywhere and a <Toaster/> component you mount once.
 */
export type ToastType = "info" | "success" | "warn" | "danger";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
  durationMs?: number;
}

type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();
let counter = 0;

export function toast(type: ToastType, title: string, body?: string, durationMs = 4000) {
  const t: Toast = { id: `t_${++counter}_${Date.now()}`, type, title, body, durationMs };
  for (const l of listeners) l(t);
  return t.id;
}

export function onToast(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
