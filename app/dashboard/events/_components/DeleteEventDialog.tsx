"use client";

import { Button } from "@/components/ui/button";

interface DeleteEventDialogProps {
  open: boolean;
  eventTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteEventDialog({
  open,
  eventTitle,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteEventDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="bg-card text-card-foreground w-full max-w-sm rounded-lg border p-4 sm:p-6 shadow-lg mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-dialog-title" className="text-base sm:text-lg font-semibold">
          ¿Eliminar evento?
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground break-words">
          {eventTitle ? (
            <>
              ¿Estás seguro de que deseas eliminar &quot;{eventTitle}&quot;? Esta acción no se puede deshacer.
            </>
          ) : (
            <>¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.</>
          )}
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto min-h-10"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto min-h-10"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
