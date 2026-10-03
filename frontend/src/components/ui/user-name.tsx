'use client';

import { Star } from 'lucide-react';
import { klasyNicku, maPro, type Ozdoby } from '@/lib/ozdoby';
import { useOzdobyPlatne } from '@/lib/queries/premium';

/**
 * Nick użytkownika razem z jego ozdobami.
 *
 * Jedno miejsce na całą stronę, żeby gwiazdka i kolor znaczyły wszędzie
 * to samo. Ozdoby wchodzą tylko przy aktywnym PRO — po wygaśnięciu nick
 * wraca do zwykłego, a ustawienia czekają w bazie na odnowienie.
 */
export function UserName({
  user,
  className = '',
  gwiazdka = true,
}: {
  user: (Ozdoby & { username: string; displayName?: string | null }) | null | undefined;
  className?: string;
  gwiazdka?: boolean;
}) {
  const platne = useOzdobyPlatne();

  if (!user) return null;
  const etykieta = user.displayName || user.username;
  const pro = maPro(user);

  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      <span className={klasyNicku(user, platne)}>{etykieta}</span>
      {gwiazdka && pro && (
        <Star
          className="h-3 w-3 shrink-0 self-center fill-neon-yellow text-neon-yellow"
          aria-label="UNDERNET PRO"
        />
      )}
    </span>
  );
}
