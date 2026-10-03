import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // This box serves the live site from .next via `next start`. Setting
  // NEXT_DIST_DIR lets a verification build compile somewhere else instead of
  // overwriting the running build:
  //   NEXT_DIST_DIR=.next-verify npm run build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    /*
     * Grafiki materiałów mieszkają u nas, pod /uploads/ — a ścieżka
     * względna nie wymaga żadnego wpisu na tej liście.
     *
     * Poprzednia lista była w całości spadkiem po xdtv: Twitch CDN, Kick,
     * dexerto, ytimg. Ani jeden z tych serwisów nie ma nic wspólnego
     * z portalem technicznym, a lista i tak nie rozwiązywała problemu:
     * redaktor wkleja adres z DOWOLNEGO serwisu, więc żadne wyliczenie
     * nie będzie kompletne. Obrazki spoza naszej domeny renderujemy
     * zwykłym <img> (patrz CoverImage), zamiast wpisywać kolejne hosty.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'undernet.one', pathname: '/uploads/**' },
    ],
  },
  /**
   * Pliki wgrane przez użytkowników wydaje backend, nie front.
   *
   * W przeglądarce nie jest to problem — nginx kieruje `/uploads/` na
   * backend, zanim żądanie dojdzie do Next.js. Problem ma OPTYMALIZATOR
   * OBRAZKÓW: dostając ścieżkę `/uploads/…`, pobiera ją SAM OD SIEBIE,
   * z portu 3005, gdzie takiej ścieżki nie ma. Zwracał więc 400
   * („The requested resource isn't a valid image") i grafika główna
   * materiału nie pokazywała się w ogóle.
   *
   * To przepisanie dotyczy właśnie tego wewnętrznego pobrania.
   */
  async rewrites() {
    const backend = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4100';
    return [{ source: '/uploads/:path*', destination: `${backend}/uploads/:path*` }];
  },

  async redirects() {
    return [
      // /explore used to bounce to Home; it now has a real destination.
      // /posts previously chained /posts -> /explore -> /, two hops.
      {
        source: '/explore',
        destination: '/discover',
        permanent: true,
      },
      {
        source: '/posts',
        destination: '/discover',
        permanent: true,
      },
      // A clip is a post; the detail view is /posts/:id. Was an app-dir
      // redirect stub, which is a rendered route for something the config
      // resolves in one hop.
      {
        source: '/clips/:id(\\d+)',
        destination: '/posts/:id',
        permanent: true,
      },
      // Duplicate news page — same API, same layout as /news.
      {
        source: '/wiadomosci',
        destination: '/news',
        permanent: true,
      },
      // NOTE: /streamers is deliberately NOT redirected. It is a real page with
      // its own metadata, is linked from nine places and carries SEO value; it
      // simply stops being top-level navigation and gains a Discover tab as a
      // second entry point.
      {
        source: '/chat',
        destination: '/community',
        permanent: true,
      },
      {
        source: '/c/:slug/post/:id',
        destination: '/posts/:id',
        permanent: true,
      },
      {
        source: '/c/:slug',
        destination: '/community/:slug',
        permanent: true,
      },
      {
        source: '/c',
        destination: '/community',
        permanent: true,
      },

    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
