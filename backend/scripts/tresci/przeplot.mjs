/**
 * Przeplecenie kolejności w obrębie jednej partii publikacji.
 *
 * Dwieście materiałów trafiło do bazy w jednej minucie, w kolejności
 * wczytywania plików — czyli kategoriami. Skutek: pierwsza strona listy
 * to kilkanaście kafelków w jednym kolorze, a kolejne działy nie pokazują
 * się wcale, dopóki ktoś nie przewinie.
 *
 * Kolejność wewnątrz jednej minuty NIE NIESIE ŻADNEJ INFORMACJI — jest
 * artefaktem tego, który plik czytałem pierwszy. Dlatego wolno ją zmienić:
 * to nie jest antydatowanie, bo minuta publikacji zostaje ta sama. Nowa
 * kolejność rozdaje materiały po kolei z każdej kategorii, więc lista
 * pokazuje od razu przekrój całości.
 *
 * Uruchomienie:
 *   node scripts/tresci/przeplot.mjs --sucho
 *   node scripts/tresci/przeplot.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');

async function main() {
  const wszystkie = await prisma.contentItem.findMany({
    where: { type: { in: ['WIKI', 'HOWTO'] }, status: 'PUBLISHED' },
    select: { id: true, slug: true, type: true, publishedAt: true, category: { select: { slug: true } } },
    orderBy: { publishedAt: 'asc' },
  });

  // Każda partia licząca co najmniej dwadzieścia materiałów z tej samej
  // minuty jest przeplatana osobno. Materiały o prawdziwych, rozłożonych
  // datach nie tworzą takich skupisk i pozostają nietknięte.
  const wgMinuty = new Map();
  for (const m of wszystkie) {
    const k = m.publishedAt.toISOString().slice(0, 16);
    if (!wgMinuty.has(k)) wgMinuty.set(k, []);
    wgMinuty.get(k).push(m);
  }
  const partie = [...wgMinuty.entries()].filter(([, v]) => v.length >= 20).sort();

  if (partie.length === 0) {
    console.log('  Brak partii wymagającej przeplecenia.');
    return;
  }

  for (const [minuta, partia] of partie) {
    await przepleć(minuta, partia);
  }
}

/** Przeplecenie jednej partii opublikowanej w tej samej minucie. */
async function przepleć(minuta, partia) {

  // Kubełki po kategorii, w stałej kolejności — wynik ma być powtarzalny.
  const kubelki = new Map();
  for (const m of partia) {
    const k = m.category?.slug ?? 'brak';
    if (!kubelki.has(k)) kubelki.set(k, []);
    kubelki.get(k).push(m);
  }
  const klucze = [...kubelki.keys()].sort();

  // Rozdanie po kolei z każdego kubełka, przeplatając też typy.
  const kolejka = [];
  let zostalo = partia.length;
  let i = 0;
  while (zostalo > 0) {
    const k = klucze[i % klucze.length];
    const kub = kubelki.get(k);
    if (kub.length) { kolejka.push(kub.shift()); zostalo -= 1; }
    i += 1;
  }

  // Najnowszy pierwszy: ostatni w kolejce dostaje najpóźniejszą chwilę.
  const bazowa = new Date(minuta + ':00.000Z').getTime();
  const krok = Math.floor(59000 / kolejka.length);

  console.log('  partia: ' + partia.length + ' materiałów z ' + minuta);
  console.log('  pierwsza dziesiątka po przeplocie (od najnowszych):');
  [...kolejka].reverse().slice(0, 10)
    .forEach((m) => console.log('    ' + (m.category?.slug ?? '—').padEnd(16) + m.slug.slice(0, 48)));

  if (SUCHO) return;

  for (let n = 0; n < kolejka.length; n += 1) {
    await prisma.contentItem.update({
      where: { id: kolejka[n].id },
      data: { publishedAt: new Date(bazowa + n * krok) },
    });
  }
  console.log('  ✓ przestawiono ' + kolejka.length + ' materiałów w obrębie minuty ' + minuta);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
