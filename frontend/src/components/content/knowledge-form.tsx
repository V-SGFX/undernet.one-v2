'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Save, Send, Upload, ArrowLeft, AlertCircle, Undo2, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { KnowledgeEditor } from '@/components/content/knowledge-editor';
import { ImageUploadField } from '@/components/content/image-upload-field';
import { SourcePostField } from '@/components/content/source-post-field';
import { TagsField } from '@/components/content/tags-field';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCategories, PATH_BY_TYPE, type ContentType } from '@/lib/queries/knowledge';

/**
 * Które typy wolno założyć której roli.
 *
 * Musi zgadzać się z TYPES_BY_ROLE w backendzie. Rozbieżność nie jest
 * dziurą w bezpieczeństwie — API i tak odmówi — ale daje przycisk, który
 * kończy się komunikatem o braku uprawnień, a to gorsze niż jego brak.
 */
const TYPES_BY_ROLE: Record<string, ContentType[]> = {
  USER: ['WIKI'],
  MODERATOR: ['WIKI', 'ARTICLE', 'HOWTO'],
  AUTHOR: ['WIKI', 'ARTICLE', 'HOWTO'],
  EDITOR: ['WIKI', 'ARTICLE', 'HOWTO', 'NEWS'],
  ADMIN: ['WIKI', 'ARTICLE', 'HOWTO', 'NEWS'],
};

const TYPES: { value: ContentType; label: string; hint: string }[] = [
  { value: 'NEWS', label: 'News', hint: 'Krótka informacja: wydanie, luka, zmiana.' },
  { value: 'ARTICLE', label: 'Artykuł', hint: 'Pełny materiał redakcyjny.' },
  { value: 'HOWTO', label: 'How To', hint: 'Instrukcja krok po kroku.' },
  { value: 'WIKI', label: 'Wiki', hint: 'Hasło, które żyje i jest aktualizowane.' },
];

interface Draft {
  id?: number;
  type: ContentType;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  categoryId: number | null;
  sourcePostId: number | null;
  tagIds: number[];
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  status?: string;
}

const EMPTY: Draft = {
  type: 'ARTICLE', title: '', slug: '', excerpt: '', body: '', coverUrl: '',
  categoryId: null, sourcePostId: null, tagIds: [],
  metaTitle: '', metaDescription: '', ogImage: '',
};

/**
 * Formularz materiału.
 *
 * Jeden na cztery typy i na tworzenie oraz edycję. Osobne formularze
 * różniłyby się wyłącznie wartością `type` i obecnością identyfikatora,
 * a rozjechałyby się przy pierwszym nowym polu — na przykład przy SEO,
 * które musi być na każdym z nich.
 */
