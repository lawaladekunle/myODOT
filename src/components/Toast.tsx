import { useEffect } from "react";
import { cx } from "./ui";

export type ToastState = { id: number; text: string; tone?: "error"; action?: { label: string; run: () => void } };

export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.action ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          className={cx(
            "pointer-events-auto flex max-w-xl animate-[odot-pop_.18s_ease-out] items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg",
            toast.tone === "error" ? "border border-hot-ink/30 bg-hot-soft text-hot-ink" : "bg-ink text-ink-fg",
          )}
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-4"
              onClick={() => {
                toast.action!.run();
                onDone();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
