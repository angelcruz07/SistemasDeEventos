"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareEventButton({ title, path }: { title: string; path?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // An explicit path lets other pages share the public event URL instead of their own (possibly secret) URL.
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The user dismissing the share sheet is not an error; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace del evento", url);
    }
  };

  return (
    <Button type="button" variant="outline" className="w-full min-h-10" onClick={handleShare}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Enlace copiado" : "Compartir evento"}
    </Button>
  );
}
