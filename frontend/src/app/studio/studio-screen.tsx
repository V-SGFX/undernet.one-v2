'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileEdit, ClipboardCheck, CheckCircle2, Newspaper, FileText, Wrench, BookOpen,
  ExternalLink, Send, X, Upload, Archive, Plus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { RelativeTime } from '@/components/content/relative-time';
import { PATH_BY_TYPE, type ContentType } from '@/lib/queries/knowledge';
import {
  useStudioStats, useStudioActivity, useStudioList, useTransition,
  type ContentStatus, type StudioItem,
} from '@/lib/queries/studio';

const TYPE_LABEL: Record<ContentType, string> = {
  NEWS: 'News', ARTICLE: 'Artykuł', HOWTO: 'How To', WIKI: 'Wiki',
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: 'Szkic', REVIEW: 'W akceptacji', PUBLISHED: 'Opublikowany', ARCHIVED: 'Zarchiwizowany',
};

const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT: 'border-line text-content-muted',
  REVIEW: 'border-amber-400/40 text-amber-400',
  PUBLISHED: 'border-accent/40 text-accent',
  ARCHIVED: 'border-line text-content-muted opacity-60',
};

/**
 * Undernet Studio.
 *
 * Zaplecze redakcyjne, nie kolejny publiczny moduł. Jedna lista treści
 * na cztery typy — cztery osobne panele różniłyby się wyłącznie filtrem
 * i rozjechały przy pierwszej zmianie obiegu publikacji.
 */
