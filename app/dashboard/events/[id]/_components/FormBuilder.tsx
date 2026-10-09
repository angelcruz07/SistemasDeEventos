"use client";

import { useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Check, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FIELD_TYPES, type FieldType, type FormField } from "@/lib/ticketing/form-schema";
import { generateFieldId, moveItem } from "@/lib/ticketing/form-builder";
import { updateFormSchema } from "../_actions/ticketing.actions";

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  select: "Lista de opciones",
  checkbox: "Casilla",
  number: "Número",
  phone: "Teléfono",
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function validateLocally(fields: FormField[]): string | null {
  for (const field of fields) {
    if (!field.label.trim()) return "Todos los campos necesitan una etiqueta.";
    if (field.type === "select" && !(field.options ?? []).some((o) => o.trim())) {
      return `Agrega al menos una opción a "${field.label}".`;
    }
  }
  return null;
}

export function FormBuilder({ eventId, initialFields }: { eventId: string; initialFields: FormField[] }) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [newType, setNewType] = useState<FieldType>("text");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    setSaved(false);
  };

  const addField = () => {
    const label = TYPE_LABELS[newType];
    const id = generateFieldId(label, new Set(fields.map((f) => f.id)));
    const field: FormField = {
      id,
      type: newType,
      label,
      required: false,
      ...(newType === "select" ? { options: [] } : {}),
    };
    setFields((prev) => [...prev, field]);
    setSaved(false);
  };

  const changeType = (index: number, type: FieldType) => {
    update(index, { type, options: type === "select" ? (fields[index].options ?? []) : undefined });
  };

  const handleSave = async () => {
    const localError = validateLocally(fields);
    if (localError) {
      setError(localError);
      return;
    }
    setSaving(true);
    setError(null);
    const cleaned = fields.map((f) => {
      const { options, ...rest } = f;
      return {
        ...rest,
        label: f.label.trim(),
        ...(f.type === "select" ? { options: (options ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
      };
    });
    const result = await updateFormSchema(eventId, { version: 1, fields: cleaned });
    if (result.success) {
      setFields(cleaned);
      setSaved(true);
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Formulario de registro</CardTitle>
          <CardDescription>
            Nombre y correo siempre se piden. Los campos que ya tienen respuestas no se pueden eliminar ni cambiar de
            tipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {["Nombre completo", "Correo electrónico"].map((label) => (
            <div key={label} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <Lock className="size-4 text-muted-foreground" />
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">(obligatorio, fijo)</span>
            </div>
          ))}

          {fields.map((field, index) => (
            <div key={field.id} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`label-${field.id}`}>Etiqueta</Label>
                  <Input
                    id={`label-${field.id}`}
                    value={field.label}
                    onChange={(e) => update(index, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`type-${field.id}`}>Tipo</Label>
                  <select
                    id={`type-${field.id}`}
                    className={selectClass}
                    value={field.type}
                    onChange={(e) => changeType(index, e.target.value as FieldType)}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {field.type === "select" && (
                <div className="space-y-1">
                  <Label htmlFor={`options-${field.id}`}>Opciones (una por línea)</Label>
                  <textarea
                    id={`options-${field.id}`}
                    rows={3}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={(field.options ?? []).join("\n")}
                    onChange={(e) => update(index, { options: e.target.value.split("\n") })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={field.required}
                    onChange={(e) => update(index, { required: e.target.checked })}
                  />
                  Obligatorio
                </label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Subir campo"
                    disabled={index === 0}
                    onClick={() => setFields((prev) => moveItem(prev, index, index - 1))}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Bajar campo"
                    disabled={index === fields.length - 1}
                    onClick={() => setFields((prev) => moveItem(prev, index, index + 1))}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar campo"
                    onClick={() => {
                      setFields((prev) => prev.filter((_, i) => i !== index));
                      setSaved(false);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <select
              aria-label="Tipo de campo nuevo"
              className={selectClass}
              value={newType}
              onChange={(e) => setNewType(e.target.value as FieldType)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={addField}>
              <Plus className="size-4" />
              Agregar campo
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="size-4" />
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar formulario
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="size-4" />
            Guardado
          </span>
        )}
      </div>
    </div>
  );
}
