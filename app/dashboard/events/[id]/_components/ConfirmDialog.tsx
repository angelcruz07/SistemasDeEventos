"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "default" | "success" | "destructive";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Main explanation of what will happen. */
  description: React.ReactNode;
  /** Optional summary rows (e.g. name, amount) shown in a box above the buttons. */
  details?: Array<{ label: string; value: string }>;
  confirmLabel: string;
  /** Label while the action runs, e.g. "Borrando…". */
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ICONS: Record<ConfirmTone, React.ReactNode> = {
  default: null,
  success: <CircleCheck className="size-5 text-green-600" aria-hidden />,
  destructive: <TriangleAlert className="size-5 text-destructive" aria-hidden />,
};

const ICON_BG: Record<ConfirmTone, string> = {
  default: "",
  success: "bg-green-100 dark:bg-green-950/50",
  destructive: "bg-destructive/10",
};

/**
 * Confirmation modal used instead of window.confirm. Closes with Escape or a click outside
 * (not while the action runs); errors stay inside the modal so the user can retry.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Volver",
  tone = "default",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0"
      role="presentation"
      onClick={pending ? undefined : onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-lg sm:p-6 animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {ICONS[tone] && (
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", ICON_BG[tone])}>
              {ICONS[tone]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold sm:text-lg">
              {title}
            </h2>
            <div id="confirm-dialog-description" className="mt-1.5 text-sm text-muted-foreground break-words">
              {description}
            </div>
          </div>
        </div>

        {details && details.length > 0 && (
          <dl className="mt-4 divide-y rounded-md border bg-muted/40 text-sm">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="min-w-0 text-right font-medium break-words">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            className={cn(
              "min-h-10 w-full sm:w-auto",
              tone === "success" && "bg-green-600 text-white hover:bg-green-700",
            )}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (pendingLabel ?? "Procesando…") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
