'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { UserPostsWall } from '@/components/content/user-posts-wall';
import { SavedWall } from '@/components/content/saved-wall';
import { CollectionsWall } from '@/components/content/collections-wall';
import { NotesWall } from '@/components/content/notes-wall';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import {
  Settings, PenLine, MessageSquare, Heart, ThumbsUp, Calendar, Shield, Tv, Bookmark, FolderOpen, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { UserName } from '@/components/ui/user-name';

interface ProfileData {
  id: number;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  isPro?: boolean;
  proUntil?: string | null;
  nameColor?: string | null;
  nameStyle?: string | null;
  avatarRing?: string | null;
  _count: { posts: number; comments: number; follows: number; votes: number };
}

/**
 * Co użytkownik obserwuje.
 *
 * Backend zwraca cztery pule pod `/follows`. Ten ekran wołał `/follows/me`
 * — trasy, której nie ma — i czekał na tablicę profili streamerów, więc
 * zakładka „Obserwowane" była pusta niezależnie od stanu konta.
 */
interface Follows {
  communities: { id: number; slug: string; name: string; iconUrl: string | null }[];
  tags: { id: number; slug: string; name: string }[];
  authors: { id: number; slug: string; name: string; avatarUrl: string | null }[];
  posts: { id: number; title: string }[];
}

const EMPTY_FOLLOWS: Follows = { communities: [], tags: [], authors: [], posts: [] };

export default function ProfilePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('profile');
  const tFeed = useTranslations('feed');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [follows, setFollows] = useState<Follows>(EMPTY_FOLLOWS);
  const [tab, setTab] = useState<'posts' | 'saved' | 'collections' | 'notes' | 'follows'>('posts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/login'); return; }

    const fetchAll = async () => {
      try {
        // Posts are owned by UserPostsWall now; this only loads the
        // identity and follow data the header needs.
        const [meRes, followsRes] = await Promise.all([
          api.get('/users/me'),
          api.get('/follows'),
        ]);
        setProfile(meRes.data);
        setFollows(followsRes.data ?? EMPTY_FOLLOWS);
      } catch { /* */ }
      setLoading(false);
    };
    fetchAll();
  }, [token, authLoading]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  const roleLabels: Record<string, string> = {
    USER: t('roleUser'),
    STREAMER: t('roleStreamer'),
    MODERATOR: t('roleModerator'),
    ADMIN: t('roleAdmin'),
  };

  const stats = [
    { label: t('tabPosts'), value: profile._count.posts, icon: PenLine },
    { label: t('tabComments'), value: profile._count.comments, icon: MessageSquare },
    { label: t('tabFollowing'), value: profile._count.follows, icon: Heart },
    { label: t('tabVotes'), value: profile._count.votes, icon: ThumbsUp },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-neon p-6"
        >
          <div className="flex items-start gap-5">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName || profile.username}
              ozdoby={profile}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-text-primary">
                  <UserName user={profile} />
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                  <Shield className="w-3 h-3" />
                  {roleLabels[profile.role] || profile.role}
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">@{profile.username}</p>
              <div className="flex items-center gap-1.5 text-xs text-text-dimmed mt-2">
                <Calendar className="w-3.5 h-3.5" />
                {t('joined', { time: formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: dateLocale }) })}
              </div>

              {/* Stats */}
              <div className="flex gap-4 mt-4">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="text-center">
                      <div className="flex items-center gap-1 text-text-primary font-semibold text-sm">
                        <Icon className="w-3.5 h-3.5 text-neon-cyan" />
                        {s.value}
                      </div>
                      <div className="text-2xs text-text-dimmed uppercase tracking-wider">{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" /> {tNav('settings')}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto bg-dark-800/50 rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setTab('posts')}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'posts' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <PenLine className="w-4 h-4" /> {t('myPosts', { count: profile._count.posts })}
          </button>
          <button
            onClick={() => setTab('saved')}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'saved' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <Bookmark className="w-4 h-4" /> {tFeed('savedTitle')}
          </button>
          <button
            onClick={() => setTab('collections')}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'collections' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <FolderOpen className="w-4 h-4" /> Kolekcje
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'notes' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <NotebookPen className="w-4 h-4" /> Notatki
          </button>
          <button
            onClick={() => setTab('follows')}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'follows' ? 'bg-dark-700/60 text-neon-cyan' : 'text-text-muted hover:text-text-primary hover:bg-dark-700/60'
            }`}
          >
            <Heart className="w-4 h-4" /> {t('myFollowing', { count: profile._count.follows })}
          </button>
        </div>

        {/* Tab content */}
        {tab === 'posts' && (
          <UserPostsWall
            endpoint="/users/me/posts"
            label={t('myPosts')}
            emptyTitle={t('noPosts')}
          />
        )}

        {tab === 'saved' && <SavedWall />}

        {/* Kolekcje — nazwane zbiory, warstwa nad płaską listą „Zapisane". */}
        {tab === 'collections' && <CollectionsWall />}

        {/* Notatki — prywatne zapiski przypięte do materiałów i wątków. */}
        {tab === 'notes' && <NotesWall />}

        {tab === 'follows' && (
          <FollowsTab follows={follows} emptyLabel={t('noFollowing')} />
        )}
      </div>
    </AppLayout>
  );
}

/** Cztery pule obserwacji w jednej liście. */
function FollowsTab({ follows, emptyLabel }: { follows: Follows; emptyLabel: string }) {
  const rows = [
    ...follows.communities.map((c) => ({ key: `c${c.id}`, href: `/community?community=${c.slug}`, label: `c/${c.slug}`, kind: 'Społeczność' })),
    ...follows.authors.map((a) => ({ key: `a${a.id}`, href: `/discover?author=${a.slug}`, label: a.name, kind: 'Autor' })),
    ...follows.tags.map((tg) => ({ key: `t${tg.id}`, href: `/discover?tag=${tg.slug}`, label: `#${tg.slug}`, kind: 'Tag' })),
    ...follows.posts.map((p) => ({ key: `p${p.id}`, href: `/posts/${p.id}`, label: p.title, kind: 'Wątek' })),
  ];

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Heart className="mx-auto mb-3 h-10 w-10 text-text-dimmed" />
        <p className="text-text-muted">{emptyLabel}</p>
        <Link href="/community" className="mt-3 inline-block">
          <Button variant="primary" size="sm">Przeglądaj społeczności</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Link
          key={r.key}
          href={r.href}
          className="card-neon flex items-center gap-3 p-4 transition-colors hover:border-neon-cyan/30"
        >
          <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-2xs font-semibold uppercase text-white/50">
            {r.kind}
          </span>
          <span className="truncate font-medium text-text-primary">{r.label}</span>
        </Link>
      ))}
    </div>
  );
}
