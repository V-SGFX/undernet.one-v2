/**
 * Docelowa struktura działów Community.
 *
 * Zasady, na których stoi ten plik:
 *
 *  1. ŻADEN ISTNIEJĄCY SLUG SIĘ NIE ZMIENIA. Slug jest adresem — zmiana
 *     kasuje pozycję w wyszukiwarce i psuje odnośniki rozsiane po serwisie.
 *     Istniejące społeczności dostają wyłącznie rodzica, kolejność i (gdzie
 *     trzeba) nową nazwę wyświetlaną, która adresu nie dotyka.
 *
 *  2. SLUG NIE ZAWIERA ŚCIEŻKI. Gdyby brzmiał `motoryzacja/elektronika`,
 *     przeniesienie działu do innej grupy zmieniałoby adres. Zamiast tego
 *     kolizje rozwiązujemy nazwą: „Elektronika" pod motoryzacją to naprawdę
 *     „Elektronika samochodowa" i tak się nazywa.
 *
 *  3. ŻADEN WĄTEK NIE ZMIENIA PRZYPISANIA. Skrypt dotyka wyłącznie tabeli
 *     społeczności.
 *
 * Uruchomienie:
 *   node scripts/tresci/struktura-community.mjs --sucho
 *   node scripts/tresci/struktura-community.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');

/**
 * [slug, nazwa, opis, podkategorie].
 *
 * Slug oznaczony gwiazdką w komentarzu już istnieje — nie wolno go ruszyć.
 */
