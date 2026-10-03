/**
 * Wczytywanie przygotowanych haseł wiki i poradników.
 *
 * Skrypt jest IDEMPOTENTNY: kluczem jest slug w obrębie typu, więc
 * ponowne uruchomienie aktualizuje wpis zamiast zakładać drugi. Bez tego
 * każde poprawienie literówki w pliku źródłowym mnożyłoby materiały.
 *
 * Uruchomienie:
 *   node scripts/tresci/wczytaj.mjs           — wczytaj wszystko
 *   node scripts/tresci/wczytaj.mjs --sucho   — pokaż, co by zrobił
 */
import { PrismaClient } from '@prisma/client';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const prisma = new PrismaClient();
const KATALOG = dirname(fileURLToPath(import.meta.url));
const SUCHO = process.argv.includes('--sucho');

/** Ta sama funkcja co w ContentService — adresy muszą się zgadzać. */
function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'material';
}

/** Też jak w serwisie: 200 słów na minutę, minimum jedna. */
function czasCzytania(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function main() {
  const pliki = (await readdir(KATALOG))
    .filter((f) => /^(wiki|howto)-\d+\.mjs$/.test(f))
    .sort();

  if (pliki.length === 0) {
    console.log('Brak plików z treścią.');
    return;
  }

  const kategorie = Object.fromEntries(
    (await prisma.contentCategory.findMany({ select: { id: true, slug: true } }))
      .map((c) => [c.slug, c.id]),
  );
  const autor = await prisma.author.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!autor) throw new Error('Brak profilu autora — załóż go przed wczytaniem.');

  let nowych = 0, zmienionych = 0, pominietych = 0;
  const uzyteSlugi = new Set();

  for (const plik of pliki) {
    const { default: wpisy } = await import(pathToFileURL(join(KATALOG, plik)).href);
    const typ = plik.startsWith('wiki') ? 'WIKI' : 'HOWTO';

    for (const w of wpisy) {
      const slug = slugify(w.title);
      const klucz = `${typ}:${slug}`;

      // Kolizja slugów w obrębie typu jest błędem w materiale, nie czymś
      // do obejścia przyrostkiem: dwa hasła o tym samym adresie znaczą,
      // że dwa razy opisaliśmy to samo.
      if (uzyteSlugi.has(klucz)) {
        console.log(`  ! POWTÓRZONY ADRES: ${klucz} (${plik})`);
        pominietych += 1;
        continue;
      }
      uzyteSlugi.add(klucz);

      const categoryId = kategorie[w.kat];
      if (!categoryId) throw new Error(`Nieznana kategoria "${w.kat}" przy "${w.title}"`);

      const dane = {
        type: typ,
        status: 'PUBLISHED',
        title: w.title,
        slug,
        excerpt: w.excerpt,
        body: w.body,
        authorId: autor.id,
        categoryId,
        readingTime: czasCzytania(w.body),
        sources: w.sources ?? undefined,
        publishedAt: new Date(),
      };

      const istnieje = await prisma.contentItem.findFirst({
        where: { type: typ, slug },
        select: { id: true },
      });

      if (SUCHO) {
        console.log(`  ${istnieje ? 'zmiana' : 'nowy '} ${typ.padEnd(5)} ${slug}`);
        istnieje ? (zmienionych += 1) : (nowych += 1);
        continue;
      }

      if (istnieje) {
        // `publishedAt` zostaje takie, jak było — poprawka treści nie jest
        // ponowną publikacją i nie ma wyrzucać materiału na górę listy.
        const { publishedAt, ...bezDaty } = dane;
        await prisma.contentItem.update({ where: { id: istnieje.id }, data: bezDaty });
        zmienionych += 1;
      } else {
        await prisma.contentItem.create({ data: dane });
        nowych += 1;
      }
    }
  }

  console.log(`\n  nowych: ${nowych} · zaktualizowanych: ${zmienionych}` +
    (pominietych ? ` · pominiętych: ${pominietych}` : ''));

  /*
   * Aktualizacja nadpisuje treść tym, co jest w pliku źródłowym — a więc
   * KASUJE odnośniki wewnętrzne wstawione przez `polacz.mjs`. Nie da się
   * tego uniknąć bez trzymania dwóch wersji treści, więc zamiast ukrywać
   * problem, mówimy wprost, co trzeba uruchomić po wczytaniu.
   */
  if (!SUCHO && (nowych > 0 || zmienionych > 0)) {
    console.log('\n  Po wczytaniu uruchom po kolei:');
    console.log('    node scripts/tresci/polacz.mjs    # odnośniki wewnętrzne (aktualizacja je kasuje)');
    console.log('    node scripts/tresci/tagi.mjs      # tagi dla nowych materiałów');
    console.log('    node scripts/tresci/okladki.mjs   # okładki dla nowych materiałów');
    console.log('    node scripts/tresci/przeplot.mjs  # przeplecenie kolejności w partii');
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