export function KnowledgeForm({
  id,
  initialType,
  initialSourcePostId,
}: {
  id?: number;
  initialType?: ContentType;
  /** Wątek podpięty z adresu — patrz „Zaproponuj materiał" pod dyskusją. */
  initialSourcePostId?: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: categories } = useCategories();

  const [draft, setDraft] = useState<Draft>({
    ...EMPTY,
    ...(initialType && { type: initialType }),
    ...(initialSourcePostId && { sourcePostId: initialSourcePostId }),
  });
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Czy pola wolno zmieniać. Materiał w akceptacji jest zamrożony dla autora. */
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    if (!id) return;

    /*
     * Materiał bierzemy z `studio/item/:id`, a NIE z listy Studia.
     *
     * Lista celowo nie zwraca `body` — dwadzieścia artykułów z pełnym
     * tekstem to kilkaset kilobajtów. Formularz czytał stamtąd treść,
     * więc otwierał się pusty, a zapis nadpisywał tekst pustką.
     */
    api.get(`/content/studio/item/${id}`)
      .then(({ data: found }) => {
        setDraft({
          id: found.id,
          type: found.type,
          title: found.title,
          slug: found.slug,
          excerpt: found.excerpt ?? '',
          body: found.body ?? '',
          coverUrl: found.coverUrl ?? '',
          categoryId: found.categoryId ?? found.category?.id ?? null,
          sourcePostId: found.sourcePostId ?? null,
          // Backend zwraca tagi zagnieżdżone przez tabelę łączącą.
          tagIds: (found.tags ?? []).map((t: any) => t.tag?.id ?? t.id).filter(Boolean),
          metaTitle: found.metaTitle ?? '',
          metaDescription: found.metaDescription ?? '',
          ogImage: found.ogImage ?? '',
          status: found.status,
        });
        setCanEdit(found.canEdit !== false);
      })
      .catch((e) => {
        setError(e?.response?.data?.message ?? 'Nie udało się wczytać materiału.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** Zmiana etapu bez dotykania treści — wycofanie albo odesłanie do poprawy. */
  const changeStage = async (stage: 'unpublish' | 'reject') => {
    if (!draft.id) return;
    const note = stage === 'reject'
      ? window.prompt('Co autor ma poprawić? Powód jest obowiązkowy.')
      : window.prompt('Powód wycofania (opcjonalnie):') ?? '';
    if (stage === 'reject' && !note?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/content/${draft.id}/${stage}`, { note });
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      router.push('/studio');
      router.refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Nie udało się zmienić etapu.');
    } finally {
      setSaving(false);
    }
  };

  const save = async (then?: 'submit' | 'publish') => {
    if (!draft.title.trim()) return setError('Tytuł jest wymagany.');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...draft,
        slug: draft.slug || undefined,
        categoryId: draft.categoryId ?? undefined,
        sourcePostId: draft.sourcePostId ?? undefined,
      };
      const saved = draft.id
        ? (await api.patch(`/content/${draft.id}`, payload)).data
        : (await api.post('/content', payload)).data;

      if (then) await api.patch(`/content/${saved.id}/${then}`, {});

      /*
       * Unieważniamy pamięć podręczną zapytań PRZED powrotem do Studia.
       *
       * Bez tego lista i sam materiał pokazywały stan sprzed zapisu:
       * zmieniona kategoria czy status wracały dopiero po odświeżeniu
       * strony. Wygląda to identycznie jak niezapisana zmiana.
       */
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      router.push('/studio');
      router.refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join('. ') : msg || 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <AppLayout><p className="text-sm text-content-muted">Wczytywanie…</p></AppLayout>;
  }

  if (!user) {
    return (
      <AppLayout>
        <p className="text-sm text-content-muted">Zaloguj się, żeby napisać materiał.</p>
      </AppLayout>
    );
  }

  const allowedTypes = TYPES_BY_ROLE[user.role] ?? [];
  if (allowedTypes.length === 0) {
    return (
      <AppLayout>
        <p className="text-sm text-content-muted">To konto nie może zakładać materiałów.</p>
      </AppLayout>
    );
  }

  const typeChoices = TYPES.filter((t) => allowedTypes.includes(t.value));

  /*
   * Domyślny typ w EMPTY to ARTICLE. Konto, które może pisać wyłącznie
   * wiki, weszłoby więc na /studio/nowy z typem, którego API nie przyjmie,
   * i dowiedziałoby się o tym dopiero przy zapisie.
   */
  if (!id && !allowedTypes.includes(draft.type)) {
    setDraft((d) => ({ ...d, type: allowedTypes[0] }));
  }
  const canPublish = ['ADMIN', 'EDITOR', 'MODERATOR'].includes(user.role);
  const isPublished = draft.status === 'PUBLISHED';
  const isInReview = draft.status === 'REVIEW';

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl">
        <Link href="/studio" className="mb-4 inline-flex items-center gap-1.5 text-xs text-content-muted hover:text-content-primary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Wróć do Studia
        </Link>

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Jeden dozwolony typ nie jest wyborem — zamiast rzędu z jednym
            przyciskiem pokazujemy, co się pisze. */}
        {typeChoices.length === 1 && (
          <p className="mb-4 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs text-content-muted">
            Piszesz <strong className="text-content-primary">hasło wiki</strong>. Trafi do akceptacji —
            moderacja przeczyta je przed publikacją i może odesłać z uwagami.
          </p>
        )}

        <div className={`mb-4 flex-wrap gap-2 ${typeChoices.length > 1 ? 'flex' : 'hidden'}`}>
          {typeChoices.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('type', t.value)}
              title={t.hint}
              aria-pressed={draft.type === t.value}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                draft.type === t.value
                  ? 'border-accent text-accent'
                  : 'border-line text-content-muted hover:text-content-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Tytuł">
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="np. Jak skonfigurować WireGuard na Ubuntu 24.04"
            className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Adres (slug)" hint="Puste = wygenerowany z tytułu. Unikalny w obrębie typu.">
            <input
              value={draft.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="jak-skonfigurowac-wireguard"
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
            />
          </Field>

          <Field label="Kategoria">
            <select
              value={draft.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary"
            >
              <option value="">Bez kategorii</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Zajawka" hint="Dwa–trzy zdania na kafelku i w wynikach wyszukiwania.">
          <textarea
            value={draft.excerpt}
            onChange={(e) => set('excerpt', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
          />
        </Field>

        <Field label="Treść">
          <KnowledgeEditor content={draft.body} onChange={(html) => set('body', html)} />
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Obrazek główny" hint="Wgrany plik albo pełny adres. Pokazywany na kafelku i nad materiałem.">
            <ImageUploadField
              value={draft.coverUrl}
              onChange={(url) => set('coverUrl', url)}
              disabled={!canEdit}
            />
          </Field>

          <Field label="Wątek źródłowy" hint="Dyskusja, z której materiał wyrósł. Rysuje na stronie sekcję „Źródło dyskusji”.">
            <SourcePostField
              value={draft.sourcePostId}
              onChange={(id) => set('sourcePostId', id)}
              disabled={!canEdit}
            />
          </Field>

        <Field
          label="Tagi"
          hint="Czego materiał dotyczy — inaczej niż kategoria, tagi przecinają działy. Trzy do czterech w zupełności wystarczą."
        >
          <TagsField
            value={draft.tagIds}
            onChange={(ids) => set('tagIds', ids)}
            disabled={!canEdit}
          />
        </Field>
        </div>

        <details className="mt-4 rounded-lg border border-line bg-surface-raised p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-content-muted">
            SEO — puste pola oznaczają „użyj tytułu i zajawki"
          </summary>
          <div className="mt-3 space-y-3">
            <Field label="Tytuł w wyszukiwarce">
              <input
                value={draft.metaTitle}
                onChange={(e) => set('metaTitle', e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
              />
            </Field>
            <Field label="Opis w wynikach wyszukiwania">
              <textarea
                value={draft.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
              />
            </Field>
            <Field label="Obrazek przy udostępnieniu">
              <input
                value={draft.ogImage}
                onChange={(e) => set('ogImage', e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent"
              />
            </Field>
          </div>
        </details>

        {/*
          Przyciski zależą od stanu materiału.

          Wcześniej stały tu zawsze te same trzy, więc na materiale JUŻ
          OPUBLIKOWANYM „Opublikuj" kończyło się komunikatem „Materiał jest
          już opublikowany" — i nie było czym zapisać poprawki. Publikacja
          to zmiana etapu, nie zapis treści; na opublikowanym materiale
          potrzebny jest zwykły zapis, który dodatkowo odkłada rewizję.
        */}
        {!canEdit && (
          <p className="mt-5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
            Materiał czeka na akceptację i jest zablokowany do czasu decyzji moderacji.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {isPublished ? (
            <>
              <button
                type="button"
                disabled={saving || !canEdit}
                onClick={() => save()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent/85 disabled:opacity-50"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Zapisz zmiany
              </button>
              {canPublish && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => changeStage('unpublish')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  Wycofaj do szkicu
                </button>
              )}
              <a
                href={`/${PATH_BY_TYPE[draft.type]}/${draft.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Zobacz na stronie
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || !canEdit}
                onClick={() => save()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-50"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Zapisz szkic
              </button>

              {!isInReview && (
                <button
                  type="button"
                  disabled={saving || !canEdit}
                  onClick={() => save('submit')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Zgłoś do akceptacji
                </button>
              )}

              {canPublish && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save('publish')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent/85 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Opublikuj
                </button>
              )}

              {isInReview && canPublish && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => changeStage('reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  Odeślij do poprawy
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-medium text-content-secondary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-2xs text-content-muted">{hint}</p>}
    </div>
  );
}
