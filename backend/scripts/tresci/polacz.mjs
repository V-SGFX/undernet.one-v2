/**
 * Linkowanie wewnętrzne i powiązania między materiałami.
 *
 * Dwa efekty z jednego przebiegu:
 *  1. pierwsze wystąpienie pojęcia w treści staje się odnośnikiem do hasła,
 *  2. z tych trafień powstają wpisy w tabeli powiązań, dzięki czemu sekcja
 *     „Powiązane" pokazuje materiały naprawdę związane tematycznie,
 *     a nie przypadkowe z tej samej kategorii.
 *
 * Uruchomienie:
 *   node scripts/tresci/polacz.mjs --sucho
 *   node scripts/tresci/polacz.mjs
 */
import { PrismaClient } from '@prisma/client';
import { SLOWNIK } from './slownik.mjs';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');

/** Ile odnośników najwyżej w jednym materiale. */
const LIMIT_ODNOSNIKOW = 5;

/**
 * Fragmenty, w których NIE WOLNO niczego podmieniać.
 *
 * Odnośnik w bloku kodu psuje polecenie do skopiowania, a w nagłówku
 * rozbija spis treści. Wycinamy je przed podmianą i wklejamy z powrotem
 * po niej — prościej i pewniej niż budowanie wyrażenia omijającego.
 */
const NIETYKALNE = /<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<h[1-6][\s\S]*?<\/h[1-6]>|<a[\s\S]*?<\/a>/g;

const SCIEZKA = { WIKI: 'wiki', HOWTO: 'how-to', ARTICLE: 'articles', NEWS: 'news' };

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wstawia odnośniki do treści.
 *
 * Zwraca nową treść i listę adresów, do których udało się podlinkować —
 * ta druga służy do zbudowania powiązań.
 */
function podlinkuj(body, wlasnySlug, mapaHasel) {
  const zapas = [];
  // Wycinamy nietykalne fragmenty, zostawiając znaczniki pozycyjne.
  let roboczy = body.replace(NIETYKALNE, (m) => {
    zapas.push(m);
    return ` @@${zapas.length - 1}@@ `;
  });

  const trafienia = [];

  for (const [slug, formy] of SLOWNIK) {
    if (slug === wlasnySlug) continue;
    if (trafienia.length >= LIMIT_ODNOSNIKOW) break;
    const cel = mapaHasel.get(slug);
    if (!cel) continue;

    for (const forma of formy) {
      // Granice słowa wypisane jawnie: \b psuje się na literach
      // diakrytycznych i trafiałoby w środek polskich wyrazów.
      const re = new RegExp('(^|[\\s(„">—-])(' + escape(forma) + ')(?=[\\s.,;:)”"<—-]|$)');
      if (!re.test(roboczy)) continue;

      roboczy = roboczy.replace(re, (_m, przed, slowo) =>
        przed + '<a href="/' + SCIEZKA[cel.type] + '/' + slug + '">' + slowo + '</a>');
      trafienia.push(slug);
      break; // jedna forma na pojęcie
    }
  }

  const wynik = roboczy.replace(/ @@(\d+)@@ /g, (_m, i) => zapas[Number(i)]);
  return { body: wynik, trafienia };
}

async function main() {
  const hasla = await prisma.contentItem.findMany({
    where: { type: 'WIKI', status: 'PUBLISHED' },
    select: { id: true, slug: true, type: true },
  });
  const mapaHasel = new Map(hasla.map((h) => [h.slug, h]));

  const materialy = await prisma.contentItem.findMany({
    where: { type: { in: ['WIKI', 'HOWTO'] }, status: 'PUBLISHED' },
    select: { id: true, slug: true, type: true, body: true },
    orderBy: { id: 'asc' },
  });

  let zmienionych = 0;
  let odnosnikow = 0;
  let powiazan = 0;

  for (const m of materialy) {
    // Materiał już podlinkowany pomijamy — inaczej drugi przebieg
    // linkowałby wewnątrz wstawionych wcześniej odnośników.
    if (m.body.includes('<a href="/wiki/')) continue;

    const { body, trafienia } = podlinkuj(m.body, m.slug, mapaHasel);
    if (trafienia.length === 0) continue;

    zmienionych += 1;
    odnosnikow += trafienia.length;

    if (SUCHO) {
      console.log('  ' + m.slug + ' → ' + trafienia.join(', '));
      continue;
    }

    await prisma.contentItem.update({ where: { id: m.id }, data: { body } });

    for (const slug of trafienia) {
      const cel = mapaHasel.get(slug);
      if (!cel || cel.id === m.id) continue;
      // Powiązanie jest jednokierunkowe: „ten materiał wspomina tamto".
      // Odwrotna strona powstanie sama, jeśli tamten tekst też o tym mówi.
      const juz = await prisma.contentRelation.findFirst({
        where: { fromId: m.id, toId: cel.id },
        select: { id: true },
      });
      if (juz) continue;
      await prisma.contentRelation.create({ data: { fromId: m.id, toId: cel.id } });
      powiazan += 1;
    }
  }

  console.log(
    '\n  materiałów zmienionych: ' + zmienionych + ' · odnośników: ' + odnosnikow +
    (SUCHO ? ' (próba na sucho)' : ' · powiązań: ' + powiazan),
  );
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
