import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import type { ToastState } from "../lib/appTypes";

export function AppToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(
      onDismiss,
      toast.kind === "error" ? 6500 : 3600,
    );
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const icon =
    toast.kind === "success" ? (
      <CheckCircle2 size={18} />
    ) : (
      <AlertCircle size={18} />
    );

  return (
    <div
      className="toast-region"
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div
        key={toast.id}
        className={`app-toast ${toast.kind}`}
        role={toast.kind === "error" ? "alert" : "status"}
      >
        <span className="toast-icon">{icon}</span>
        <div>
          <strong>{toast.title}</strong>
          {toast.message ? <p>{toast.message}</p> : null}
        </div>
        <button
          className="toast-close"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
