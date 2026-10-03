/**
 * Okładki materiałów.
 *
 * To NIE są ilustracje. To karty kategorii: kolor, nazwa działu i typ
 * materiału. Nie udają, że pokazują cokolwiek związanego z treścią —
 * grafika udająca ilustrację przy tekście technicznym wygląda jak zapchajdziura
 * i po pierwszym zetknięciu przestaje cokolwiek znaczyć.
 *
 * Wariant każdej karty wyliczany jest z adresu materiału, więc jest stały
 * między uruchomieniami, a siatka kilkunastu kafelków w jednej kategorii
 * nie wygląda jak powtarzająca się tapeta.
 *
 * Uruchomienie:
 *   node scripts/tresci/okladki.mjs --sucho
 *   node scripts/tresci/okladki.mjs
 *   node scripts/tresci/okladki.mjs --nadpisz   (przelicz istniejące)
 */
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');
const NADPISZ = process.argv.includes('--nadpisz');

const SZER = 1200;
const WYS = 675;
const KATALOG = path.join(process.cwd(), 'uploads', 'okladki');

/** Kolor wiodący działu — ten sam, którego używa reszta serwisu. */
const KOLORY = {
  system: '#8B5CF6',
  siec: '#00D4FF',
  kod: '#34D399',
  sprzet: '#FB8B3C',
  bezpieczenstwo: '#F43F5E',
};

const ETYKIETY = { WIKI: 'WIKI', HOWTO: 'HOW TO', ARTICLE: 'ARTYKUŁ', NEWS: 'NEWS' };

/**
 * Liczba wyprowadzona z tekstu.
 *
 * Potrzebna, żeby ten sam materiał zawsze dostawał ten sam wariant —
 * inaczej każde przeliczenie zmieniałoby wszystkie okładki i wywracało
 * pamięci podręczne przeglądarek bez powodu.
 */
function ziarno(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i += 1) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function svg({ kolor, nazwaDzialu, etykieta, z }) {
  // Wszystkie warianty wyprowadzone z jednej liczby.
  const kat = -20 - (z % 35);                 // nachylenie pasów
  const ile = 3 + (z % 4);                    // ile pasów
  const przesuniecie = z % 240;               // przesunięcie poziome
  const gx = 20 + ((z >> 3) % 60);            // środek poświaty, w procentach
  const gy = 20 + ((z >> 7) % 50);
  const gest = 44 + ((z >> 5) % 26);          // gęstość siatki

  const pasy = Array.from({ length: ile }, (_, i) => {
    const x = przesuniecie + i * (260 + (z % 90));
    const w = 6 + ((z >> (i + 1)) % 26);
    const o = (0.16 - i * 0.03).toFixed(3);
    return `<rect x="${x}" y="-200" width="${w}" height="${WYS + 400}" fill="${kolor}" opacity="${o}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SZER}" height="${WYS}">
  <defs>
    <radialGradient id="p" cx="${gx}%" cy="${gy}%" r="70%">
      <stop offset="0%" stop-color="${kolor}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${kolor}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="s" width="${gest}" height="${gest}" patternUnits="userSpaceOnUse">
      <path d="M ${gest} 0 L 0 0 0 ${gest}" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${SZER}" height="${WYS}" fill="#08080e"/>
  <rect width="${SZER}" height="${WYS}" fill="url(#s)"/>
  <g transform="rotate(${kat} ${SZER / 2} ${WYS / 2})">${pasy}</g>
  <rect width="${SZER}" height="${WYS}" fill="url(#p)"/>

  <rect x="0" y="0" width="${SZER}" height="6" fill="${kolor}" opacity="0.85"/>

  <text x="72" y="112" font-family="DejaVu Sans" font-size="26" font-weight="bold"
        fill="#ffffff" fill-opacity="0.45" letter-spacing="7">${etykieta}</text>

  <text x="72" y="${WYS - 96}" font-family="DejaVu Sans" font-size="86" font-weight="bold"
        fill="${kolor}">${nazwaDzialu}</text>

  <text x="72" y="${WYS - 52}" font-family="DejaVu Sans" font-size="21"
        fill="#ffffff" fill-opacity="0.3" letter-spacing="4">UNDERNET.ONE</text>
</svg>`;
}

async function main() {
  const materialy = await prisma.contentItem.findMany({
    where: { type: { in: ['WIKI', 'HOWTO'] }, status: 'PUBLISHED' },
    select: { id: true, slug: true, type: true, coverUrl: true, category: { select: { slug: true, name: true } } },
    orderBy: { id: 'asc' },
  });

  if (!SUCHO) await mkdir(KATALOG, { recursive: true });

  let zrobionych = 0;
  let pominietych = 0;

  for (const m of materialy) {
    // Cudzej okładki nie ruszamy. Redakcja wstawiła ją świadomie,
    // a wygenerowana karta byłaby krokiem wstecz.
    if (m.coverUrl && !NADPISZ) { pominietych += 1; continue; }

    const dzial = m.category?.slug ?? 'system';
    const kolor = KOLORY[dzial] ?? KOLORY.system;
    const nazwa = m.category?.name ?? 'UNDERNET';

    const zrodlo = svg({
      kolor,
      nazwaDzialu: nazwa,
      etykieta: ETYKIETY[m.type] ?? m.type,
      z: ziarno(m.slug),
    });

    const nazwaPliku = `${m.type.toLowerCase()}-${m.slug}.webp`;
    const adres = `/uploads/okladki/${nazwaPliku}`;

    if (SUCHO) {
      console.log('  ' + adres);
      zrobionych += 1;
      continue;
    }

    const buf = await sharp(Buffer.from(zrodlo)).webp({ quality: 88 }).toBuffer();
    await writeFile(path.join(KATALOG, nazwaPliku), buf);
    await prisma.contentItem.update({ where: { id: m.id }, data: { coverUrl: adres } });
    zrobionych += 1;
  }

  console.log('\n  okładek: ' + zrobionych + (pominietych ? ' · pominiętych (mają własną): ' + pominietych : ''));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
