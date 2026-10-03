'use client';

import Link from 'next/link';
import { BookOpen, Wrench, FileText, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDerivedContent, type ContentType } from '@/lib/queries/knowledge';

/**
 * „Z tej dyskusji może powstać materiał."
 *
 * Sedno idei portalu, postawione tam, gdzie decyzja faktycznie zapada —
 * pod wątkiem, po przeczytaniu odpowiedzi. Wcześniej jedyną drogą było
 * otwarcie Studia i WPISANIE NUMERU wątku z pamięci w pole „Wątek
 * źródłowy". Nikt tak nie pracuje: numer trzeba było skądś wziąć,
 * a pomyłka wiązała materiał z cudzą dyskusją.
 *
 * Wybór typu od razu tutaj, bo to on decyduje o formie: to samo
 * rozwiązanie zapisane jako hasło wiki, instrukcja i artykuł wygląda
 * zupełnie inaczej, a przestawianie typu w połowie pisania oznacza
 * przepisywanie tekstu.
 */
const OPTIONS: { type: ContentType; path: string; label: string; hint: string; icon: typeof BookOpen }[] = [
  { type: 'WIKI', path: 'wiki', label: 'Hasło wiki', hint: 'Pojęcie, które wraca w wielu wątkach', icon: BookOpen },
  { type: 'HOWTO', path: 'how-to', label: 'Instrukcja', hint: 'Powtarzalne kroki do wykonania', icon: Wrench },
  { type: 'ARTICLE', path: 'articles', label: 'Artykuł', hint: 'Szersze omówienie z kontekstem', icon: FileText },
];

/** Co wolno założyć której roli — musi zgadzać się z backendem. */
const ALLOWED: Record<string, ContentType[]> = {
  USER: ['WIKI'],
  MODERATOR: ['WIKI', 'HOWTO', 'ARTICLE'],
  AUTHOR: ['WIKI', 'HOWTO', 'ARTICLE'],
  EDITOR: ['WIKI', 'HOWTO', 'ARTICLE'],
  ADMIN: ['WIKI', 'HOWTO', 'ARTICLE'],
};

export function ProposeMaterial({ postId }: { postId: number }) {
  const { user } = useAuth();
  const { data: derived } = useDerivedContent(postId);

  if (!user) return null;

  const allowed = ALLOWED[user.role] ?? [];
  if (allowed.length === 0) return null;

  const options = OPTIONS.filter((o) => allowed.includes(o.type));
  const already = derived?.length ?? 0;

  return (
    <section className="my-4 rounded-lg border border-line bg-surface-raised p-4">
      <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content-secondary">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {already > 0 ? 'Dołóż kolejny materiał' : 'Z tej dyskusji może powstać materiał'}
      </h2>

      <p className="mt-1.5 text-xs text-content-muted">
        {allowed.length === 1
          ? 'Rozwiązanie, które się tu ustaliło, warto zapisać tak, żeby dało się je powtórzyć. Trafi do akceptacji.'
          : 'Rozwiązanie, które się tu ustaliło, warto zapisać tak, żeby dało się je powtórzyć. Wątek zostanie podpięty jako źródło.'}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map(({ type, path, label, hint, icon: Icon }) => (
          <Link
            key={type}
            href={`/studio/nowy?typ=${path}&zrodlo=${postId}`}
            className="group rounded-lg border border-line bg-surface-base p-3 transition-colors hover:border-accent"
          >
            <Icon className="mb-1.5 h-4 w-4 text-content-muted transition-colors group-hover:text-accent" aria-hidden="true" />
            <p className="text-sm font-semibold text-content-primary">{label}</p>
            <p className="mt-0.5 text-2xs leading-snug text-content-muted">{hint}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
