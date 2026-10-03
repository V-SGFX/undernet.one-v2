import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Unieważnienie stron na żądanie.
 *
 * Strony materiałów renderują się z pamięci podręcznej odświeżanej co
 * 300 sekund. To dobre dla czytelnika i dla bazy, ale fatalne dla redakcji:
 * po zapisie zmiany przez pięć minut widać STARĄ treść i starą kategorię,
 * co wygląda dokładnie jak „nie zapisało się".
 *
 * Backend woła ten adres po każdym zapisie i po każdej zmianie etapu.
 * Sekret jest wymagany — bez niego dowolny odwiedzający mógłby kasować
 * pamięć podręczną w pętli i zamienić ją w generator zapytań do bazy.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // Brak sekretu w konfiguracji = funkcja wyłączona. Lepiej nie działać
  // niż działać dla wszystkich.
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }
  if (req.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
  const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];

  const doneP: string[] = [];
  for (const path of paths) {
    // Tylko ścieżki względne z naszego serwisu.
    if (typeof path !== 'string' || !path.startsWith('/')) continue;
    revalidatePath(path);
    doneP.push(path);
  }

  /*
   * Znaczniki są tu ważniejsze od ścieżek.
   *
   * `revalidatePath` czyści pamięć STRON. Odpowiedzi z API mają WŁASNĄ
   * pamięć, kluczowaną adresem i żyjącą swoje 300 sekund — po zmianie
   * rodzaju materiału regeneracja strony sięgała po starą odpowiedź
   * i odtwarzała nieaktualną stronę pod poprzednim adresem.
   * `revalidateTag` usuwa również ją.
   */
  const doneT: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag) continue;
    // Next 16 wymaga profilu życia cache. `max` = unieważnij wszystko,
    // co nosi ten znacznik, niezależnie od tego, jak długo miało żyć.
    revalidateTag(tag, 'max');
    doneT.push(tag);
  }

  return NextResponse.json({ ok: true, paths: doneP, tags: doneT });
}
