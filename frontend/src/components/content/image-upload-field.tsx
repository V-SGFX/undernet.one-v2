'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/api-url';

/**
 * Pole grafiki: wgranie pliku albo wklejenie adresu.
 *
 * Wcześniej było tu wyłącznie pole tekstowe na adres. Wymuszało to
 * wklejanie odnośników z obcych serwisów, a te albo wygasają, albo —
 * jak adresy z copilot.microsoft.com — w ogóle nie są publiczne i kafelek
 * zostaje pusty. Wgrany plik leży na naszym serwerze i zawsze się wyświetli.
 *
 * Adres zostaje jako druga droga: czasem grafika naprawdę mieszka gdzie
 * indziej i chce się do niej odesłać, zamiast kopiować.
 */
/**
 * Powód niepowodzenia, powiedziany po ludzku.
 *
 * Wcześniej każdy błąd kończył się jednym „Nie udało się wgrać pliku",
 * więc nie dało się odróżnić za dużego zdjęcia od złego formatu ani od
 * wygasłej sesji. Najczęstszy przypadek — plik ponad limit — nie mówił
 * nawet, jaki ten limit jest.
 */
export function uploadError(e: any): string {
  const status = e?.response?.status;
  const message = e?.response?.data?.message;

  if (status === 413) return 'Plik jest za duży. Maksymalnie 8 MB.';
  if (status === 401) return 'Sesja wygasła. Zaloguj się ponownie.';
  if (status === 403) return 'To konto nie może wgrywać plików.';
  if (typeof message === 'string' && message.includes('JPEG')) {
    return 'Dozwolone formaty: JPEG, PNG, WebP i GIF.';
  }
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('. ');
  return 'Nie udało się wgrać pliku. Spróbuj ponownie.';
}

export function ImageUploadField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
    } catch (e: any) {
      setError(uploadError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Wgraj plik albo wklej adres…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-content-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {busy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
          {busy ? 'Wgrywam…' : 'Wgraj'}
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Usuń grafikę"
            className="inline-flex shrink-0 items-center rounded-lg border border-line px-2 text-content-muted transition-colors hover:border-rose-500/40 hover:text-rose-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) send(f);
          e.target.value = '';
        }}
      />

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {value && (
        // Podgląd zwykłym <img>, nie next/image: adres bywa zewnętrzny,
        // a wtedy next/image wymaga wpisania domeny do konfiguracji
        // i wywala się na każdej, której tam nie ma.
        <img
          src={mediaUrl(value)}
          alt=""
          className="max-h-40 w-full rounded-lg border border-line object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}
