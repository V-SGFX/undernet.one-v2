/**
 * Kategorie bazy wiedzy odwzorowane na działy Community.
 *
 * Cel: górny poziom kategorii How To ma się zgadzać z grupami Community,
 * żeby czytelnik przechodzący między dyskusją a instrukcją widział tę samą
 * mapę tematów.
 *
 * ALE nie przez zastąpienie. Obecne pięć kategorii trzyma 262 materiały
 * rozłożone niemal równo (46–58 na każdą). Płaskie zastąpienie ich siedmioma
 * grupami wrzuciłoby wszystkie do „Technologii", zostawiło sześć pustych
 * i skasowało działający filtr po Sieci czy Bezpieczeństwie. Dlatego
 * dokładamy poziom NAD istniejącym, a stare kategorie stają się jego
 * podkategoriami — dokładnie tak, jak zrobiliśmy z działami Community.
 *
 * `ContentCategory` ma drzewo od początku (relacja `CategoryTree`) i było
 * nieużywane; tu wreszcie zaczyna służyć temu, do czego je dodano.
 *
 * Uruchomienie:
 *   node scripts/tresci/struktura-wiedzy.mjs --sucho
 *   node scripts/tresci/struktura-wiedzy.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');

/**
 * [slug, nazwa, opis, podkategorie].
 *
 * Slugi grup celowo takie same jak działów Community — to dwie różne
 * tabele, więc nie kolidują, a spójność nazw ułatwia poruszanie się
 * między jedną częścią serwisu a drugą.
 */
const DRZEWO = [
  ['technologia', 'Technologia', 'Komputery, systemy, sieci i bezpieczeństwo.', [
    ['system', 'System', 'Jądro, usługi, dyski i konfiguracja systemu.'],          // istnieje: 56
    ['siec', 'Sieć', 'Adresacja, tunele, DNS i diagnostyka połączeń.'],            // istnieje: 52
    ['kod', 'Kod', 'Programowanie, bazy danych, wdrożenia i narzędzia.'],          // istnieje: 58
    ['sprzet', 'Sprzęt', 'Podzespoły, dyski, zasilanie i diagnostyka.'],           // istnieje: 50
    ['bezpieczenstwo', 'Bezpieczeństwo', 'Ochrona, szyfrowanie, incydenty.'],      // istnieje: 46
  ]],
  ['gaming', 'Gaming', 'Granie: platformy, sprzęt i konfiguracja.', []],
  ['diy', 'DIY & Elektronika', 'Mikrokontrolery, druk 3D, lutownica i naprawy.', []],
  ['motoryzacja', 'Motoryzacja', 'Mechanika, diagnostyka i elektronika w aucie.', []],
  ['dom-warsztat', 'Dom & Warsztat', 'Narzędzia, remonty, elektryka i ogród.', []],
  ['hobby', 'Hobby', 'Fotografia, wideo, muzyka i własne projekty.', []],
  ['luzne', 'Luźne', 'Materiały, które nie pasują do pozostałych działów.', []],
];

async function main() {
  const istniejace = new Map(
    (await prisma.contentCategory.findMany({
      select: { id: true, slug: true, name: true, parentId: true, _count: { select: { items: true } } },
    })).map((c) => [c.slug, c]),
  );

  let nowych = 0;
  let zaktualizowanych = 0;

  for (let g = 0; g < DRZEWO.length; g += 1) {
    const [slug, nazwa, opis, dzieci] = DRZEWO[g];
    const byla = istniejace.get(slug);

    if (SUCHO) {
      console.log(`  ${byla ? 'zmiana' : 'nowa  '} GRUPA  ${slug.padEnd(16)} ${nazwa}`);
    } else if (byla) {
      await prisma.contentCategory.update({
        where: { id: byla.id },
        data: { name: nazwa, description: opis, parentId: null, position: (g + 1) * 10 },
      });
      zaktualizowanych += 1;
    } else {
      const c = await prisma.contentCategory.create({
        data: { slug, name: nazwa, description: opis, parentId: null, position: (g + 1) * 10 },
        select: { id: true, slug: true },
      });
      istniejace.set(slug, c);
      nowych += 1;
    }

    const grupa = istniejace.get(slug);

    for (let i = 0; i < dzieci.length; i += 1) {
      const [dslug, dnazwa, dopis] = dzieci[i];
      const bylo = istniejace.get(dslug);

      if (SUCHO) {
        console.log(
          `    ${bylo ? 'zmiana' : 'nowa  '} ${dslug.padEnd(16)} ${dnazwa}` +
          (bylo ? `   (${bylo._count.items} materiałów, przypisania nietknięte)` : ''),
        );
        continue;
      }

      if (bylo) {
        // Materiały zostają tam, gdzie są — zmienia się wyłącznie rodzic
        // kategorii, nie przypisanie ani jednego materiału.
        await prisma.contentCategory.update({
          where: { id: bylo.id },
          data: { name: dnazwa, description: dopis, parentId: grupa.id, position: (i + 1) * 10 },
        });
        zaktualizowanych += 1;
      } else {
        await prisma.contentCategory.create({
          data: { slug: dslug, name: dnazwa, description: dopis, parentId: grupa.id, position: (i + 1) * 10 },
        });
        nowych += 1;
      }
    }
  }

  if (SUCHO) {
    console.log(`\n  razem po zmianie: ${DRZEWO.length + DRZEWO.reduce((a, g) => a + g[3].length, 0)} kategorii`);
    return;
  }

  console.log(`\n  nowych: ${nowych} · zaktualizowanych: ${zaktualizowanych}`);
  const bezKategorii = await prisma.contentItem.count({ where: { categoryId: null } });
  console.log('  materiałów bez kategorii:', bezKategorii, '(powinno być tyle co przed uruchomieniem)');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
