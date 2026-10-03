'use client';

import NextImage from 'next/image';
import { useState } from 'react';

/**
 * Grafika główna materiału.
 *
 * Dwie drogi, bo mamy dwa rodzaje adresów:
 *
 *  • `/uploads/...` — nasz plik. Idzie przez next/image, więc dostaje
 *    zmniejszanie i format dopasowany do przeglądarki.
 *  • wszystko inne — adres wklejony przez redakcję. Tu next/image ODMAWIA,
 *    dopóki domena nie stoi w `remotePatterns`, a redaktor wkleja adresy
 *    z serwisów, których nie da się z góry wyliczyć. Zwykły <img> pokaże
 *    każdy z nich; tracimy optymalizację, ale grafika w ogóle się pojawia.
 *
 * Adres, który nie jest publiczny (a tak bywa z odnośnikami kopiowanymi
 * z czatów asystentów), i tak się nie wczyta — wtedy chowamy całą ramkę,
 * zamiast zostawiać pusty prostokąt nad tekstem.
 */
export function CoverImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  const local = src.startsWith('/uploads');

  return (
    <div className="relative mt-4 w-full overflow-hidden rounded-lg border border-line bg-surface-sunken">
      {local ? (
        <div className="relative aspect-video w-full">
          <NextImage
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 768px, 100vw"
            priority
            onError={() => setFailed(true)}
            className="object-cover"
          />
        </div>
      ) : (
        // Bez `aspect-video`: grafika z zewnątrz bywa schematem albo zrzutem
        // ekranu o zupełnie innych proporcjach, a przycięcie do formatu
        // filmowego ucina zwykle to, co miała pokazać.
        <img
          src={src}
          alt={alt}
          loading="eager"
          onError={() => setFailed(true)}
          className="max-h-[28rem] w-full object-contain"
        />
      )}
    </div>
  );
}
