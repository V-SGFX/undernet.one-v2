'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Rendered before the label — a live dot, an icon. */
  icon?: ReactNode;
  /** Small trailing count, e.g. how many streams are live. */
  badge?: ReactNode;
}

interface TabBarProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tablist. */
  label: string;
  /** id prefix, so aria-controls/labelledby pair up with the panel. */
  idPrefix: string;
  className?: string;
}

/**
 * The tab bar, shared by every surface that has top-level modes.
 *
 * One implementation on purpose — a second tab component is exactly how a
 * codebase ends up with a Home tab style and a Discover tab style that drift
 * apart.
 *
 * A real ARIA tablist: arrow keys move between tabs, Home/End jump to the
 * ends, and only the active tab is in the tab order, so Tab moves out of the
 * group rather than through every option.
 */
export function TabBar<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  className = '',
}: TabBarProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  /*
   * Wybrana zakładka wjeżdża w pole widzenia.
   *
   * Na telefonie w pasek mieszczą się trzy z siedmiu pozycji. Wejście na
   * /discover?tab=wiki pokazywało więc podkreślenie poza ekranem: strona
   * wyglądała, jakby nie miała aktywnej zakładki. `nearest` zamiast
   * `center` — nie przesuwamy paska, kiedy zakładka i tak jest widoczna.
   */
  useEffect(() => {
    refs.current[value]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    let next: number | null = null;

    if (e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;

    e.preventDefault();
    const tab = items[next].value;
    onChange(tab);
    refs.current[tab]?.focus();
  };

  return (
    <div
      /*
       * `-mx-4 px-4` robi z paska element pełnej szerokości wewnątrz kolumny
       * z marginesem: kreska pod spodem biegnie od krawędzi do krawędzi,
       * a pierwsza zakładka stoi równo z tytułem strony. Wcięcie MUSI się
       * zgadzać z ujemnym marginesem — inaczej lewa krawędź się rozjeżdża.
       */
      className={`sticky top-12 z-sticky -mx-4 mb-5 border-b border-line bg-surface-base px-4 ${className}`}
    >
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        /*
         * `overscroll-x-contain` zatrzymuje gest na końcu paska. Bez tego
         * przeciągnięcie zakładek na telefonie uruchamia gest „wstecz"
         * przeglądarki i użytkownik wypada ze strony zamiast dojechać do
         * ostatniej pozycji.
         */
        className="scrollbar-hide flex snap-x items-center gap-1 overflow-x-auto overscroll-x-contain"
      >
        {items.map((tab) => {
          const isActive = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[tab.value] = el;
              }}
              role="tab"
              id={`${idPrefix}-tab-${tab.value}`}
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={`
                relative shrink-0 snap-start whitespace-nowrap px-2.5 py-3 text-sm font-medium sm:px-3
                transition-colors duration-[120ms]
                focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent
                ${isActive ? 'text-content-primary' : 'text-content-muted hover:text-content-secondary'}
              `}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
                {tab.badge}
              </span>

              {/* Active underline. A plain element rather than a layout
                  animation — the tab bar is the first thing on the page and
                  should not animate on load. */}
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity duration-[120ms] ${
                  isActive ? 'bg-accent opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
