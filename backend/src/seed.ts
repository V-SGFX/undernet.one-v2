import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Dane początkowe UNDERNET.ONE.
 *
 * Idempotentny — każdy wpis idzie przez `upsert`, więc ponowne
 * uruchomienie po dołożeniu kategorii nie duplikuje tego, co już jest.
 *
 * Nie zasiewa treści. Portal wiedzy zaczyna się od pustej bazy i pierwszego
 * prawdziwego wątku; wypełnianie go zmyślonymi artykułami dałoby to samo,
 * co czat xdtv pełen ludzi, których nie ma.
 */

/** Społeczności = działy forum. Stąd bierze się wiedza. */
const COMMUNITIES = [
  { slug: 'linux', name: 'Linux', description: 'Dystrybucje, jądro, konfiguracja, problemy.' },
  { slug: 'windows', name: 'Windows', description: 'Od aktualizacji po rejestr.' },
  { slug: 'sieci', name: 'Sieci', description: 'Routery, VPN, DNS, firewalle.' },
  { slug: 'programowanie', name: 'Programowanie', description: 'Kod, narzędzia, błędy kompilacji.' },
  { slug: 'sprzet', name: 'Sprzęt', description: 'Dobór, awarie, diagnostyka.' },
  { slug: 'bezpieczenstwo', name: 'Bezpieczeństwo', description: 'Ataki, higiena, prywatność.' },
  { slug: 'ogolne', name: 'Ogólne', description: 'Wszystko, co nie pasuje gdzie indziej.' },
];

/** Kategorie bazy wiedzy — inne drzewo niż forum, bo pytanie i odpowiedź
 *  porządkuje się inaczej niż dyskusję. */
const CATEGORIES = [
  { slug: 'system', name: 'System', position: 10 },
  { slug: 'siec', name: 'Sieć', position: 20 },
  { slug: 'kod', name: 'Kod', position: 30 },
  { slug: 'sprzet', name: 'Sprzęt', position: 40 },
  { slug: 'bezpieczenstwo', name: 'Bezpieczeństwo', position: 50 },
];

/**
 * Co wchodzi w skład UNDERNET PRO.
 *
 * Wszystkie zaczynają WYŁĄCZONE (`requiresPremium: false`), czyli dostępne
 * dla darmowych kont. Zasiew tylko je zakłada — nigdy nie nadpisuje
 * ustawienia, które ktoś zmienił w panelu.
 */
const PREMIUM_FEATURES = [
  { key: 'no-ads',            position: 10, name: 'Brak reklam',
    description: 'Strona bez bloków reklamowych.' },
  { key: 'advanced-profile',  position: 20, name: 'Zaawansowane profile',
    description: 'Gwiazdka przy nicku, kolor i styl nazwy, otoczka awatara, opis i odnośniki w profilu.' },
  { key: 'collections',       position: 30, name: 'Kolekcje i zakładki',
    description: 'Zapisywanie materiałów i wątków we własnych kolekcjach.' },
  { key: 'private-notes',     position: 40, name: 'Prywatne notatki',
    description: 'Notatki przypięte do materiału, widoczne tylko dla autora.' },
  { key: 'alerts',            position: 50, name: 'Alerty',
    description: 'Powiadomienie, gdy pojawi się coś na pilnowany temat.' },
  { key: 'advanced-search',   position: 60, name: 'Zaawansowane wyszukiwanie',
    description: 'Filtry po autorze, kategorii, dacie i typie materiału.' },
  { key: 'topic-monitoring',  position: 70, name: 'Monitoring obserwowanych tematów',
    description: 'Podsumowania zmian w obserwowanych tagach i społecznościach.' },
  { key: 'community-extras',  position: 80, name: 'Dodatkowe funkcje społeczności',
    description: 'Rozszerzenia dla aktywnych: wyróżnienia, większe limity.' },
];

