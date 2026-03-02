"use client";

import Script from "next/script";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Carga el script de Google Maps con la librería Places para usar
 * autocompletado de direcciones en el formulario de eventos.
 * Solo renderiza el script si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY está definida.
 */
export function GoogleMapsScript() {
  if (!API_KEY?.trim()) return null;

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=es`}
      strategy="afterInteractive"
    />
  );
}
