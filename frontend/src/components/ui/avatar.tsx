'use client';
import { mediaUrl } from '@/lib/api-url';
import { klasyOtoczki, otoczkaGradientowa, type Ozdoby } from '@/lib/ozdoby';
import { useOzdobyPlatne } from '@/lib/queries/premium';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Status = 'online' | 'offline' | 'live' | 'none';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  status?: Status;
  className?: string;
  /** Konto, z którego bierzemy otoczkę. Bez PRO otoczka nie wchodzi. */
  ozdoby?: Ozdoby | null;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-2xs', status: 'w-2 h-2 -bottom-0 -right-0' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2.5 h-2.5 -bottom-0 -right-0' },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-3 h-3 -bottom-0.5 -right-0.5' },
  lg: { container: 'w-14 h-14', text: 'text-lg', status: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5' },
  xl: { container: 'w-24 h-24', text: 'text-3xl', status: 'w-5 h-5 -bottom-1 -right-1' },
};

const colorMap = [
  'from-neon-purple to-neon-cyan',
  'from-neon-pink to-neon-purple',
  'from-neon-cyan to-neon-green',
  'from-neon-green to-neon-cyan',
  'from-neon-purple to-neon-pink',
];

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % colorMap.length;
}



function resolveUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith('/uploads/')) return mediaUrl(src);
  return src;
}

export function Avatar({
  src, name, size = 'md', status = 'none', className = '', ozdoby,
}: AvatarProps) {
  const ozdobyPlatne = useOzdobyPlatne();
  const s = sizeMap[size];
  const gradientClass = colorMap[getColorIndex(name)];
  const resolvedSrc = resolveUrl(src);

  /* Otoczka zastępuje zwykłą obwódkę, a nie dokłada się do niej — dwie
     obwódki naraz dają brzydki podwójny pierścień. */
  const otoczka = klasyOtoczki(ozdoby, ozdobyPlatne);
  const gradientowa = otoczkaGradientowa(ozdoby, ozdobyPlatne);
  const obwodka = gradientowa ? '' : otoczka || 'ring-2 ring-dark-800';

  return (
    <div
      className={`relative inline-flex shrink-0 ${
        gradientowa
          ? 'rounded-full bg-gradient-to-br from-neon-cyan via-neon-purple to-neon-pink p-[2px]'
          : ''
      } ${className}`}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          className={`${s.container} rounded-full object-cover ${obwodka}`}
        />
      ) : (
        <div
          className={`${s.container} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center ${obwodka}`}
        >
          <span className={`${s.text} font-bold text-white`}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {status !== 'none' && (
        <span className={`absolute ${s.status} rounded-full status-${status}`} />
      )}
    </div>
  );
}
