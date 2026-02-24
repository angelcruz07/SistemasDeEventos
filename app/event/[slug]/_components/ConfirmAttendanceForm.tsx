"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAttendance } from "@/app/dashboard/events/_actions/event.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CheckCircle2 } from "lucide-react";

interface ConfirmAttendanceFormProps {
  eventSlug: string;
  eventTitle: string;
}

export function ConfirmAttendanceForm({ eventSlug, eventTitle }: ConfirmAttendanceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    numberOfGuests: "1",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await confirmAttendance(eventSlug, {
      guestName: formData.guestName,
      guestEmail: formData.guestEmail,
      numberOfGuests: parseInt(formData.numberOfGuests, 10) || 1,
    });

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setFormData({ guestName: "", guestEmail: "", numberOfGuests: "1" });
      router.refresh();
    } else {
      setError(result.error ?? "Error al confirmar.");
    }
  };

  if (success) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="rounded-full bg-green-500/20 p-3">
              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">¡Asistencia confirmada!</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Nos vemos en &quot;{eventTitle}&quot;. Revisa tu correo si te enviamos más detalles.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuccess(false)}
              className="mt-2"
            >
              Confirmar otra asistencia
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-5 text-muted-foreground" />
          <CardTitle className="text-base sm:text-lg">Confirmar asistencia</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Indica tu nombre, correo y número de acompañantes para confirmar que asistirás al evento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="guestName">Nombre completo</Label>
            <Input
              id="guestName"
              type="text"
              placeholder="Ej: María García"
              value={formData.guestName}
              onChange={(e) => setFormData((p) => ({ ...p, guestName: e.target.value }))}
              required
              minLength={2}
              className="min-h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guestEmail">Correo electrónico</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder="ejemplo@correo.com"
              value={formData.guestEmail}
              onChange={(e) => setFormData((p) => ({ ...p, guestEmail: e.target.value }))}
              required
              className="min-h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numberOfGuests">Número de personas (incluyéndote)</Label>
            <Input
              id="numberOfGuests"
              type="number"
              min={1}
              max={50}
              value={formData.numberOfGuests}
              onChange={(e) => setFormData((p) => ({ ...p, numberOfGuests: e.target.value }))}
              className="min-h-10"
            />
          </div>
          <Button
            type="submit"
            className="w-full min-h-10"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Confirmar mi asistencia"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
