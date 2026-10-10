import type { Event as PrismaEvent } from "@/app/generated/prisma/client";

/** Event row plus its gallery (ordered by position; the first image is the cover). */
export type EventWithImages = PrismaEvent & { images: { url: string }[] };

export const IMAGES_INCLUDE = {
  images: { select: { url: true }, orderBy: { position: "asc" as const } },
};
