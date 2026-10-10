"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextIndex, prevIndex, shouldAutoplay } from "@/lib/ticketing/event-images";

const AUTOPLAY_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true); // safe default until measured
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    update();
    onVisibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing = shouldAutoplay({ count, hovered, focused, hidden, reducedMotion });

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex((i) => nextIndex(i, count)), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, count]);

  if (count === 0) {
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <Calendar className="size-16 sm:size-20 text-muted-foreground/50" />
      </div>
    );
  }

  const current = Math.min(index, count - 1);

  const onTouchEnd = (clientX: number) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || count < 2) return;
    const delta = clientX - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    setIndex(delta < 0 ? nextIndex(current, count) : prevIndex(current, count));
  };

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={`Imágenes de ${alt}`}
      className="relative aspect-video rounded-lg overflow-hidden bg-muted text-foreground"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => onTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
    >
      {images.map((url, i) => (
        <Image
          key={url}
          src={url}
          alt={i === current ? alt : ""}
          aria-hidden={i !== current}
          fill
          sizes="(min-width: 768px) 560px, 100vw"
          priority={i === 0}
          className={cn(
            "object-cover transition-opacity duration-500 motion-reduce:transition-none",
            i === current ? "opacity-100" : "opacity-0"
          )}
        />
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={() => setIndex(prevIndex(current, count))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground shadow hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={() => setIndex(nextIndex(current, count))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-1.5 text-foreground shadow hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-background/70 px-2 py-1">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={`Ir a la imagen ${i + 1} de ${count}`}
                aria-current={i === current}
                onClick={() => setIndex(i)}
                className={cn(
                  "size-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === current ? "bg-foreground" : "bg-foreground/30"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
