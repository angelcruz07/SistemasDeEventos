"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchTickets, type DoorLookupEntry } from "../_actions/door.actions";

/** Search by name or short code within the event (always visible, works without a camera). */
export function TicketSearch({
  doorKey,
  onResults,
}: {
  doorKey: string;
  onResults: (entries: DoorLookupEntry[], message: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await searchTickets(doorKey, query);
    setLoading(false);
    if (!result.success) return onResults([], result.error);
    onResults(result.entries, result.entries.length === 0 ? "Sin resultados" : null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor="door-search">Buscar por nombre o código</Label>
      <div className="flex gap-2">
        <Input
          id="door-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          autoComplete="off"
          className="h-12 text-base"
        />
        <Button type="submit" disabled={loading || query.trim().length < 2} className="h-12 px-5">
          {loading ? <Loader2 className="size-5 animate-spin" /> : "Buscar"}
        </Button>
      </div>
    </form>
  );
}
