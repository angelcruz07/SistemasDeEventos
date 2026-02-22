"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AlertCircle, Check, Loader2, User, Lock } from "lucide-react";

interface SettingsFormProps {
  user: {
    name: string;
    email: string;
  };
}

export function SettingsForm({ user }: SettingsFormProps) {
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    setNameError(null);
    setNameSuccess(false);

    const { error } = await authClient.updateUser({ name });

    if (error) {
      setNameError(error.message ?? "Error al actualizar");
    } else {
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    }
    setSavingName(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
    });

    if (error) {
      setPasswordError(error.message ?? "Error al cambiar contraseña");
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4" />
            Perfil
          </CardTitle>
          <CardDescription>Actualiza tu información personal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateName} className="space-y-4">
            {nameError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{nameError}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="settings-email">Correo electrónico</Label>
              <Input
                id="settings-email"
                value={user.email}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                El correo no se puede cambiar
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-name">Nombre</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                required
                minLength={2}
              />
            </div>
            <Button type="submit" disabled={savingName || name === user.name}>
              {savingName ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : nameSuccess ? (
                <>
                  <Check className="size-4" />
                  Guardado
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" />
            Contraseña
          </CardTitle>
          <CardDescription>Cambia tu contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña actual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword}
            >
              {savingPassword ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cambiando...
                </>
              ) : passwordSuccess ? (
                <>
                  <Check className="size-4" />
                  Contraseña cambiada
                </>
              ) : (
                "Cambiar contraseña"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
