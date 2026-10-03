/**
 * Nadawanie tagów materiałom.
 *
 * Tagi celowo NIE powielają kategorii. Kategoria odpowiada na pytanie
 * „w której półce to stoi", tag na „czego dotyczy" — i dlatego przecina
 * kategorie: SSH pojawia się w Sieci, Systemie i Bezpieczeństwie.
 *
 * Wyzwalacze wypisane są jawnie, zamiast dopasowywania po podobieństwie.
 * Tag nadany błędnie jest gorszy niż jego brak: prowadzi czytelnika do
 * listy, na której nie ma tego, czego szukał.
 *
 * Uruchomienie:
 *   node scripts/tresci/tagi.mjs --sucho
 *   node scripts/tresci/tagi.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUCHO = process.argv.includes('--sucho');

/** Najwyżej tyle tagów na materiał — dłuższa lista przestaje cokolwiek znaczyć. */
const LIMIT = 4;

/**
 * [slug tagu, nazwa, wyzwalacze].
 *
 * Wyzwalacz sprawdzany jest w tytule, zajawce i treści. Krótkie i wieloznaczne
 * hasła (jak „sieć") świadomie pominięte — trafiałyby wszędzie.
 */
const TAGI = [
  // Najpierw tagi wąskie — one niosą najwięcej informacji.
  ['docker', 'docker', ['Docker', 'kontener', 'Dockerfile', 'compose']],
  ['ssh', 'ssh', ['SSH', 'sshd', 'ssh-keygen']],
  ['dns', 'dns', ['DNS', 'rekord TXT', 'rekordy DNS', 'nazw domenow', 'rozwiązywani']],
  ['tls', 'tls', ['TLS', 'certyfikat', 'HTTPS', 'openssl']],
  ['vpn', 'vpn', ['WireGuard', 'VPN', 'tunel']],
  ['kopie-zapasowe', 'kopie zapasowe', ['kopia zapasowa', 'kopie zapasow', 'kopii zapasow', 'pg_dump', 'restic']],
  ['ssd', 'ssd', ['SSD', 'NVMe', 'TRIM', 'NAND']],
  ['raid', 'raid', ['RAID', 'mdadm', 'macierz']],
  ['postgresql', 'postgresql', ['PostgreSQL', 'psql', 'EXPLAIN', 'pg_']],
  ['git', 'git', ['git ', 'Git ', 'commit', 'GitHub']],
  ['prywatnosc', 'prywatność', ['prywatno', 'anonimowość', 'anonimowy', 'podsłuch', 'śledzi']],
  ['szyfrowanie', 'szyfrowanie', ['szyfrow', 'LUKS', 'klucz prywatny', 'kryptograficzn']],
  ['ipv6', 'ipv6', ['IPv6']],
  ['nginx', 'nginx', ['nginx']],
  ['nodejs', 'node.js', ['Node.js', 'npm ', 'node ']],
  ['wirtualizacja', 'wirtualizacja', ['maszyn wirtualn', 'maszyny wirtualn', 'maszynie wirtualn', 'IOMMU', 'hipernadzorc']],
  ['poczta', 'poczta', ['poczty', 'poczta', 'SMTP', 'DMARC', 'DKIM']],
  ['wifi', 'wi-fi', ['Wi-Fi', 'WPA', 'punkt dostępow', 'punktu dostępow']],
  ['monitoring', 'monitoring', ['monitorow', 'powiadomien', 'alarm', 'S.M.A.R.T.']],
  ['zapora', 'zapora', ['zapor', 'nftables', 'iptables', 'ufw ']],
  ['pamiec', 'pamięć', ['pamięci RAM', 'modułów pamięci', 'wyciek pamięci', 'OOM', 'swap']],
  ['zasilanie', 'zasilanie', ['zasilacz', 'zasilania', 'UPS', 'poboru mocy', 'pobór mocy']],

  // Ogólne na końcu: wchodzą tylko wtedy, gdy zostało miejsce
  // w limicie. Inaczej „linux" wypierałby „zaporę" z poradnika
  // o zaporze, bo pasuje do niemal wszystkiego.
  ['linux', 'linux', ['jądra Linux', 'jądro Linux', 'w Linuksie', 'dystrybucji', 'Debianie']],
  ['systemd', 'systemd', ['systemd', 'systemctl', 'journalctl']],
  ['diagnostyka', 'diagnostyka', ['diagnost', 'Objawy', 'objaw', 'dmesg', 'ustalamy', 'rozstrzyga']],
  ['wydajnosc', 'wydajność', ['wydajno', 'przepustowo', 'opóźnie', 'spowalnia', 'iperf', 'fio ']],
];

async function main() {
  const materialy = await prisma.contentItem.findMany({
    where: { type: { in: ['WIKI', 'HOWTO'] }, status: 'PUBLISHED' },
    select: { id: true, slug: true, title: true, excerpt: true, body: true },
    orderBy: { id: 'asc' },
  });

  // Tagi zakładamy raz, z góry — inaczej równoległe wstawianie
  // rozbijałoby się o unikalność adresu.
  const mapaTagow = new Map();
  for (const [slug, nazwa] of TAGI) {
    if (SUCHO) { mapaTagow.set(slug, { id: -1 }); continue; }
    const t = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name: nazwa },
      select: { id: true },
    });
    mapaTagow.set(slug, t);
  }

  let zTagami = 0;
  let przypisan = 0;
  const licznik = new Map();

  for (const m of materialy) {
    const tekst = `${m.title} ${m.excerpt ?? ''} ${m.body}`;
    const trafione = [];

    for (const [slug, , wyzwalacze] of TAGI) {
      if (trafione.length >= LIMIT) break;
      if (wyzwalacze.some((w) => tekst.includes(w))) trafione.push(slug);
    }

    if (trafione.length === 0) continue;
    zTagami += 1;
    trafione.forEach((t) => licznik.set(t, (licznik.get(t) ?? 0) + 1));

    if (SUCHO) {
      console.log('  ' + m.slug.padEnd(52) + ' → ' + trafione.join(', '));
      continue;
    }

    for (const slug of trafione) {
      const tag = mapaTagow.get(slug);
      const juz = await prisma.contentItemTag.findFirst({
        where: { contentItemId: m.id, tagId: tag.id },
        select: { contentItemId: true },
      });
      if (juz) continue;
      await prisma.contentItemTag.create({ data: { contentItemId: m.id, tagId: tag.id } });
      przypisan += 1;
    }
  }

  console.log('\n  materiałów z tagami: ' + zTagami + ' / ' + materialy.length +
    (SUCHO ? '' : ' · przypisań: ' + przypisan));
  console.log('  rozkład:');
  [...licznik.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log('    ' + t.padEnd(16) + n));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
