"use client";

import { useState } from "react";
import { lookupTicket, type DoorLookupEntry } from "../_actions/door.actions";
import { CheckInCard } from "./CheckInCard";
import { Scanner } from "./Scanner";
import { TicketSearch } from "./TicketSearch";
import { WalkInForm } from "./WalkInForm";

export function DoorConsole({ doorKey, allowCash }: { doorKey: string; allowCash: boolean }) {
  const [entries, setEntries] = useState<DoorLookupEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<DoorLookupEntry | null>(null);
  // Bumped to remount the card so each lookup starts from a clean state.
  const [nonce, setNonce] = useState(0);

  const show = (list: DoorLookupEntry[], msg: string | null) => {
    setEntries(list);
    setMessage(msg);
    setSelected(list.length === 1 ? list[0] : null);
    setNonce((n) => n + 1);
  };

  const handleScan = async (value: string) => {
    const result = await lookupTicket(doorKey, value);
    if (result.success) show(result.entries, null);
    else show([], result.error);
  };

  return (
    <div className="space-y-4">
      <Scanner onDetect={handleScan} paused={selected !== null} />
      <TicketSearch doorKey={doorKey} onResults={show} />
      {message && (
        <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-center font-semibold text-red-900">
          {message}
        </p>
      )}
      {!selected && entries.length > 1 && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.ticket.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(entry);
                  setNonce((n) => n + 1);
                }}
                className="h-14 w-full rounded-lg border px-4 text-left text-base font-medium"
              >
                {entry.ticket.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <CheckInCard
          key={`${selected.ticket.id}-${nonce}`}
          doorKey={doorKey}
          ticket={selected.ticket}
          decision={selected.decision}
          onDone={() => show([], null)}
        />
      )}
      {allowCash && <WalkInForm doorKey={doorKey} />}
    </div>
  );
}
