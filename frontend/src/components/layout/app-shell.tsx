'use client';

import { Navbar } from '@/components/navbar';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Flame, Plus, Image, HelpCircle, Compass, MessagesSquare, BookOpen, Wrench, FileText } from 'lucide-react';
import { SidebarAdRail } from '@/components/ads/sidebar-ad-rail';

/**
 * Trwała powłoka aplikacji.
 *
 * Renderowana RAZ, w układzie głównym — nie przez każdą stronę osobno.
 *
 * Wcześniej pasek nawigacji siedział wewnątrz strony, więc KAŻDE przejście
 * montowało go od nowa. Pływające podkreślenie (`layoutId`) nie miało się
 * wtedy z czym animować: framer-motion widział nowy element bez poprzednika
 * w tym samym drzewie. Najgorzej wychodziło to na /wiki, /how-to i /news,
 * bo te strony mają dodatkowo granicę Suspense — cała powłoka gasła na
 * moment do pustki i podkreślenie po prostu przeskakiwało.
 *
 * Skutek uboczny, równie ważny: powłoka nie przerysowuje się już przy
 * każdej nawigacji.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  /*
   * Nawigacja undernetu: cztery filary plus profil.
   *
   * Z xdtv zostały tu klipy i transmisje — działy, których ten portal
   * nie ma. Odnośnik do nieistniejącej strony jest gorszy niż jego brak:
   * wygląda na funkcję, która się zepsuła.
   */
  /*
   * Dolny pasek: sześć pozycji, nie siedem.
   *
   * Zmierzone: przy siedmiu komórka schodzi do 51 px na 360 px ekranu
   * i ucinają się dwie etykiety („Community", „Odkrywaj"), a przy 320 px
   * cztery. Przy sześciu mieszczą się wszystkie — po zmniejszeniu światła
   * komórki o 4 px, bo „Community" brakowało dokładnie trzech.
   *
   * News nie ma tu własnej pozycji: ze wszystkich czterech typów jest
   * najrzadszy, a Odkrywaj prowadzi do niego zakładką. Na szerokich
   * ekranach górny pasek pokazuje komplet.
   */
  const NAV_ITEMS = [
    { href: '/', icon: Flame, label: 'Start' },
    { href: '/community', icon: MessagesSquare, label: 'Community' },
    { href: '/wiki', icon: BookOpen, label: 'Wiki' },
    { href: '/how-to', icon: Wrench, label: 'How To' },
    { href: '/articles', icon: FileText, label: 'Artykuły' },
    { href: '/discover', icon: Compass, label: 'Odkrywaj' },
  ];

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  /*
   * Co można stworzyć spod plusa.
   *
   * Każda pozycja kończy się postem w społeczności — klip też, bo
   * Predykcje wypadły stąd razem z funkcją: przycisk prowadził do
   * osobnego bytu, który z resztą serwisu nie miał wspólnego modelu.
   */
  /*
   * Co można stworzyć spod plusa.
   *
   * Materiały bazy wiedzy powstają w Studiu, nie tutaj — tworzenie
   * artykułu wymaga edytora, kategorii i obiegu akceptacji, a nie
   * modalu z jednym polem.
   */
  const createItems = [
    {
      href: '/community?postType=TEXT',
      title: 'Zadaj pytanie',
      subtitle: 'Opisz problem, dostaniesz odpowiedź',
      icon: HelpCircle,
      accent: 'text-accent border-accent/20 bg-accent/5',
    },
    {
      href: '/community?postType=MEDIA',
      title: 'Wrzuć zrzut ekranu',
      subtitle: 'Obraz plus krótki opis',
      icon: Image,
      accent: 'text-sky-300 border-sky-400/20 bg-sky-500/5',
    },
    {
      href: '/studio',
      title: 'Napisz materiał',
      subtitle: 'Artykuł, poradnik albo wpis wiki',
      icon: FileText,
      accent: 'text-amber-300 border-amber-400/20 bg-amber-500/5',
    },
  ];


  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Navbar />

      <div className="flex flex-1">
        {/*
          Kolumna treści.

          `min-w-0` jest OBOWIĄZKOWE: element flex ma domyślnie
          `min-width: auto`, więc <main> rozciągałby się do szerokości
          najszerszego dziecka zamiast je ograniczać — pasek zakładek
          rozpychałby wtedy całą stronę zamiast się przewijać.

          BEZ `overflow-y-auto`: ta klasa robi z <main> własny kontener
          przewijania, a `position: sticky` odnosi się do najbliższego
          takiego kontenera, nie do okna.
        */}
        <main className="min-w-0 flex-1">{children}</main>

        {/* Kolumna reklamowa sama decyduje, czy w ogóle istnieć. */}
        <SidebarAdRail />
      </div>

      {/* Legal footer */}
      <footer className="hidden md:block border-t border-white/[0.06] py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-4 text-xs text-white/25">
          <span>© {new Date().getFullYear()} UNDERNET.ONE</span>
          <span>·</span>
          <Link href="/regulamin" className="hover:text-white/40 transition-colors">{t('terms')}</Link>
          <span>·</span>
          <Link href="/polityka-prywatnosci" className="hover:text-white/40 transition-colors">{t('privacy')}</Link>
        </div>
      </footer>

      {/* ── Mobile bottom navigation ── */}
      {/* Five items with Polish labels ("Odkrywaj", "Społeczności") exceed a
          320px screen at fixed padding, so each cell is an equal flex share
          with a truncating label. The row cannot overflow at any width, and
          min-h-14 keeps every target comfortably tappable. */}
      <nav
        aria-label={t('home')}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-nav flex items-stretch bg-black/95 backdrop-blur-xl border-t border-white/[0.08]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 sm:px-1 transition-colors ${active ? 'text-neon-pink' : 'text-white/40 hover:text-white/70'}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="w-full truncate text-center text-[10px] font-medium sm:text-2xs">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-neon-pink"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Floating community chat panel */}
      {/* Quick create button */}
      {(
        <button
          onClick={() => setShowCreate(true)}
          className="fixed z-nav right-4 md:right-6 bottom-24 md:bottom-6 w-12 h-12 rounded-full bg-neon-pink text-white flex items-center justify-center shadow-[0_0_18px_rgba(255,0,170,0.45)] hover:scale-105 transition-transform"
          aria-label="Szybkie tworzenie"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Quick create. Was a hand-rolled fixed-inset block with no focus trap,
          no Escape and no dialog semantics — on mobile it is the primary
          action, so it is the one that most needed the primitive. */}
      {(
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          size="sm"
          title={t('createTagline')}
        >
          <ul className="grid grid-cols-1 gap-2 p-4">
            {createItems.map(({ href, title, subtitle, icon: Icon, accent }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setShowCreate(false)}
                  className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${accent}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{title}</span>
                    <span className="block truncate text-xs opacity-70">{subtitle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {/* Spacer matching the bottom nav (min-h-14) plus the home indicator,
          so the last row of content is never hidden behind it. */}
      <div
        aria-hidden="true"
        className="lg:hidden"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      />
    </div>
  );
}