async function main() {
  // ── Administrator ────────────────────────────────────────────────
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    // Hasło z pliku środowiska, nie z kodu. Konto administratora
    // z hasłem zapisanym w repozytorium jest kontem publicznym.
    throw new Error('Ustaw SEED_ADMIN_PASSWORD w .env przed zasiewem.');
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@undernet.one';

  /*
   * Konto administratora szukamy po adresie ALBO po nazwie.
   *
   * Sam upsert po adresie wywracał ponowny zasiew: gdy właściciel zmienił
   * sobie adres w ustawieniach, wyszukiwanie nie trafiało w istniejące
   * konto, a próba utworzenia nowego rozbijała się o unikalność nazwy
   * `admin` (P2002). Seed musi dać się uruchomić na żywej bazie.
   *
   * Istniejącemu kontu nie nadpisujemy hasła — właściciel mógł je zmienić
   * i cichy powrót do wartości z .env byłby niespodzianką.
   */
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { username: 'admin' }] },
  });

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: 'ADMIN', isActive: true, isEmailVerified: true },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          username: 'admin',
          passwordHash: await bcrypt.hash(password, 12),
          role: 'ADMIN',
          isEmailVerified: true,
        },
      });

  console.log(
    existingAdmin
      ? `  administrator: ${admin.email} (istniejące konto, hasła nie ruszam)`
      : `  administrator: ${admin.email} (założony)`,
  );

  // ── Społeczności ─────────────────────────────────────────────────
  for (const c of COMMUNITIES) {
    await prisma.community.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description },
      create: { ...c, createdById: admin.id, isOfficial: true },
    });
  }
  console.log(`  społeczności: ${COMMUNITIES.length}`);

  // ── Kategorie bazy wiedzy ────────────────────────────────────────
  for (const cat of CATEGORIES) {
    await prisma.contentCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, position: cat.position },
      create: cat,
    });
  }
  console.log(`  kategorie wiedzy: ${CATEGORIES.length}`);

  // ── Bloki reklamowe ──────────────────────────────────────────────
  const AD_SLOTS = [
    { key: 'home-top', name: 'Strona główna — nad kanałem', position: 10,
      description: 'Pas nad pierwszym kafelkiem na stronie głównej.' },
    { key: 'feed-inline', name: 'Kanał — co 8 kafelków', position: 20,
      description: 'Wstawka w siatce treści, powtarzana co ósmy kafelek.' },
    { key: 'sidebar-right', name: 'Prawa kolumna', position: 30,
      description: 'Kolumna po prawej, od 1024 px. Na telefonie nie istnieje.' },
    { key: 'article-body', name: 'W treści artykułu', position: 40,
      description: 'Między treścią materiału a komentarzami.' },
    { key: 'discover-top', name: 'Odkrywaj — nad zakładkami', position: 50,
      description: 'Pas nad zakładkami na stronie Odkrywaj.' },

    /*
     * `post-detail` był wołany z kodu strony wątku, ale NIE MIAŁ tu wiersza —
     * blok nie mógł się więc nigdy pojawić, bo API nie miało czego wydać.
     * Cichy brak: w kodzie wygląda na wstawiony, w panelu nie istnieje.
     */
    { key: 'post-detail', name: 'Wątek — pod treścią, nad komentarzami', position: 60,
      description: 'Przerwa między treścią wątku a dyskusją. Czytelnik, który doszedł tak daleko, jest najbardziej zaangażowany.' },

    { key: 'content-mid', name: 'Materiał — w połowie tekstu', position: 70,
      description: 'Wstawiany między akapitami, najbliżej środka materiału. Pojawia się tylko w dłuższych tekstach — w krótkim haśle rozbijałby jedną myśl na pół.' },

    { key: 'community-top', name: 'Community — nad listą wątków', position: 80,
      description: 'Pas nad listą dyskusji, nad filtrami społeczności.' },
  ];
  for (const slot of AD_SLOTS) {
    await prisma.adSlot.upsert({
      where: { key: slot.key },
      update: { name: slot.name, description: slot.description, position: slot.position },
      create: { ...slot, isActive: false },
    });
  }
  console.log(`  bloki reklamowe: ${AD_SLOTS.length}`);

  // ── UNDERNET PRO ─────────────────────────────────────────────────
  //
  // `update` obejmuje celowo tylko nazwę, opis i kolejność.
  // `requiresPremium` NIGDY nie jest nadpisywane — inaczej ponowny zasiew
  // cofałby decyzję handlową podjętą w panelu.
  for (const f of PREMIUM_FEATURES) {
    await prisma.premiumFeature.upsert({
      where: { key: f.key },
      update: { name: f.name, description: f.description, position: f.position },
      create: { ...f, requiresPremium: false },
    });
  }
  const platnych = await prisma.premiumFeature.count({ where: { requiresPremium: true } });
  console.log(`  funkcje PRO: ${PREMIUM_FEATURES.length} (obecnie płatnych: ${platnych})`);
}

main()
  .then(() => console.log('Zasiew zakończony.'))
  .catch((e) => {
    console.error('Zasiew nie powiódł się:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
