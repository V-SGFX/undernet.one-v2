/** Poradniki — Sieć. */
export default [
  {
    kat: 'siec',
    title: 'Jak zdiagnozować problem z siecią krok po kroku',
    excerpt: 'Uporządkowana ścieżka od karty sieciowej do nazwy domenowej — bez zgadywania.',
    body: `<p>Diagnostyka od dołu w górę oszczędza czas: nie ma sensu badać DNS, gdy nie działa brama.</p><h2>1. Warstwa fizyczna i adres</h2><pre><code>ip -br link show
ip -br addr show</code></pre><p>Stan <code>DOWN</code> to kabel, sterownik albo wyłączony interfejs. Adres <code>169.254.x.x</code> oznacza, że DHCP nie odpowiedział.</p><h2>2. Brama</h2><pre><code>ip route
ping -c3 $(ip route | awk '/default/{print $3}')</code></pre><p>Brak odpowiedzi od bramy przy poprawnym adresie to zwykle problem w sieci lokalnej — nie ma sensu iść dalej.</p><h2>3. Poza sieć lokalną</h2><pre><code>ping -c3 1.1.1.1</code></pre><p>Działa? Trasowanie jest w porządku, problem leży wyżej.</p><h2>4. DNS</h2><pre><code>ping -c3 example.com
dig +short example.com
resolvectl status</code></pre><p>Adres odpowiada, a nazwa nie — to rozwiązywanie nazw i nic innego.</p><h2>5. Konkretna usługa</h2><pre><code>curl -v https://example.com
ss -tanp | grep :443</code></pre><h2>6. Gdzie giną pakiety</h2><pre><code>mtr -rw example.com</code></pre><p>Uwaga przy czytaniu: straty na pośrednim węźle bez strat na końcowym są normalne — routery obniżają priorytet odpowiadania na własny adres. Liczy się ostatni wiersz.</p><h2>7. Duże pakiety</h2><pre><code>ping -M do -s 1472 -c3 example.com</code></pre><p>Małe działają, duże nie — to MTU, nie awaria łącza.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Ta ścieżka wskazuje warstwę, w której leży problem. Naprawa zależy od tego, co się w niej znajdzie — i bywa poza zasięgiem, gdy przyczyna jest po stronie operatora.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak ustawić stały adres IP w Linuksie',
    excerpt: 'Konfiguracja przez NetworkManager, systemd-networkd i netplan — oraz kiedy lepiej użyć rezerwacji DHCP.',
    body: `<p>Sposób zależy od tego, co zarządza siecią w danej dystrybucji. Najpierw to ustalamy.</p><h2>1. Kto zarządza siecią</h2><pre><code>systemctl is-active NetworkManager systemd-networkd</code></pre><h2>2. NetworkManager</h2><pre><code>nmcli con show
nmcli con mod "Wired connection 1" \\
  ipv4.method manual \\
  ipv4.addresses 192.168.1.50/24 \\
  ipv4.gateway 192.168.1.1 \\
  ipv4.dns "1.1.1.1 9.9.9.9"
nmcli con up "Wired connection 1"</code></pre><h2>3. systemd-networkd</h2><p>Plik <code>/etc/systemd/network/10-lan.network</code>:</p><pre><code>[Match]
Name=enp3s0

[Network]
Address=192.168.1.50/24
Gateway=192.168.1.1
DNS=1.1.1.1</code></pre><pre><code>systemctl restart systemd-networkd</code></pre><h2>4. Netplan</h2><p>Plik w <code>/etc/netplan/</code>, wcięcia mają znaczenie:</p><pre><code>network:
  version: 2
  ethernets:
    enp3s0:
      dhcp4: false
      addresses: [192.168.1.50/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1]</code></pre><pre><code>netplan try</code></pre><p><code>netplan try</code> cofa zmiany po chwili bez potwierdzenia — ratuje przed odcięciem się od zdalnej maszyny.</p><h2>5. Rozważ rezerwację DHCP</h2><p>Stały adres przypisany po adresie MAC w routerze daje ten sam skutek, a konfiguracja zostaje w jednym miejscu. Przy kilkunastu urządzeniach jest to wygodniejsze niż ustawienia rozproszone po maszynach.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Adres ustawiony ręcznie w zakresie puli DHCP prędzej czy później doprowadzi do konfliktu. Adresy statyczne trzymamy poza pulą — to ustawienie po stronie routera.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak przekierować port przez SSH',
    excerpt: 'Tunel lokalny, zdalny i pośrednik SOCKS — dostęp do usługi bez wystawiania jej na świat.',
    body: `<p>SSH potrafi przenosić dowolny ruch TCP. To najprostszy sposób sięgnięcia po usługę, która nasłuchuje wyłącznie na pętli zwrotnej serwera.</p><h2>1. Tunel lokalny</h2><pre><code>ssh -L 8080:localhost:80 uzytkownik@serwer</code></pre><p>Port 8080 na twojej maszynie prowadzi do portu 80 widzianego <em>z serwera</em>. Adres w środku jest rozwiązywany po stronie serwera — stąd dostęp do bazy słuchającej tylko lokalnie:</p><pre><code>ssh -L 5432:localhost:5432 uzytkownik@serwer</code></pre><h2>2. Przez maszynę pośrednią</h2><pre><code>ssh -L 8080:192.168.1.20:80 uzytkownik@brama</code></pre><p>Docelowy adres nie musi być samym serwerem — wystarczy, że jest z niego osiągalny.</p><h2>3. Tunel zdalny</h2><pre><code>ssh -R 9000:localhost:3000 uzytkownik@serwer</code></pre><p>Port 9000 na serwerze prowadzi do usługi na twojej maszynie. Domyślnie nasłuchuje wyłącznie na pętli zwrotnej serwera; udostępnienie go szerzej wymaga opcji <code>GatewayPorts</code> w konfiguracji serwera.</p><h2>4. Pośrednik SOCKS</h2><pre><code>ssh -D 1080 uzytkownik@serwer</code></pre><p>Cały ruch przeglądarki ustawionej na ten pośrednik wychodzi z serwera. Prosty zamiennik VPN do przeglądania.</p><h2>5. Bez powłoki, w tle</h2><pre><code>ssh -fN -L 8080:localhost:80 uzytkownik@serwer</code></pre><h2>6. Trwałość</h2><p>W <code>~/.ssh/config</code>:</p><pre><code>Host tunel
  HostName serwer
  LocalForward 8080 localhost:80
  ServerAliveInterval 30
  ExitOnForwardFailure yes</code></pre><p>Ostatnia opcja jest ważna: bez niej SSH zestawi sesję mimo nieudanego przekierowania i będziesz łączyć się donikąd.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Tunel żyje tak długo jak sesja SSH. Do stałego połączenia lepszy jest WireGuard albo narzędzie utrzymujące tunel jako usługę.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak skonfigurować klienta WireGuard na telefonie i laptopie',
    excerpt: 'Dodanie urządzenia do istniejącego tunelu — klucze, AllowedIPs i DNS bez wycieków.',
    body: `<p>Materiał zakłada działający serwer WireGuard. Dokładamy do niego kolejne urządzenie.</p><h2>1. Klucze dla urządzenia</h2><pre><code>umask 077
wg genkey | tee klient.klucz | wg pubkey &gt; klient.pub</code></pre><p>Klucz prywatny powstaje na urządzeniu, na którym będzie używany — nie przesyłamy go między maszynami.</p><h2>2. Wpis po stronie serwera</h2><p>Dopisujemy do <code>/etc/wireguard/wg0.conf</code>:</p><pre><code>[Peer]
PublicKey = &lt;zawartość klient.pub&gt;
AllowedIPs = 10.8.0.3/32</code></pre><p>Adres musi być unikalny w tunelu. Maska <code>/32</code> po stronie serwera oznacza „ten jeden adres należy do tego urządzenia".</p><pre><code>wg syncconf wg0 &lt;(wg-quick strip wg0)</code></pre><p>To przeładowuje konfigurację bez zrywania pozostałych połączeń — w przeciwieństwie do restartu usługi.</p><h2>3. Konfiguracja klienta</h2><pre><code>[Interface]
PrivateKey = &lt;klucz prywatny klienta&gt;
Address = 10.8.0.3/24
DNS = 10.8.0.1

[Peer]
PublicKey = &lt;klucz publiczny serwera&gt;
Endpoint = serwer.example.com:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25</code></pre><h2>4. Cały ruch czy tylko sieć zdalna</h2><ul><li><code>0.0.0.0/0, ::/0</code> — wszystko idzie tunelem.</li><li><code>10.8.0.0/24, 192.168.1.0/24</code> — tunelem tylko sieć zdalna, reszta zwykłym łączem.</li></ul><h2>5. Kod QR dla telefonu</h2><pre><code>qrencode -t ansiutf8 &lt; klient.conf</code></pre><h2>6. Sprawdzenie</h2><pre><code>wg show
curl -4 ifconfig.me</code></pre><p>Drugie polecenie powinno pokazać adres serwera, jeśli tunelujemy wszystko.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przy tunelowaniu całego ruchu bez wpisu <code>DNS</code> zapytania mogą nadal iść do serwera operatora — adresy odwiedzanych stron pozostaną wtedy widoczne mimo działającego tunelu.</p>`,
    sources: [{ url: 'https://www.wireguard.com/quickstart/', title: 'WireGuard — Quick Start' }],
  },
  {
    kat: 'siec',
    title: 'Jak sprawdzić, czy port jest otwarty z zewnątrz',
    excerpt: 'Rozróżnienie między usługą, która nie działa, zaporą a brakiem przekierowania.',
    body: `<p>„Port nie działa" ma kilka różnych przyczyn, a każda wymaga innego działania. Sprawdzamy je po kolei.</p><h2>1. Czy usługa w ogóle słucha</h2><pre><code>ss -tulpn | grep :443</code></pre><p>Adres <code>127.0.0.1:443</code> oznacza nasłuch wyłącznie lokalny — z zewnątrz nikt się nie połączy, niezależnie od zapory i routera. To najczęstsza przyczyna.</p><h2>2. Z tej samej maszyny</h2><pre><code>curl -v http://localhost:443</code></pre><h2>3. Z innej maszyny w sieci lokalnej</h2><pre><code>nc -zv 192.168.1.50 443</code></pre><p>Działa lokalnie, nie działa z sieci — sprawdzamy zaporę na serwerze:</p><pre><code>ufw status
nft list ruleset</code></pre><h2>4. Z internetu</h2><p>Testu nie da się wykonać z własnej sieci — wiele routerów nie obsługuje połączenia do własnego adresu publicznego od środka. Potrzebna jest maszyna na zewnątrz albo publiczny serwis sprawdzający porty.</p><h2>5. Czy w ogóle mamy publiczny adres</h2><pre><code>curl -4 ifconfig.me
ip -4 addr show</code></pre><p>Adres WAN routera w zakresie <code>100.64.0.0/10</code> oznacza CGNAT — przekierowanie portu nie zadziała i trzeba szukać innej drogi.</p><h2>6. Kolejność sprawdzania</h2><ol><li>Usługa słucha na właściwym adresie.</li><li>Zapora na maszynie przepuszcza.</li><li>Przekierowanie portu w routerze.</li><li>Adres publiczny nie jest za CGNAT.</li></ol><h2>Czego ten materiał nie rozwiązuje</h2><p>Otwarty port to zaproszenie dla całego internetu. Zanim się go otworzy, warto rozważyć, czy usługa nie może być dostępna przez VPN — to zwykle prostsze niż utrzymywanie jej bezpiecznej w publicznym dostępie.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak postawić własny serwer DNS z blokowaniem reklam',
    excerpt: 'Rozwiązywanie nazw w sieci lokalnej z listami blokad — i pułapki, o których zwykle nikt nie uprzedza.',
    body: `<p>Własny serwer DNS blokuje reklamy dla wszystkich urządzeń naraz, także dla tych bez możliwości instalacji dodatków.</p><h2>1. Wymagania</h2><p>Maszyna stale włączona ze stałym adresem — komputer jednopłytkowy w zupełności wystarczy. Serwer DNS niedostępny oznacza brak internetu w całej sieci, więc stabilność jest tu ważniejsza niż moc.</p><h2>2. Instalacja</h2><p>Najpopularniejsze rozwiązania to Pi-hole i AdGuard Home. Oba stawiają serwer z interfejsem przeglądarkowym i gotowymi listami.</p><h2>3. Konflikt portu 53</h2><p>W wielu dystrybucjach port zajmuje <code>systemd-resolved</code>. Trzeba zwolnić nasłuch, zostawiając rozwiązywanie nazw dla samego systemu:</p><pre><code>mkdir -p /etc/systemd/resolved.conf.d
printf '[Resolve]\\nDNSStubListener=no\\n' &gt; /etc/systemd/resolved.conf.d/00-dns.conf
systemctl restart systemd-resolved</code></pre><h2>4. Skierowanie sieci</h2><p>W ustawieniach DHCP routera podajemy adres serwera jako jedyny serwer DNS. Podanie drugiego, publicznego, jako zapasowego <strong>zniweczy blokowanie</strong> — urządzenia będą korzystać z obu naprzemiennie.</p><h2>5. Ruch szyfrowany na zewnątrz</h2><p>Warto ustawić serwer nadrzędny po DoH lub DoT, żeby operator nie widział zapytań, których nie zablokowaliśmy.</p><h2>6. Wyjątki</h2><p>Listy blokad regularnie psują pojedyncze usługi — najczęściej powiadomienia, płatności i logowanie przez zewnętrznych dostawców. Reguła praktyczna: gdy coś przestaje działać bez wyraźnej przyczyny, najpierw sprawdzamy dziennik zapytań.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Blokowanie po nazwach nie zadziała wobec reklam serwowanych z tej samej domeny co treść. Nie obejmie też urządzeń z własnym szyfrowanym DNS — część telefonów i przeglądarek omija ustawienia sieci, dopóki się im tego jawnie nie zablokuje.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak przechwycić i przeczytać ruch sieciowy',
    excerpt: 'tcpdump w praktyce — filtry, zapis do pliku i czytanie wyniku bez utonięcia w szumie.',
    body: `<p>Przechwytywanie ruchu rozstrzyga spory typu „to nie dociera" kontra „to nie odpowiada" w kilka sekund.</p><h2>1. Podstawowe użycie</h2><pre><code>tcpdump -i any -n port 443</code></pre><p><code>-n</code> wyłącza rozwiązywanie nazw, które spowalnia i zaśmieca wynik.</p><h2>2. Filtry, które ratują</h2><pre><code>tcpdump -i eth0 -n host 192.168.1.20
tcpdump -i eth0 -n 'tcp port 80 and host example.com'
tcpdump -i eth0 -n 'icmp'
tcpdump -i eth0 -n 'tcp[tcpflags] &amp; tcp-syn != 0'</code></pre><p>Ostatni pokazuje same próby nawiązania połączenia — wygodne przy sprawdzaniu, czy żądanie w ogóle dociera.</p><h2>3. Zapis do pliku</h2><pre><code>tcpdump -i eth0 -n -w slad.pcap -c 1000</code></pre><p>Plik otwieramy w Wireshark, gdzie analiza jest nieporównanie wygodniejsza. Zbieramy na serwerze, oglądamy na swoim komputerze.</p><h2>4. Podgląd treści</h2><pre><code>tcpdump -i eth0 -n -A port 80</code></pre><p>Działa dla ruchu nieszyfrowanego. Przy HTTPS zobaczymy wyłącznie uzgadnianie i zaszyfrowane dane.</p><h2>5. Co odczytać z samego przebiegu</h2><ul><li>SYN bez odpowiedzi — pakiet nie dociera albo jest odrzucany w ciszy.</li><li>SYN i natychmiastowy RST — dociera, ale nikt nie słucha.</li><li>Retransmisje — pakiety giną po drodze.</li><li>Uzgadnianie TLS przerwane po powitaniu — zwykle problem z certyfikatem lub wersją protokołu.</li></ul><h2>6. Uwaga o rozmiarze</h2><p>Przechwytywanie bez filtra na obciążonym serwerze zapełni dysk w minuty. Zawsze z filtrem i limitem pakietów.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przechwytywanie ruchu, który nie jest nasz, bywa naruszeniem prawa i regulaminów. W sieci firmowej wymaga zgody; w cudzej — jest po prostu podsłuchem.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak ustawić odwrotne proxy z certyfikatem',
    excerpt: 'nginx przed aplikacją: HTTPS, przekazanie adresu klienta i obsługa WebSocket.',
    body: `<p>Aplikacja słucha lokalnie na porcie 3000, a świat ma widzieć HTTPS pod nazwą domenową.</p><h2>1. Wymagania wstępne</h2><p>Domena wskazująca na adres serwera oraz otwarte porty 80 i 443. Port 80 jest potrzebny do potwierdzenia władania domeną.</p><h2>2. Konfiguracja</h2><p>Plik <code>/etc/nginx/sites-available/mojaapp</code>:</p><pre><code>server {
    listen 80;
    server_name app.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 25M;
}</code></pre><p>Dwie linie o przełączeniu protokołu są potrzebne dla WebSocket. Bez ostatniej dyrektywy przesyłanie plików większych niż megabajt kończy się błędem 413.</p><h2>3. Włączenie</h2><pre><code>ln -s /etc/nginx/sites-available/mojaapp /etc/nginx/sites-enabled/
nginx -t &amp;&amp; systemctl reload nginx</code></pre><h2>4. Certyfikat</h2><pre><code>apt install certbot python3-certbot-nginx
certbot --nginx -d app.example.com</code></pre><p>Certbot sam dopisze konfigurację HTTPS i przekierowanie z HTTP.</p><h2>5. Odnawianie</h2><pre><code>systemctl list-timers | grep certbot
certbot renew --dry-run</code></pre><h2>6. Strona aplikacji</h2><p>Aplikacja musi ufać nagłówkom przekazanym przez proxy — inaczej zobaczy wszystkie żądania jako pochodzące z adresu lokalnego i wygeneruje odnośniki z <code>http://</code>. W większości frameworków jest na to osobne ustawienie.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Nagłówkom z adresem klienta wolno ufać wyłącznie od własnego proxy. Aplikacja wystawiona równolegle bezpośrednio na świat przyjmie podrobiony nagłówek od dowolnego klienta i obejdzie tym blokady po adresie IP.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak zmierzyć rzeczywistą przepustowość łącza',
    excerpt: 'iperf3 między własnymi maszynami — pomiar, który mówi coś więcej niż test prędkości w przeglądarce.',
    body: `<p>Testy w przeglądarce mierzą trasę do serwera dostawcy testu. Do sprawdzenia własnej sieci potrzebny jest pomiar między własnymi maszynami.</p><h2>1. Serwer</h2><pre><code>iperf3 -s</code></pre><p>Domyślnie nasłuchuje na porcie 5201 — trzeba go przepuścić w zaporze.</p><h2>2. Klient</h2><pre><code>iperf3 -c 192.168.1.50</code></pre><h2>3. Warianty warte uruchomienia</h2><pre><code>iperf3 -c 192.168.1.50 -R          # w drugą stronę
iperf3 -c 192.168.1.50 -P 4        # cztery strumienie równolegle
iperf3 -c 192.168.1.50 -u -b 100M  # UDP z zadanym tempem
iperf3 -c 192.168.1.50 -t 60       # dłuższy pomiar</code></pre><p>Pojedynczy strumień często nie wysyci szybkiego łącza z powodu opóźnień i rozmiaru okna. Kilka równoległych pokazuje realną przepustowość.</p><h2>4. Co mówi test UDP</h2><p>Podajemy tempo i sprawdzamy, ile dotarło. Straty i rozrzut opóźnień są tu ważniejsze od samej przepustowości — to one psują rozmowy głosowe i gry.</p><h2>5. Interpretacja</h2><ul><li>Wynik znacznie poniżej prędkości karty przy krótkim kablu — zwykle negocjacja na niższą prędkość; sprawdzić <code>ethtool</code>.</li><li>Duża różnica między kierunkami — dupleks, kabel albo obciążenie jednej ze stron.</li><li>Wysoka przepustowość przy dużym rozrzucie opóźnień — bufory po drodze, klasyczny bufferbloat.</li></ul><h2>6. Prędkość karty</h2><pre><code>ethtool enp3s0 | grep -E "Speed|Duplex"</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>iperf3 mierzy surową przepustowość między dwoma punktami. Wolne kopiowanie plików przy dobrym wyniku wskazuje na protokół albo dysk, nie na sieć — warto wtedy porównać z pomiarem prędkości samego nośnika.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak skonfigurować zaporę nftables na serwerze',
    excerpt: 'Minimalny, czytelny zestaw reguł z ruchem stanowym i wyjściem awaryjnym.',
    body: `<p>nftables zastąpiło iptables w większości dystrybucji. Poniżej zestaw wystarczający dla typowego serwera.</p><h2>1. Zabezpieczenie przed odcięciem</h2><p>Przed zmianą reguł na zdalnej maszynie uruchamiamy przywrócenie z opóźnieniem:</p><pre><code>echo "nft flush ruleset" | at now + 10 minutes</code></pre><p>Po potwierdzeniu, że dostęp działa, anulujemy zadanie przez <code>atrm</code>.</p><h2>2. Zestaw reguł</h2><p>Plik <code>/etc/nftables.conf</code>:</p><pre><code>#!/usr/sbin/nft -f
flush ruleset

table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;

    ct state established,related accept
    ct state invalid drop
    iif lo accept

    ip protocol icmp accept
    ip6 nexthdr icmpv6 accept

    tcp dport 22 accept
    tcp dport { 80, 443 } accept
  }

  chain forward { type filter hook forward priority 0; policy drop; }
  chain output  { type filter hook output  priority 0; policy accept; }
}</code></pre><h2>3. Wczytanie</h2><pre><code>nft -c -f /etc/nftables.conf
systemctl enable --now nftables</code></pre><p>Przełącznik <code>-c</code> sprawdza składnię bez zastosowania — warto wyrobić sobie nawyk.</p><h2>4. Podgląd</h2><pre><code>nft list ruleset
nft -a list chain inet filter input</code></pre><h2>5. Ograniczenie tempa</h2><pre><code>tcp dport 22 ct state new limit rate 6/minute accept</code></pre><h2>6. Uwaga o ICMP</h2><p>Przepuszczamy ICMP świadomie. Zablokowanie go w całości psuje wykrywanie MTU i daje trudne do zdiagnozowania zawieszanie połączeń.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Docker dopisuje własne reguły i potrafi obejść ustawienia zapory, publikując porty kontenerów mimo zamkniętego wejścia. Na maszynie z Dockerem konfiguracja wymaga dodatkowej uwagi — samo <code>policy drop</code> nie wystarczy.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak naprawić rozwiązywanie nazw w kontenerach Dockera',
    excerpt: 'Typowe przyczyny sytuacji, w której kontener nie widzi świata mimo działającej sieci hosta.',
    body: `<p>Kontener bez działającego DNS objawia się błędami rozwiązywania nazw przy każdej próbie pobrania czegokolwiek.</p><h2>1. Sprawdzenie w kontenerze</h2><pre><code>docker run --rm alpine sh -c "cat /etc/resolv.conf; nslookup example.com"</code></pre><h2>2. Adres 127.0.0.53</h2><p>Jeśli w kontenerze widnieje ten adres, przyczyną jest <code>systemd-resolved</code> na hoście: to jego lokalny pośrednik, niedostępny z sieci kontenera. Rozwiązaniem jest wskazanie prawdziwych serwerów w konfiguracji demona Dockera:</p><pre><code>{
  "dns": ["1.1.1.1", "9.9.9.9"]
}</code></pre><pre><code>systemctl restart docker</code></pre><h2>3. Własna sieć</h2><p>W sieci utworzonej samodzielnie kontenery rozwiązują nawzajem swoje nazwy, w domyślnej sieci mostkowej — nie. To argument, by zawsze tworzyć własną:</p><pre><code>docker network create moja
docker run --network moja --name baza postgres</code></pre><h2>4. Nazwa usługi w compose</h2><p>W pliku compose kontenery widzą się po nazwie usługi, nie po nazwie kontenera. Adres bazy to nazwa usługi, a nie <code>localhost</code> — to najczęstszy błąd w łańcuchach połączeń.</p><h2>5. Kolizja adresacji</h2><p>Domyślna pula Dockera potrafi kolidować z siecią firmową albo VPN. Wtedy część zasobów staje się nieosiągalna:</p><pre><code>{
  "default-address-pools": [{ "base": "10.201.0.0/16", "size": 24 }]
}</code></pre><h2>6. Dostęp do usługi na hoście</h2><pre><code>--add-host=host.docker.internal:host-gateway</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Kontener w trybie sieci hosta korzysta z konfiguracji hosta i żadna z powyższych zmian go nie dotyczy. Warto najpierw sprawdzić, w jakim trybie sieciowym działa.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak sprawdzić certyfikat TLS z wiersza poleceń',
    excerpt: 'Weryfikacja daty ważności, łańcucha i zgodności nazwy bez otwierania przeglądarki.',
    body: `<p>Przeglądarka pokazuje uproszczony obraz i korzysta z certyfikatów pośrednich zapamiętanych wcześniej. Wiersz poleceń mówi, co serwer naprawdę wysyła.</p><h2>1. Pełne połączenie</h2><pre><code>openssl s_client -connect example.com:443 -servername example.com &lt; /dev/null</code></pre><p>Opcja <code>-servername</code> jest konieczna: bez niej serwer odda certyfikat domyślny i wnioski będą błędne.</p><h2>2. Same daty ważności</h2><pre><code>echo | openssl s_client -connect example.com:443 -servername example.com 2&gt;/dev/null \\
  | openssl x509 -noout -dates -subject -issuer</code></pre><h2>3. Łańcuch</h2><pre><code>openssl s_client -connect example.com:443 -servername example.com -showcerts &lt; /dev/null</code></pre><p>Brak certyfikatów pośrednich to najczęstsza przyczyna sytuacji „u mnie działa, u klienta nie". Serwer musi wysłać cały łańcuch poza certyfikatem głównym.</p><h2>4. Szybkie sprawdzenie curl-em</h2><pre><code>curl -vI https://example.com 2&gt;&amp;1 | grep -E "subject|issuer|expire"</code></pre><h2>5. Certyfikat z pliku</h2><pre><code>openssl x509 -in cert.pem -noout -text
openssl x509 -in cert.pem -noout -ext subjectAltName</code></pre><p>Zgodność nazwy sprawdza się dziś w polu alternatywnych nazw, nie w nazwie wyróżniającej — ta ostatnia jest ignorowana przez przeglądarki.</p><h2>6. Czy klucz pasuje do certyfikatu</h2><pre><code>openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa  -noout -modulus -in klucz.pem | openssl md5</code></pre><p>Różne wyniki oznaczają niedopasowaną parę — częsty błąd po odnowieniu.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Poprawny technicznie certyfikat nie mówi nic o tym, kto go ma. Weryfikacja potwierdza władanie domeną w chwili wydania, a nie tożsamość ani uczciwość właściciela.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak udostępnić usługę z sieci domowej bez publicznego IP',
    excerpt: 'Tunel przez własny VPS jako rozwiązanie problemu CGNAT.',
    body: `<p>Przy CGNAT przekierowanie portu w routerze jest bezskuteczne. Rozwiązaniem jest połączenie zestawiane od środka do maszyny z publicznym adresem.</p><h2>1. Potwierdzenie diagnozy</h2><pre><code>curl -4 ifconfig.me
ip -4 addr show dev eth0</code></pre><p>Adres publiczny różny od adresu WAN routera, zwłaszcza z zakresu <code>100.64.0.0/10</code>, potwierdza CGNAT.</p><h2>2. Tunel WireGuard do VPS</h2><p>Po stronie VPS zwykła konfiguracja serwera. Po stronie domowej maszyny klient z podtrzymaniem połączenia:</p><pre><code>[Interface]
PrivateKey = &lt;klucz domowy&gt;
Address = 10.9.0.2/24

[Peer]
PublicKey = &lt;klucz VPS&gt;
Endpoint = vps.example.com:51820
AllowedIPs = 10.9.0.0/24
PersistentKeepalive = 25</code></pre><h2>3. Przekazanie ruchu na VPS</h2><p>Ruch przychodzący na publiczny port VPS kierujemy w tunel:</p><pre><code>sysctl -w net.ipv4.ip_forward=1

nft add table ip nat
nft add chain ip nat prerouting { type nat hook prerouting priority -100 \; }
nft add rule ip nat prerouting tcp dport 443 dnat to 10.9.0.2:443
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }
nft add rule ip nat postrouting ip daddr 10.9.0.2 masquerade</code></pre><h2>4. Prostsza alternatywa</h2><p>Odwrotne proxy na VPS, kierujące na adres w tunelu. Daje przy okazji certyfikaty i dziennik dostępu w jednym miejscu:</p><pre><code>proxy_pass http://10.9.0.2:8080;</code></pre><h2>5. Trwałość</h2><pre><code>systemctl enable --now wg-quick@wg0</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Cały ruch przechodzi przez VPS, więc jego łącze i opóźnienie stają się ograniczeniem. Przy przesyłaniu dużych ilości danych trzeba to policzyć — a przy usługach z limitem transferu również i ten limit.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak diagnozować przerywające Wi-Fi',
    excerpt: 'Kanały, pasma, moc i oszczędzanie energii — od czego zacząć, żeby nie zgadywać.',
    body: `<p>Wi-Fi psuje się w kilku różnych miejscach, a objaw bywa ten sam. Poniżej kolejność od najczęstszych przyczyn.</p><h2>1. Oszczędzanie energii karty</h2><p>Najczęstsza przyczyna zrywania na laptopach z Linuksem:</p><pre><code>iw dev wlan0 get power_save
iw dev wlan0 set power_save off</code></pre><p>Trwale przez konfigurację NetworkManagera:</p><pre><code>[connection]
wifi.powersave = 2</code></pre><h2>2. Jakość sygnału</h2><pre><code>iw dev wlan0 link
watch -n1 "iw dev wlan0 link | grep -E 'signal|bitrate'"</code></pre><p>Poniżej mniej więcej −70 dBm zaczynają się kłopoty. Warto porównać z pomiarem tuż przy punkcie dostępowym.</p><h2>3. Zatłoczenie kanału</h2><pre><code>iw dev wlan0 scan | grep -E "SSID|freq|signal"</code></pre><p>W paśmie 2,4 GHz nie nakładają się wyłącznie kanały 1, 6 i 11. Wybieranie „pustego" kanału 3 oznacza zakłócanie dwóch sąsiednich.</p><h2>4. Pasma</h2><p>2,4 GHz ma większy zasięg i większe zatłoczenie; 5 GHz odwrotnie. Urządzenie przełączające się między nimi w miejscu na granicy zasięgu będzie zrywać — pomaga rozdzielenie nazw sieci dla obu pasm.</p><h2>5. Zewnętrzne źródła zakłóceń</h2><p>Kuchenka mikrofalowa, przewodowe kamery bezprzewodowe i sąsiednie sieci na tym samym kanale. Objaw charakterystyczny: zrywa o określonych porach.</p><h2>6. Sterownik</h2><pre><code>dmesg -T | grep -iE "wlan|iwlwifi|ath|rtw"</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Przy grubych ścianach i dużej odległości żadna konfiguracja nie zastąpi drugiego punktu dostępowego. Wzmacniacz sygnału zwiększa zasięg kosztem przepustowości — bywa lekarstwem gorszym od choroby.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak ustawić serwer poczty do wysyłki z aplikacji',
    excerpt: 'Wysyłanie przez zewnętrznego dostawcę zamiast własnego serwera — i dlaczego zwykle to lepszy wybór.',
    body: `<p>Aplikacja musi wysyłać potwierdzenia rejestracji i resety haseł. Wysyłka wprost z serwera aplikacji niemal zawsze kończy się w spamie.</p><h2>1. Dlaczego nie własny serwer</h2><p>Adresy IP dostawców VPS są zwykle na listach ograniczonego zaufania. Zbudowanie reputacji nowego adresu trwa i wymaga stałej dbałości. Do wysyłki transakcyjnej rozsądniejszy jest dostawca z gotową reputacją.</p><h2>2. Konfiguracja w aplikacji</h2><p>Typowy zestaw parametrów:</p><pre><code>SMTP_HOST=smtp.dostawca.example
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Nazwa serwisu &lt;noreply@twojadomena.pl&gt;"</code></pre><p>Port 587 ze STARTTLS jest dziś standardem; 465 to szyfrowanie od początku połączenia. Port 25 do wysyłki uwierzytelnionej nie służy i bywa blokowany.</p><h2>3. Adres nadawcy musi się zgadzać</h2><p>Domena w polu nadawcy musi być tą, dla której skonfigurowano uwierzytelnianie poczty. Rozjazd między nią a domeną potwierdzoną przez SPF lub DKIM sprawia, że DMARC nie przechodzi.</p><h2>4. Rekordy w DNS</h2><p>Dostawca poda wartości do wpisania — zwykle rekord SPF, klucz DKIM i polityka DMARC. Bez nich wysyłka będzie działać, ale trafi do spamu.</p><h2>5. Sprawdzenie</h2><pre><code>swaks --to test@example.com --from noreply@twojadomena.pl \\
  --server smtp.dostawca.example:587 --tls --auth</code></pre><h2>6. Błędy mają być głośne</h2><p>Nieudana wysyłka nie może być cicho pomijana. Użytkownik czekający na link do potwierdzenia konta nie ma jak się dowiedzieć, że list nigdy nie wyszedł — a bez wpisu w dzienniku nie dowie się tego również administrator.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie obejmuje odbierania poczty. Własny serwer odbiorczy to osobne zagadnienie i znacznie większe zobowiązanie utrzymaniowe niż sama wysyłka.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak ograniczyć dostęp do usługi do wybranych adresów',
    excerpt: 'Filtrowanie po adresie źródłowym w zaporze, proxy i samej usłudze — z uwagą o IPv6.',
    body: `<p>Panel administracyjny albo usługa wewnętrzna nie musi być dostępna dla całego internetu. Ograniczenie można nałożyć na kilku poziomach.</p><h2>1. W zaporze — najskuteczniej</h2><pre><code>nft add rule inet filter input ip saddr { 203.0.113.5, 198.51.100.0/24 } tcp dport 8080 accept
nft add rule inet filter input tcp dport 8080 drop</code></pre><p>Kolejność ma znaczenie: reguła przepuszczająca musi stać przed odrzucającą.</p><h2>2. W nginx</h2><pre><code>location /admin {
    allow 203.0.113.5;
    allow 198.51.100.0/24;
    deny all;
    proxy_pass http://127.0.0.1:3000;
}</code></pre><p>Za kolejnym proxy trzeba użyć modułu rozpoznającego prawdziwy adres klienta z nagłówka, inaczej filtr zobaczy adres pośrednika.</p><h2>3. W samej usłudze</h2><p>Najprościej: nasłuch wyłącznie na pętli zwrotnej i dostęp przez tunel SSH albo VPN. Wtedy nie ma czego filtrować.</p><pre><code>ss -tulpn | grep :8080</code></pre><h2>4. Nie zapomnieć o IPv6</h2><p>Reguła obejmująca tylko IPv4 zostawia usługę otwartą dla całego świata po IPv6. To bardzo częsty błąd — usługa wydaje się zabezpieczona, dopóki ktoś nie połączy się drugim protokołem.</p><pre><code>ss -tulpn | grep -E "\\*:8080|:::8080"</code></pre><h2>5. Weryfikacja</h2><p>Sprawdzenie z maszyny spoza listy, po obu protokołach:</p><pre><code>nc -zv -4 serwer 8080
nc -zv -6 serwer 8080</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Filtrowanie po adresie nie zastępuje uwierzytelniania. Adresy da się podszyć w niektórych scenariuszach, a adres domowy zwykle się zmienia. To warstwa dodatkowa, nie jedyna.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak połączyć dwie sieci lokalne przez WireGuard',
    excerpt: 'Tunel między lokalizacjami z trasowaniem całych podsieci, a nie pojedynczych urządzeń.',
    body: `<p>Celem jest, żeby urządzenia w jednej sieci widziały urządzenia w drugiej bez instalowania czegokolwiek na każdym z nich.</p><h2>1. Warunek wstępny</h2><p>Adresacje obu sieci muszą się różnić. Dwie sieci <code>192.168.1.0/24</code> nie dadzą się połączyć bez przenumerowania jednej z nich.</p><h2>2. Konfiguracja bramy A</h2><pre><code>[Interface]
PrivateKey = &lt;klucz A&gt;
Address = 10.9.0.1/24
ListenPort = 51820

[Peer]
PublicKey = &lt;klucz B&gt;
AllowedIPs = 10.9.0.2/32, 192.168.20.0/24
Endpoint = b.example.com:51820
PersistentKeepalive = 25</code></pre><h2>3. Konfiguracja bramy B</h2><pre><code>[Interface]
PrivateKey = &lt;klucz B&gt;
Address = 10.9.0.2/24
ListenPort = 51820

[Peer]
PublicKey = &lt;klucz A&gt;
AllowedIPs = 10.9.0.1/32, 192.168.10.0/24
Endpoint = a.example.com:51820
PersistentKeepalive = 25</code></pre><p>Sedno: w <code>AllowedIPs</code> wpisujemy nie tylko adres drugiej bramy, ale całą sieć za nią.</p><h2>4. Przekazywanie pakietów</h2><pre><code>sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' &gt; /etc/sysctl.d/99-wg.conf</code></pre><h2>5. Trasy dla pozostałych urządzeń</h2><p>Komputery w sieci A muszą wiedzieć, że droga do <code>192.168.20.0/24</code> prowadzi przez bramę A. Najprościej dodać trasę statyczną w routerze każdej z sieci — inaczej odpowiedzi pójdą do bramy domyślnej i zginą.</p><h2>6. Sprawdzenie</h2><pre><code>wg show
ping -c3 192.168.20.10
traceroute 192.168.20.10</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Połączenie sieci znosi ich wzajemną izolację — urządzenia z jednej lokalizacji stają się osiągalne z drugiej. Jeśli w którejś stoi sprzęt, któremu się nie ufa, trzeba dołożyć filtrowanie na bramie.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak znaleźć urządzenie w sieci lokalnej',
    excerpt: 'Skanowanie własnej sieci, odczyt tablicy sąsiadów i identyfikacja po producencie karty.',
    body: `<p>Sytuacja typowa: urządzenie dostało adres z DHCP, nie wiadomo jaki, a interfejsu nie ma jak inaczej otworzyć.</p><h2>1. Tablica sąsiadów</h2><pre><code>ip neigh show</code></pre><p>Pokazuje urządzenia, z którymi maszyna niedawno rozmawiała. Nie wykryje tych, z którymi nie było kontaktu.</p><h2>2. Wymuszenie odpowiedzi</h2><pre><code>ping -b -c3 192.168.1.255
ip neigh show</code></pre><p>Część urządzeń nie odpowiada na rozgłoszenie — wtedy potrzebne jest skanowanie.</p><h2>3. Skanowanie sieci</h2><pre><code>nmap -sn 192.168.1.0/24</code></pre><p>Wykrywanie bez skanowania portów. Uruchomione z prawami roota używa zapytań ARP, które są szybkie i niezawodne w sieci lokalnej.</p><h2>4. Identyfikacja po producencie</h2><pre><code>arp-scan --localnet</code></pre><p>Pierwsze trzy bajty adresu MAC wskazują producenta karty — pomaga odróżnić kamerę od drukarki bez podłączania się do nich.</p><h2>5. Usługi ogłaszane w sieci</h2><pre><code>avahi-browse -at</code></pre><p>Drukarki, odtwarzacze i urządzenia inteligentnego domu ogłaszają się przez mDNS wraz z nazwą i typem usługi.</p><h2>6. Otwarte porty</h2><pre><code>nmap -sV 192.168.1.42</code></pre><h2>7. Lista klientów w routerze</h2><p>Zwykle najszybsza droga — router ma listę wszystkich przydzielonych dzierżaw wraz z nazwami zgłoszonymi przez urządzenia.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Skanowanie cudzych sieci bywa naruszeniem prawa i regulaminu operatora. To narzędzia do własnej sieci. W sieci firmowej takie skanowanie zwykle wywoła alarm w systemie monitorowania — i słusznie.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak przyspieszyć wolne przesyłanie plików w sieci lokalnej',
    excerpt: 'Ustalenie, czy winna jest sieć, dysk czy protokół — i co da się z każdym z nich zrobić.',
    body: `<p>„Sieć jest wolna" bywa fałszywą diagnozą. Najpierw ustalamy, co naprawdę ogranicza.</p><h2>1. Zmierz sieć osobno</h2><pre><code>iperf3 -s          # na jednej maszynie
iperf3 -c serwer   # na drugiej</code></pre><p>Wynik bliski prędkości karty oznacza, że sieć nie jest problemem.</p><h2>2. Zmierz dysk osobno</h2><pre><code>dd if=/dev/zero of=proba bs=1M count=2000 oflag=direct
dd if=proba of=/dev/null bs=1M iflag=direct</code></pre><p>Flaga <code>direct</code> omija pamięć podręczną systemu — bez niej mierzy się prędkość RAM, a nie dysku.</p><h2>3. Prędkość karty</h2><pre><code>ethtool enp3s0 | grep -E "Speed|Duplex"</code></pre><p>Karta wynegocjowana na 100 Mb/s zamiast gigabita to zwykle kabel albo port — częsta i łatwa do przeoczenia przyczyna.</p><h2>4. Protokół</h2><p>SMB i NFS mają różną charakterystykę, szczególnie przy wielu małych plikach. Przy przenoszeniu tysięcy plików narzut na plik dominuje nad przepustowością — pomaga spakowanie w archiwum przed przesłaniem.</p><h2>5. SSH jako wąskie gardło</h2><p>Przy szybkich łączach szyfrowanie potrafi ograniczać transfer. Dla danych niewrażliwych w sieci lokalnej szybszy bywa <code>rsync</code> w trybie demona bez szyfrowania.</p><h2>6. Wiele małych plików</h2><pre><code>tar cf - katalog | ssh serwer "tar xf - -C /cel"</code></pre><p>Jeden strumień zamiast tysięcy osobnych operacji.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przy dysku talerzowym po drugiej stronie prędkość zapisu losowego pozostanie niska niezależnie od sieci. Gigabitowe łącze przewyższa możliwości wielu dysków przy małych plikach — wtedy problem jest w nośniku, a nie w sieci.</p>`,
  },
  {
    kat: 'siec',
    title: 'Jak skonfigurować IPv6 w sieci domowej',
    excerpt: 'Od sprawdzenia, czy operator go daje, po działające adresy i zaporę.',
    body: `<p>IPv6 rozwiązuje problem CGNAT i daje publiczne adresy wszystkim urządzeniom — razem z konsekwencjami, o których trzeba wiedzieć.</p><h2>1. Czy operator udostępnia</h2><pre><code>curl -6 ifconfig.co
ip -6 addr show</code></pre><p>Adres zaczynający się od <code>2</code> lub <code>3</code> to adres globalny. Wyłącznie <code>fe80::</code> oznacza brak IPv6 z zewnątrz.</p><h2>2. Prefiks dla sieci</h2><p>Operator przydziela zwykle prefiks <code>/56</code> lub <code>/64</code>. Router musi go pobrać przez delegację prefiksu DHCPv6 — to osobne ustawienie od samego adresu WAN.</p><h2>3. Ogłoszenia routera</h2><p>Urządzenia w sieci konfigurują się same przez SLAAC, o ile router ogłasza prefiks. W ustawieniach szuka się opcji dotyczących ogłoszeń routera.</p><h2>4. Sprawdzenie na kliencie</h2><pre><code>ip -6 addr show
ip -6 route show
ping6 -c3 2606:4700:4700::1111</code></pre><p>Kilka adresów IPv6 na jednym interfejsie to stan normalny — jeden stały i tymczasowe do połączeń wychodzących.</p><h2>5. Zapora, teraz obowiązkowa</h2><p>Nie ma tu NAT, więc każde urządzenie ma adres osiągalny z internetu. Router musi domyślnie blokować ruch przychodzący:</p><pre><code>nft add rule inet filter input ip6 nexthdr icmpv6 accept
nft add rule inet filter forward ct state established,related accept</code></pre><p>ICMPv6 musi przechodzić — w odróżnieniu od IPv4 protokół nie działa bez niego, bo obsługuje wykrywanie sąsiadów.</p><h2>6. Diagnostyka</h2><pre><code>ping6 -c3 google.com
dig AAAA example.com</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Część usług i urządzeń nadal nie obsługuje IPv6. Wyłączanie IPv4 nie wchodzi w grę — obie wersje działają równolegle, co oznacza dwie konfiguracje i dwie zapory do utrzymania.</p>`,
  },
];