function StudioInner() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <AppLayout><Skeleton className="h-64 w-full" /></AppLayout>;

  if (!user) {
    return (
      <AppLayout>
        <EmptyState
          title="Zaloguj się"
          description="Studio pokazuje Twoje materiały i ich drogę przez akceptację."
        />
      </AppLayout>
    );
  }

  /*
   * Studio ma dwa oblicza.
   *
   * Moderacja wzwyż widzi wszystko: liczniki, cudze materiały, dziennik
   * decyzji i przyciski zatwierdzania. Zwykłe konto widzi wyłącznie swoje
   * teksty i jeden przycisk — „zgłoś do akceptacji". Liczniki i dziennik
   * są tam ukryte nie dla porządku, tylko dlatego, że API odmawia do nich
   * dostępu i panel pokazywałby dwie zepsute kafelki.
   */
  const canReview = ['ADMIN', 'EDITOR', 'MODERATOR'].includes(user.role);
  const canWriteAllTypes = ['ADMIN', 'EDITOR', 'AUTHOR', 'MODERATOR'].includes(user.role);

  return (
    <AppLayout>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-content-primary">Undernet Studio</h1>
          <p className="mt-1 text-sm text-content-muted">
            {canReview
              ? 'Zaplecze redakcyjne — materiały, obieg publikacji, historia decyzji.'
              : 'Twoje hasła wiki i ich droga przez akceptację.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Newsy piszemy ręcznie — skrót prowadzi prosto do pustego newsa. */}
          {['ADMIN', 'EDITOR'].includes(user.role) && (
          <Link
            href="/studio/nowy?typ=news"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-content-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            Napisz news
          </Link>
          )}
          <Link
            href={canWriteAllTypes ? '/studio/nowy' : '/studio/nowy?typ=wiki'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent/85"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {canWriteAllTypes ? 'Nowy materiał' : 'Zaproponuj hasło'}
          </Link>
        </div>
      </header>

      {canReview && <Dashboard />}
      <ContentList canDecide={canReview} />
      {canReview && <Activity />}
    </AppLayout>
  );
}

function Dashboard() {
  const { data, isLoading } = useStudioStats();
  if (isLoading) return <Skeleton className="mb-6 h-24 w-full rounded-lg" />;
  if (!data) return null;

  const cards = [
    { label: 'Szkice', value: data.drafts, icon: FileEdit },
    { label: 'W akceptacji', value: data.review, icon: ClipboardCheck },
    { label: 'Opublikowane dziś', value: data.publishedToday, icon: CheckCircle2 },
    { label: 'News', value: data.news, icon: Newspaper },
    { label: 'Artykuły', value: data.articles, icon: FileText },
    { label: 'How To', value: data.howto, icon: Wrench },
    { label: 'Wiki', value: data.wiki, icon: BookOpen },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-line bg-surface-raised p-3">
          <Icon className="mb-1.5 h-4 w-4 text-content-muted" aria-hidden="true" />
          <p className="text-lg font-bold text-content-primary">{value}</p>
          <p className="text-2xs text-content-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ContentList({ canDecide }: { canDecide: boolean }) {
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [type, setType] = useState<ContentType | ''>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStudioList({
    ...(status && { status }),
    ...(type && { type }),
    page,
  });

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-content-primary">Treści</h2>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Filter value={status} onChange={(v) => { setStatus(v as ContentStatus | ''); setPage(1); }}
            options={[['', 'Każdy status'], ...Object.entries(STATUS_LABEL)]} />
          <Filter value={type} onChange={(v) => { setType(v as ContentType | ''); setPage(1); }}
            options={[['', 'Każdy typ'], ...Object.entries(TYPE_LABEL)]} />
        </div>
      </div>

      {isLoading && <Skeleton className="h-48 w-full rounded-lg" />}

      {!isLoading && (data?.data.length ?? 0) === 0 && (
        <EmptyState title="Brak materiałów" description="Nic nie pasuje do wybranych filtrów." />
      )}

      {!isLoading && (data?.data.length ?? 0) > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
          {data!.data.map((item) => (
            <Row key={item.id} item={item} canDecide={canDecide} />
          ))}
        </ul>
      )}

      {data && data.meta.pages > 1 && (
        <nav aria-label="Stronicowanie" className="mt-3 flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted disabled:opacity-40">
            Poprzednia
          </button>
          <span className="text-xs text-content-muted">{page} z {data.meta.pages}</span>
          <button type="button" disabled={page >= data.meta.pages} onClick={() => setPage(page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted disabled:opacity-40">
            Następna
          </button>
        </nav>
      )}
    </section>
  );
}

function Filter({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-surface-base px-2 py-1 text-xs text-content-secondary"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

function Row({ item, canDecide }: { item: StudioItem; canDecide: boolean }) {
  const transition = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const act = (action: Parameters<typeof transition.mutate>[0]['action'], n?: string) =>
    transition.mutate({ id: item.id, action, note: n });

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 text-2xs ${STATUS_STYLE[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
            <span className="rounded border border-line px-1.5 py-0.5 text-2xs text-content-muted">
              {TYPE_LABEL[item.type]}
            </span>
              <Link
              href={`/studio/${item.id}`}
              className="truncate text-sm font-medium text-content-primary hover:text-accent"
            >
              {item.title}
            </Link>
          </div>
          <p className="mt-1 text-2xs text-content-muted">
            {item.author?.name ?? 'bez autora'}
            {item.category && ` · ${item.category.name}`}
            {' · '}
            <RelativeTime iso={item.updatedAt} />
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {/* Podgląd tylko dla opublikowanych — adres szkicu zwróciłby 404,
              bo API nie wydaje nieopublikowanych materiałów publicznie. */}
          {item.status === 'PUBLISHED' && (
            <Link
              href={`/${PATH_BY_TYPE[item.type]}/${item.slug}`}
              target="_blank"
              className="rounded-lg p-1.5 text-content-muted hover:text-content-primary"
              title="Otwórz na stronie"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}

          {item.status === 'DRAFT' && (
            <ActionButton icon={Send} label="Zgłoś do akceptacji" onClick={() => act('submit')} />
          )}

          {canDecide && item.status === 'REVIEW' && (
            <>
              <ActionButton icon={Upload} label="Publikuj" onClick={() => act('publish')} accent />
              <ActionButton icon={X} label="Odeślij do poprawy" onClick={() => setRejecting(!rejecting)} />
            </>
          )}

          {canDecide && item.status === 'DRAFT' && (
            <ActionButton icon={Upload} label="Publikuj od razu" onClick={() => act('publish')} accent />
          )}

          {canDecide && item.status === 'PUBLISHED' && (
            <>
              <ActionButton icon={FileEdit} label="Wycofaj do szkicu" onClick={() => act('unpublish')} />
              <ActionButton icon={Archive} label="Archiwizuj" onClick={() => act('archive')} />
            </>
          )}
        </div>
      </div>

      {rejecting && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Co poprawić? (wymagane)"
            className="flex-1 rounded-lg border border-line bg-surface-base px-2.5 py-1.5 text-xs text-content-primary"
          />
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => { act('reject', note); setRejecting(false); setNote(''); }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-content-secondary disabled:opacity-40"
          >
            Odeślij
          </button>
        </div>
      )}
    </li>
  );
}

function ActionButton({ icon: Icon, label, onClick, accent }: {
  icon: typeof Send; label: string; onClick: () => void; accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-1.5 transition-colors ${
        accent ? 'text-accent hover:bg-accent/10' : 'text-content-muted hover:text-content-primary'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Activity() {
  const { data } = useStudioActivity(12);
  if (!data?.length) return null;

  return (
    <section>
      <h2 className="mb-3 border-b border-line pb-2 text-sm font-semibold uppercase tracking-wide text-content-primary">
        Ostatnia aktywność redakcyjna
      </h2>
      <ul className="space-y-1.5">
        {data.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-1.5 text-xs text-content-muted">
            <span className="text-content-secondary">
              {e.reviewer?.displayName || e.reviewer?.username || 'system'}
            </span>
            <span>{STATUS_LABEL[e.fromStatus]} → {STATUS_LABEL[e.toStatus]}</span>
            <span className="truncate text-content-primary">{e.contentItem.title}</span>
            <RelativeTime iso={e.createdAt} />
            {e.note && <span className="italic">„{e.note}"</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StudioScreen() {
  return (
    <Suspense fallback={null}>
      <StudioInner />
    </Suspense>
  );
}