const DRZEWO = [
  ['technologia', 'Technologia', 'Komputery, oprogramowanie, sieci i bezpieczeństwo.', [
    ['sprzet', 'Komputery', 'Podzespoły, składanie, awarie i zakupy.'],            // istnieje
    ['software', 'Software', 'Programy, systemy, konfiguracja i licencje.'],
    ['windows', 'Windows', 'Problemy, ustawienia i aktualizacje.'],                // istnieje
    ['linux', 'Linux & Unix', 'Dystrybucje, powłoka, usługi i serwery.'],          // istnieje
    ['programowanie', 'Programowanie', 'Kod, narzędzia, biblioteki i architektura.'], // istnieje
    ['sieci', 'Sieci', 'Routery, Wi-Fi, VPN, adresacja i diagnostyka.'],           // istnieje
    ['bezpieczenstwo', 'Cyberbezpieczeństwo', 'Ochrona, incydenty, prywatność.'],  // istnieje
    ['ai', 'AI', 'Modele, narzędzia i praktyczne zastosowania.'],
    ['mobile', 'Mobile', 'Telefony, tablety, systemy i aplikacje.'],
  ]],

  ['gaming', 'Gaming', 'Granie: sprzęt, platformy i tytuły.', [                    // istnieje (staje się grupą)
    ['gaming-pc', 'PC', 'Granie na komputerze: wydajność, ustawienia, launchery.'],
    ['konsole', 'Konsole', 'PlayStation, Xbox, Nintendo.'],
    ['steam', 'Steam', 'Biblioteka, Proton, Deck i ustawienia platformy.'],
    ['handheldy', 'Handheldy', 'Steam Deck, ROG Ally i przenośne granie.'],
    ['retro', 'Retro', 'Stare konsole, emulacja i sprzęt sprzed lat.'],
  ]],

  ['diy', 'DIY & Elektronika', 'Lutownica, mikrokontrolery, druk i naprawy.', [
    ['elektronika', 'Elektronika', 'Układy, pomiary, zasilanie i podzespoły.'],
    ['arduino-esp', 'Arduino / ESP', 'Mikrokontrolery, czujniki i projekty.'],
    ['raspberry-pi', 'Raspberry Pi', 'Komputery jednopłytkowe i ich zastosowania.'],
    ['druk-3d', 'Druk 3D', 'Drukarki, materiały, kalibracja i modele.'],
    ['smart-home', 'Smart Home', 'Automatyka domowa, czujniki i integracje.'],
    ['naprawy', 'Naprawy', 'Diagnostyka i naprawa sprzętu elektronicznego.'],
  ]],

  ['motoryzacja', 'Motoryzacja', 'Auto: mechanika, elektronika i modyfikacje.', [
    ['mechanika', 'Mechanika', 'Silnik, zawieszenie, hamulce, przeglądy.'],
    // Nie „Diagnostyka" — samo słowo równie dobrze opisuje diagnostykę komputera.
    ['diagnostyka-samochodowa', 'Diagnostyka samochodowa', 'OBD2, błędy, pomiary i interpretacja.'],
    // Rozwiązanie kolizji z DIY → Elektronika: to naprawdę inna dziedzina.
    ['elektronika-samochodowa', 'Elektronika samochodowa', 'Instalacja, sterowniki, czujniki i przewody.'],
    ['lpg', 'LPG', 'Instalacje gazowe: montaż, regulacja, przeglądy.'],
    ['car-audio', 'Car Audio', 'Nagłośnienie, wygłuszenie i montaż.'],
    ['modyfikacje', 'Modyfikacje', 'Przeróbki, tuning i wyposażenie dodatkowe.'],
  ]],

  ['dom-warsztat', 'Dom & Warsztat', 'Majsterkowanie, narzędzia i prace w domu.', [
    ['majsterkowanie', 'Majsterkowanie', 'Projekty, drewno, metal i pomysły.'],
    ['narzedzia', 'Narzędzia', 'Wybór, obsługa i konserwacja.'],
    ['remonty', 'Remonty', 'Ściany, podłogi, instalacje i wykończenia.'],
    ['elektryka', 'Elektryka', 'Instalacje domowe, pomiary i bezpieczeństwo.'],
    ['ogrod', 'Ogród', 'Rośliny, nawadnianie, sprzęt ogrodowy.'],
  ]],

  ['hobby', 'Hobby', 'Foto, wideo, muzyka i własne projekty.', [
    ['fotografia', 'Fotografia', 'Aparaty, obiektywy, obróbka i technika.'],
    ['wideo', 'Wideo', 'Nagrywanie, montaż, sprzęt i strumieniowanie.'],
    ['muzyka', 'Muzyka', 'Instrumenty, nagrywanie i sprzęt audio.'],
    ['modelarstwo', 'Modelarstwo', 'Modele, drony, RC i makiety.'],
    ['projekty-wlasne', 'Projekty własne', 'Pokaż, nad czym pracujesz.'],
  ]],

  ['luzne', 'Luźne', 'Rozmowy poza tematem.', [
    ['ogolne', 'Ogólne', 'Wszystko, co nie pasuje gdzie indziej.'],                // istnieje
    ['pogaduchy', 'Pogaduchy', 'Luźne rozmowy.'],
    ['ciekawostki', 'Ciekawostki', 'Znaleziska i rzeczy warte uwagi.'],
    ['ogloszenia', 'Ogłoszenia', 'Kupię, sprzedam, oddam.'],
  ]],
];

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!admin) throw new Error('Brak konta administratora — nie ma kogo wpisać jako założyciela.');

  const istniejace = new Map(
    (await prisma.community.findMany({ select: { id: true, slug: true, name: true, parentId: true } }))
      .map((c) => [c.slug, c]),
  );

  let nowych = 0;
  let zaktualizowanych = 0;
  const dziennik = [];

  // Najpierw grupy — podkategorie potrzebują ich identyfikatorów.
  for (let g = 0; g < DRZEWO.length; g += 1) {
    const [slug, nazwa, opis, dzieci] = DRZEWO[g];
    const byla = istniejace.get(slug);

    if (SUCHO) {
      dziennik.push(`  ${byla ? 'zmiana' : 'nowa  '} GRUPA  ${slug.padEnd(24)} ${nazwa}`);
    } else if (byla) {
      // Istniejącej NIE zmieniamy sluga ani nie ruszamy jej wątków.
      await prisma.community.update({
        where: { id: byla.id },
        data: { name: nazwa, description: opis, parentId: null, position: (g + 1) * 10 },
      });
      zaktualizowanych += 1;
    } else {
      const c = await prisma.community.create({
        data: {
          slug, name: nazwa, description: opis,
          parentId: null, position: (g + 1) * 10,
          createdById: admin.id, isOfficial: true,
        },
        select: { id: true, slug: true },
      });
      istniejace.set(slug, c);
      nowych += 1;
    }

    const grupa = istniejace.get(slug);

    for (let i = 0; i < dzieci.length; i += 1) {
      const [dslug, dnazwa, dopis] = dzieci[i];
      const byloDziecko = istniejace.get(dslug);

      if (SUCHO) {
        dziennik.push(
          `    ${byloDziecko ? 'zmiana' : 'nowa  '} ${dslug.padEnd(24)} ${dnazwa}` +
          (byloDziecko && byloDziecko.name !== dnazwa ? `   (nazwa: „${byloDziecko.name}" → „${dnazwa}")` : ''),
        );
        continue;
      }

      if (byloDziecko) {
        await prisma.community.update({
          where: { id: byloDziecko.id },
          data: { name: dnazwa, description: dopis, parentId: grupa.id, position: (i + 1) * 10 },
        });
        zaktualizowanych += 1;
      } else {
        await prisma.community.create({
          data: {
            slug: dslug, name: dnazwa, description: dopis,
            parentId: grupa.id, position: (i + 1) * 10,
            createdById: admin.id, isOfficial: true,
          },
        });
        nowych += 1;
      }
    }
  }

  if (SUCHO) {
    console.log(dziennik.join('\n'));
    const wszystkie = DRZEWO.length + DRZEWO.reduce((a, g) => a + g[3].length, 0);
    console.log(`\n  razem po zmianie: ${wszystkie} działów`);
    return;
  }

  console.log(`\n  nowych: ${nowych} · zaktualizowanych: ${zaktualizowanych}`);
  console.log('  wątków w bazie:', await prisma.post.count(), '(skrypt ich nie dotyka)');
  console.log('\n  Pamięć podręczna listy społeczności ma 60 s — katalog odświeży się sam.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
