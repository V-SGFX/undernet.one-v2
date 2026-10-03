import { ReactNode } from 'react';

/**
 * Kontener treści strony.
 *
 * Cała powłoka — pasek nawigacji, stopka, dolne menu, przycisk tworzenia —
 * przeniosła się do `AppShell` w układzie głównym, żeby nie montowała się
 * od nowa przy każdym przejściu. Tutaj zostało światło i szerokość kolumny,
 * dzięki czemu nazwa i wszystkie miejsca użycia mogły zostać bez zmian.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>;
}
