"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isRepeatScan } from "@/lib/ticketing/checkin";

const QrScanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-muted-foreground">Iniciando cámara…</p>,
});

const REPEAT_WINDOW_MS = 3000;
const CAMERA_UNAVAILABLE =
  "No se pudo usar la cámara. Permite el acceso a la cámara en tu navegador (requiere HTTPS) o usa la búsqueda manual.";

export function Scanner({ onDetect, paused }: { onDetect: (value: string) => void; paused?: boolean }) {
  const last = useRef<{ value: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
        {error}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <QrScanner
        paused={paused}
        formats={["qr_code"]}
        constraints={{ facingMode: "environment" }}
        onError={() => setError(CAMERA_UNAVAILABLE)}
        onScan={(codes) => {
          const value = codes[0]?.rawValue;
          if (!value) return;
          const now = Date.now();
          if (isRepeatScan(last.current, value, now, REPEAT_WINDOW_MS)) return;
          last.current = { value, at: now };
          onDetect(value);
        }}
      />
    </div>
  );
}
