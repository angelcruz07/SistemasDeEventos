"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortCode } from "@/lib/ticketing/short-code";
import { createWalkIn } from "../_actions/door.actions";

export function WalkInForm({ doorKey }: { doorKey: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setError(null);
    setFieldErrors({});
    setCreated(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    const result = await createWalkIn(doorKey, { name, email, phone });
    setLoading(false);
    if (result.success) {
      setCreated({ name: result.ticket.name, code: result.ticket.code });
      return;
    }
    if (result.code === "SESSION_EXPIRED") router.refresh();
    setError(result.error);
    setFieldErrors(result.fieldErrors ?? {});
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-12 w-full">
        Registrar pago en efectivo
      </Button>
    );
  }

  if (created) {
    return (
      <section className="space-y-3 rounded-xl border-2 border-green-600 bg-green-50 p-4 text-center text-green-900">
        <p className="text-2xl font-extrabold">ACCESO PERMITIDO</p>
        <p className="font-semibold break-words">{created.name}</p>
        <p className="font-mono text-lg tracking-widest">{formatShortCode(created.code)}</p>
        <Button type="button" onClick={reset} className="h-12 w-full">
          Registrar otro
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">Pago en efectivo en puerta</h2>
      <div className="space-y-1">
        <Label htmlFor="walkin-name">Nombre</Label>
        <Input id="walkin-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="h-12 text-base" />
        {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="walkin-email">Correo (opcional)</Label>
        <Input id="walkin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} className="h-12 text-base" />
        {fieldErrors.email && <p className="text-sm text-destructive">{fieldErrors.email}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="walkin-phone">Teléfono (opcional)</Label>
        <Input id="walkin-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="h-12 text-base" />
        {fieldErrors.phone && <p className="text-sm text-destructive">{fieldErrors.phone}</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="h-12 flex-1"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="h-12 flex-1">
          {loading ? <Loader2 className="size-5 animate-spin" /> : "Registrar y dar acceso"}
        </Button>
      </div>
    </form>
  );
}
