export interface User {
  id: number;
  email?: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Role undernetu. AUTHOR tworzy materiały, EDITOR je akceptuje
   *  i publikuje, MODERATOR pilnuje społeczności. STREAMER został
   *  po szkielecie xdtv i nic tu nie znaczy. */
  role: 'USER' | 'AUTHOR' | 'EDITOR' | 'MODERATOR' | 'ADMIN' | 'STREAMER';
  createdAt: string;
  /** Rozszerzony profil (UNDERNET PRO). Płatne jest USTAWIENIE tych pól,
   *  nie ich odczyt — kto straci PRO, nie znika z sieci. */
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  bannerUrl?: string | null;

  /** Ozdoby nicku i awatara (UNDERNET PRO). Backend przysyła sam KLUCZ
   *  z zamkniętej listy — rozwijamy go na klasy w `lib/ozdoby.ts`. */
  isPro?: boolean;
  proUntil?: string | null;
  nameColor?: string | null;
  nameStyle?: string | null;
  avatarRing?: string | null;
}

/**
 * Autor pod wpisem, komentarzem, w wynikach wyszukiwania.
 *
 * Osobny typ, bo podpis nosi dziś więcej niż nick i awatar: doszły
 * ozdoby, a rozpisywanie ich w każdym `Pick<User, …>` z osobna kończyło
 * się tym, że jedno miejsce zostawało w tyle i gwiazdka tam nie wchodziła.
 */
export type Podpis = Pick<
  User,
  'id' | 'username' | 'displayName' | 'avatarUrl'
  | 'isPro' | 'proUntil' | 'nameColor' | 'nameStyle' | 'avatarRing'
>;


export interface Post {
  id: number;
  title: string;
  content: string;
  type: 'TEXT' | 'LINK' | 'IMAGE' | 'VIDEO' | 'CLIP' | 'POLL' | 'AMA';
  isOfficial: boolean;
  isNsfw: boolean;
  isFlagged: boolean;
  imageUrl: string | null;
  linkUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  clipSource: 'UPLOAD' | 'YOUTUBE' | 'TIKTOK' | 'TWITCH' | 'KICK' | null;
  externalId: string | null;
  duration: number | null;
  viewCount: number;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: string;
  author: Podpis & { role?: string };
  community?: Pick<Community, 'id' | 'slug' | 'name' | 'iconUrl' | 'color'> | null;
  tags?: Tag[];
  images?: { id: number; url: string; order: number }[];
  amaSession?: { id: number; endsAt: string; isOpen: boolean; _count: { questions: number } } | null;
  poll?: {
    id: number;
    endsAt: string | null;
    options: { id: number; text: string; order: number; voteCount: number }[];
  } | null;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'PREMIUM';
  isActive: boolean;
  _count?: { messages: number };
}

export interface Community {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  color: string | null;
  isOfficial: boolean;
  postCount: number;
  /** Wątki należące wprost do tego działu, bez podkategorii.
   *  Rozstrzyga o indeksowaniu — patrz komentarz w CommunitiesService. */
  postCountWlasny?: number;
  /** Grupa nadrzędna. Puste = dział najwyższego poziomu. */
  parentId?: number | null;
  position?: number;
  memberCount: number;
  createdById: number;
  createdAt: string;
  isJoined: boolean;
  createdBy?: Podpis;
  moderators?: { id: number; user: Podpis }[];
  _count?: { posts: number; moderators: number; bans?: number };
}

export interface Message {
  id: number;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  author: Podpis & { role: string };
}

export interface News {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
  sourceUrl: string;
  source: 'RSS' | 'SCRAPER' | 'MANUAL';
  sourceName: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface Comment {
  id: number;
  postId: number;
  content: string;
  upvotes: number;
  downvotes: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: Podpis & { role: string };
  parentId: number | null;
  depth?: number;
  path?: string;
  replyCount?: number;
  userVote?: 'UP' | 'DOWN' | null;
  replies?: Comment[];
}

export interface PlatformStats {
  usersTotal: number;
  activeUsers: number;
  messagesToday: number;
  postsToday: number;
  newUsersToday: number;
  activeSubscriptions: number;
  channelsTotal: number;
  newsTotal: number;
}

export interface Battle {
  id: number;
  title: string | null;
  status: 'ACTIVE' | 'FINISHED';
  votes1: number;
  votes2: number;
  endsAt: string;
  createdAt: string;
}

