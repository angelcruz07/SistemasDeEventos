"use client";

import { useState } from "react";
import { updateUserRole } from "../_actions/user.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ShieldCheck, Calendar, Loader2 } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  eventCount: number;
}

interface UsersTableProps {
  users: UserRow[];
  currentUserId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function UsersTable({ users: initialUsers, currentUserId }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setLoadingId(userId);

    const result = await updateUserRole(userId, newRole);

    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } else {
      alert(result.error ?? "Error al actualizar rol");
    }

    setLoadingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
      </div>

      <div className="grid gap-3">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const isAdmin = user.role === "admin";

          return (
            <Card key={user.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      {isCurrentUser && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium shrink-0">
                          Tú
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {user.eventCount} evento{user.eventCount !== 1 ? "s" : ""}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isAdmin ? (
                      <ShieldCheck className="size-3.5 text-primary" />
                    ) : (
                      <Shield className="size-3.5 text-muted-foreground" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        isAdmin ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {isAdmin ? "Admin" : "Usuario"}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {formatDate(user.createdAt)}
                  </div>

                  {!isCurrentUser && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleToggleRole(user.id, user.role)}
                      disabled={loadingId === user.id}
                    >
                      {loadingId === user.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isAdmin ? (
                        "Quitar admin"
                      ) : (
                        "Hacer admin"
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
