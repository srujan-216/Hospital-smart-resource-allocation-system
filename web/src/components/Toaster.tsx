import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Info, X } from "lucide-react";
import { onToast, type Toast } from "../lib/toast";

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    return onToast(t => {
      setItems(cur => [...cur, t]);
      const ms = t.durationMs ?? 4000;
      setTimeout(() => {
        setItems(cur => cur.filter(x => x.id !== t.id));
      }, ms);
    });
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-[100] space-y-2 max-w-sm w-[calc(100vw-2rem)] sm:w-[360px] pointer-events-none">
      {items.map(t => <ToastCard key={t.id} t={t} onDismiss={() => setItems(cur => cur.filter(x => x.id !== t.id))} />)}
    </div>
  );
}

function ToastCard({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const theme = {
    info:    { icon: <Info className="w-4 h-4" />,            wrap: "bg-infoLight border-info/30 text-info" },
    success: { icon: <CheckCircle2 className="w-4 h-4" />,    wrap: "bg-successLight border-success/30 text-success" },
    warn:    { icon: <ArrowRightLeft className="w-4 h-4" />,  wrap: "bg-warnLight border-warn/30 text-warn" },
    danger:  { icon: <AlertTriangle className="w-4 h-4" />,   wrap: "bg-dangerLight border-danger/30 text-danger" },
  }[t.type];

  return (
    <div
      className={`toast-in pointer-events-auto rounded-xl border ${theme.wrap} px-3 py-2.5 shadow-pop backdrop-blur-sm bg-opacity-95`}
      role="status"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{theme.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[13px] leading-tight">{t.title}</div>
          {t.body && <div className="text-[12px] text-inkMuted mt-1 leading-snug">{t.body}</div>}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-inkMuted/70 hover:text-ink transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
