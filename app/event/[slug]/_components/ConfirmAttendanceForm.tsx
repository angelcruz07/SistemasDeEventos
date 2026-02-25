"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAttendance } from "@/app/dashboard/events/_actions/event.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmAttendanceFormProps {
  eventSlug: string;
  eventTitle: string;
}

export function ConfirmAttendanceForm({ eventSlug, eventTitle }: ConfirmAttendanceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastResponseType, setLastResponseType] = useState<"confirmed" | "maybe" | "declined">("confirmed");
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    numberOfGuests: "1",
    responseType: "confirmed" as "confirmed" | "maybe" | "declined",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await confirmAttendance(eventSlug, {
      guestName: formData.guestName,
      guestEmail: formData.guestEmail,
      numberOfGuests: parseInt(formData.numberOfGuests, 10) || 1,
      responseType: formData.responseType,
    });

    setLoading(false);

    if (result.success) {
      setLastResponseType(formData.responseType);
      setSuccess(true);
      setFormData({ guestName: "", guestEmail: "", numberOfGuests: "1", responseType: "confirmed" });
      router.refresh();
    } else {
      setError(result.error ?? "Error al confirmar.");
    }
  };

  if (success) {
    const wasMaybe = lastResponseType === "maybe";
    const wasDeclined = lastResponseType === "declined";
    return (
      <Card className={cn(
        wasDeclined ? "border-muted bg-muted/10" : "border-green-500/30 bg-green-500/5"
      )}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={cn(
              "rounded-full p-3",
              wasDeclined ? "bg-muted" : "bg-green-500/20"
            )}>
              <CheckCircle2 className={cn(
                "size-8",
                wasDeclined ? "text-muted-foreground" : "text-green-600 dark:text-green-400"
              )} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {wasDeclined ? "Respuesta registrada" : wasMaybe ? "¡Registro recibido!" : "¡Asistencia confirmada!"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {wasDeclined
                  ? `Tu respuesta &quot;No asistiré&quot; para &quot;${eventTitle}&quot; ha quedado registrada.`
                  : wasMaybe
                    ? `Tu respuesta &quot;Tal vez asista&quot; para &quot;${eventTitle}&quot; ha quedado registrada.`
                    : `Nos vemos en &quot;${eventTitle}&quot;. Revisa tu correo si te enviamos más detalles.`}
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
          Indica tu nombre, correo y si asistirás, tal vez asistas o no asistirás. Opcionalmente, el número de acompañantes.
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
            <Label>¿Asistirás al evento?</Label>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="responseType"
                  value="confirmed"
                  checked={formData.responseType === "confirmed"}
                  onChange={() => setFormData((p) => ({ ...p, responseType: "confirmed" }))}
                  className="rounded-full border-input"
                />
                <span className="text-sm font-medium">Asistiré</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="responseType"
                  value="maybe"
                  checked={formData.responseType === "maybe"}
                  onChange={() => setFormData((p) => ({ ...p, responseType: "maybe" }))}
                  className="rounded-full border-input"
                />
                <span className="text-sm font-medium">Tal vez asista</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="responseType"
                  value="declined"
                  checked={formData.responseType === "declined"}
                  onChange={() => setFormData((p) => ({ ...p, responseType: "declined" }))}
                  className="rounded-full border-input"
                />
                <span className="text-sm font-medium">No asistiré</span>
              </label>
            </div>
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
            {loading ? "Enviando..." : formData.responseType === "declined" ? "Enviar (no asistiré)" : formData.responseType === "maybe" ? "Enviar (tal vez asista)" : "Confirmar mi asistencia"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
