import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from "./providers";
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

/*
 * `latin-ext` jest OBOWIĄZKOWE, nie ozdobne.
 *
 * Podzbiór `latin` NIE zawiera ą, ć, ę, ł, ń, ś, ź ani ż. Bez niego
 * przeglądarka bierze te litery z zapasowego kroju systemowego, więc
 * w polskim zdaniu co drugi wyraz ma inny rysunek i inną szerokość.
 * Na portalu pisanym po polsku to widać w każdym akapicie.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://undernet.one'),
  title: {
    default: 'UNDERNET.ONE — wiedza techniczna od prawdziwego problemu',
    template: '%s | UNDERNET.ONE',
  },
  description: 'Portal dla administratorów i programistów: forum, artykuły, instrukcje krok po kroku i wiki. Linux, sieci, kod, sprzęt, bezpieczeństwo.',
  keywords: [
    'linux',
    'administracja serwerami',
    'sieci komputerowe',
    'bezpieczeństwo it',
    'poradniki techniczne',
    'forum techniczne',
    'wiki it',
    'undernet',
  ],
  applicationName: 'UNDERNET.ONE',
  authors: [{ name: 'UNDERNET.ONE' }],
  publisher: 'UNDERNET.ONE',
  category: 'technology',
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://undernet.one',
    siteName: 'UNDERNET.ONE',
    title: 'UNDERNET.ONE — wiedza techniczna od prawdziwego problemu',
    description: 'Dyskusje, artykuły, how-to i wiki. Materiały wyrastają z realnych problemów, nie z przepisanej dokumentacji.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'UNDERNET.ONE — wiedza techniczna',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNDERNET.ONE — wiedza techniczna od prawdziwego problemu',
    description: 'Forum, artykuły, how-to i wiki dla ludzi, którzy utrzymują systemy.',
    images: ['/opengraph-image'],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://undernet.one',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://undernet.one/#organization',
      name: 'UNDERNET.ONE',
      url: 'https://undernet.one',
      logo: 'https://undernet.one/opengraph-image',
      sameAs: [
        'https://undernet.one/community',
        'https://undernet.one/wiki',
        'https://undernet.one/how-to',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://undernet.one/#website',
      name: 'UNDERNET.ONE',
      url: 'https://undernet.one',
      inLanguage: 'pl-PL',
      publisher: { '@id': 'https://undernet.one/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://undernet.one/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        Nie ma tu skryptu ustawiającego motyw.

        Stał w <head>, blokował pierwsze malowanie przy KAŻDYM wejściu
        i czytał `undernet_theme` z magazynu lokalnego — po to, żeby
        ustawić atrybut `data-theme`, na który NIC w arkuszu stylów nie
        reagowało (sprawdzone: zero reguł). Serwis ma jeden motyw,
        ciemny. Skrypt, kontekst motywu i dostawca wyleciały razem,
        bo żaden komponent nie wywoływał `useTheme()` ani razu.
      */}
      <body className="min-h-full bg-dark-950 text-text-primary">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {/*
            Powłoka renderowana RAZ, tutaj — nie przez każdą stronę osobno.
            Dzięki temu pasek nawigacji przetrwa przejście między stronami,
            a pływające podkreślenie ma się z czym animować.
          */}
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
