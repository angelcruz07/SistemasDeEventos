"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockDoor } from "../_actions/door.actions";

export function PinForm({ doorKey }: { doorKey: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await unlockDoor(doorKey, pin, name);
    if (result.success) {
      router.refresh();
      return;
    }
    setError(result.error);
    setPin("");
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="staff-name">Tu nombre</Label>
        <Input
          id="staff-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="door-pin">PIN de 6 dígitos</Label>
        <Input
          id="door-pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          className="text-center text-xl tracking-widest"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || pin.length !== 6 || !name.trim()}>
        {loading && <Loader2 className="size-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}
