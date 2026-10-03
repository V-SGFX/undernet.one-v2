'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { PATH_BY_TYPE, type ContentType } from '@/lib/queries/knowledge';
import { SearchFilters, PUSTE_FILTRY, type Filtry } from './search-filters';
import {
  Search, BookOpen, FileText, User, Newspaper,
  ArrowBigUp, ArrowBigDown, MessageSquare, Users, Radio,
  ExternalLink, Eye, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/*
 * Zakładka „streamerzy" znikła razem z warstwą streamingu, a jej miejsce
 * zajęła baza wiedzy. To nie była kosmetyka: backend zwraca pulę `content`,
 * front czytał `results.streamers` — klucz, którego w odpowiedzi nie ma.
 * Wyszukiwarka pokazywała więc pustą sekcję streamerów i ani jednego
 * artykułu, how-to czy hasła wiki.
 */
type Tab = 'all' | 'content' | 'posts' | 'users' | 'news';

interface SearchResults {
  content: any[];
  posts: any[];
  users: any[];
  news: any[];
}

const TYPE_LABEL: Record<ContentType, string> = {
  NEWS: 'News',
  ARTICLE: 'Artykuł',
  HOWTO: 'How To',
  WIKI: 'Wiki',
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResults>({ content: [], posts: [], users: [], news: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [searched, setSearched] = useState(false);
  const [filtry, setFiltry] = useState<Filtry>(PUSTE_FILTRY);
  const [filtryZastosowane, setFiltryZastosowane] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const t = useTranslations('search');

  const doSearch = useCallback(async (q: string, f: Filtry = PUSTE_FILTRY) => {
    if (q.trim().length < 2) { setResults({ content: [], posts: [], users: [], news: [] }); setSearched(false); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ q: q.trim(), limit: '15' });
      if (f.typ) qs.set('typ', f.typ);
      if (f.kategoria) qs.set('kategoria', f.kategoria);
      if (f.od) qs.set('od', f.od);
      if (f.do) qs.set('do', f.do);
      if (f.wTresci) qs.set('wTresci', '1');

      const { data } = await api.get(`/search?${qs.toString()}`);
      setResults(data);
      // Backend MÓWI, czy filtry zadziałały. Bez tego wynik bez zawężenia
      // wygląda identycznie jak zawężenie, które nic nie odsiało.
      setFiltryZastosowane(Boolean(data?.filtryZastosowane));
      setSearched(true);
    } catch {
      setSearched(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
    inputRef.current?.focus();
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value, filtry), 300);
  };

  /* Zmiana filtra ma odświeżyć wyniki od razu — inaczej trzeba by jeszcze
     raz ruszyć pole tekstowe, co nikomu nie przychodzi do głowy. */
  const handleFiltry = (f: Filtry) => {
    setFiltry(f);
    if (query.trim().length >= 2) doSearch(query, f);
  };

  const totalResults = results.content.length + results.posts.length + results.users.length + results.news.length;

  const tabs: { key: Tab; label: string; count: number; icon: any }[] = [
    { key: 'all', label: t('tabAll'), count: totalResults, icon: Search },
    { key: 'content', label: 'Wiedza', count: results.content.length, icon: BookOpen },
    { key: 'posts', label: t('tabPosts'), count: results.posts.length, icon: FileText },
    { key: 'users', label: t('tabUsers'), count: results.users.length, icon: Users },
    { key: 'news', label: t('tabNews'), count: results.news.length, icon: Newspaper },
  ];

  const showContent = (tab === 'all' || tab === 'content') && results.content.length > 0;
  const showPosts = (tab === 'all' || tab === 'posts') && results.posts.length > 0;
  const showUsers = (tab === 'all' || tab === 'users') && results.users.length > 0;
  const showNews = (tab === 'all' || tab === 'news') && results.news.length > 0;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Pole wyszukiwania niesie całą treść tej strony, ale dokument
            i tak potrzebuje nazwy — dla czytnika ekranu i dla wyszukiwarki. */}
        <h1 className="sr-only">Szukaj w UNDERNET.ONE</h1>

        {/* Zawężanie wyników — część UNDERNET PRO. */}
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t('fullPlaceholder')}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_0_3px_rgba(0,245,255,0.1)] transition-all text-base"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        <SearchFilters wartosci={filtry} onChange={handleFiltry} />
        {filtryZastosowane && (
          <p className="text-xs text-neon-cyan">Wyniki zawężone filtrami.</p>
        )}

        {/* Tabs */}
        {searched && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    tab === t.key
                      ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                      : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count > 0 && <span className="text-2xs opacity-70">({t.count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty / no results states */}
        {!searched && !loading && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-lg">{t('minCharsToSearch')}</p>
            <p className="text-white/25 text-sm mt-1">{t('searchDesc')}</p>
          </div>
        )}
        {searched && totalResults === 0 && !loading && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-lg">{t('noResults', { query })}</p>
            <p className="text-white/25 text-sm mt-1">{t('tryDifferent')}</p>
          </div>
        )}

        {/* ═══ Baza wiedzy ═══ */}
        {showContent && (
          <Section title="Wiedza" icon={BookOpen} count={results.content.length}>
            <div className="grid gap-2">
              {results.content.map((c) => (
                <Link
                  key={`${c.type}-${c.id}`}
                  href={`/${PATH_BY_TYPE[c.type as ContentType]}/${c.slug}`}
                  className="group flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-neon-cyan/30 hover:bg-white/[0.06] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-2xs font-semibold uppercase text-white/50">
                        {TYPE_LABEL[c.type as ContentType]}
                      </span>
                      {c.category && (
                        <span className="text-2xs text-white/30">{c.category.name}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors">
                      {c.title}
                    </p>
                    {c.excerpt && (
                      <p className="mt-0.5 text-xs text-white/40 line-clamp-2">{c.excerpt}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-neon-cyan shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* ═══ Posts ═══ */}
        {showPosts && (
          <Section title={t('tabPosts')} icon={FileText} count={results.posts.length}>
            <div className="grid gap-2">
              {results.posts.map((p) => {
                const score = (p.upvotes || 0) - (p.downvotes || 0);
                return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className="group flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-neon-purple/30 hover:bg-white/[0.06] transition-all"
                  >
                    {/* Score column */}
                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[40px] py-1">
                      <ArrowBigUp className={`w-4 h-4 ${score > 0 ? 'text-neon-green' : 'text-white/30'}`} />
                      <span className={`text-xs font-bold ${score > 0 ? 'text-neon-green' : score < 0 ? 'text-neon-red' : 'text-white/30'}`}>
                        {score}
                      </span>
                      <ArrowBigDown className={`w-4 h-4 ${score < 0 ? 'text-neon-red' : 'text-white/30'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-sm font-semibold text-white group-hover:text-neon-purple transition-colors line-clamp-2">
                        {p.title}
                      </p>
                      {p.content && (
                        <p className="text-xs text-white/30 line-clamp-1">
                          {p.content.replace(/<[^>]*>/g, '').slice(0, 120)}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-2xs text-white/30">
                        <span className="flex items-center gap-1">
                          <Avatar src={p.author.avatarUrl} name={p.author.displayName || p.author.username} size="xs" />
                          <span className="text-white/50 font-medium">{p.author.displayName || p.author.username}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {p.commentCount}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: pl })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Section>
        )}

        {/* ═══ Users ═══ */}
        {showUsers && (
          <Section title={t('tabUsers')} icon={Users} count={results.users.length}>
            <div className="grid gap-2">
              {results.users.map((u) => {
                const roleColors: Record<string, string> = {
                  ADMIN: 'text-neon-red bg-neon-red/10 border-neon-red/20',
                  MODERATOR: 'text-neon-yellow bg-neon-yellow/10 border-neon-yellow/20',
                  STREAMER: 'text-neon-pink bg-neon-pink/10 border-neon-pink/20',
                  'USER': 'text-white/30 bg-white/[0.06] border-white/[0.08]',
                };
                return (
                  <Link
                    key={u.id}
                    href={`/profile/${u.username}`}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-neon-cyan/30 hover:bg-white/[0.06] transition-all"
                  >
                    <Avatar src={u.avatarUrl} name={u.displayName || u.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors">
                        {u.displayName || u.username}
                      </p>
                      <p className="text-xs text-white/30">@{u.username}</p>
                    </div>
                    <span className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-md border ${roleColors[u.role] || roleColors.USER}`}>
                      {u.role}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Section>
        )}

        {/* ═══ News ═══ */}
        {showNews && (
          <Section title={t('tabNews')} icon={Newspaper} count={results.news.length}>
            <div className="grid gap-2">
              {results.news.map((n) => (
                <a
                  key={n.id}
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-neon-pink/30 hover:bg-white/[0.06] transition-all"
                >
                  {n.imageUrl && (
                    <img src={n.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-semibold text-white group-hover:text-neon-pink transition-colors line-clamp-2 flex-1">
                        {n.title}
                      </p>
                      <ExternalLink className="w-3.5 h-3.5 text-white/30 shrink-0 group-hover:text-neon-pink transition-colors mt-0.5" />
                    </div>
                    {n.summary && (
                      <p className="text-xs text-white/30 line-clamp-2">{n.summary}</p>
                    )}
                    <div className="flex items-center gap-2 text-2xs text-white/30">
                      {n.sourceName && (
                        <span className="px-1.5 py-0.5 bg-white/[0.06] rounded text-white/50 font-medium">{n.sourceName}</span>
                      )}
                      {n.publishedAt && <span>{formatDistanceToNow(new Date(n.publishedAt), { addSuffix: true, locale: pl })}</span>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Section>
        )}
      </div>
    </AppLayout>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-neon-cyan" />
        <span className="text-sm font-bold text-white uppercase tracking-wider">{title}</span>
        <span className="text-xs text-white/30 font-medium">({count})</span>
      </div>
      {children}
    </motion.div>
  );
}
