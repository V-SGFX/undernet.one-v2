/** Poradniki — Bezpieczeństwo. */
export default [
  {
    kat: 'bezpieczenstwo',
    title: 'Jak zabezpieczyć świeżo postawiony serwer',
    excerpt: 'Pierwsze pół godziny po instalacji — kolejność kroków, które naprawdę zmniejszają ryzyko.',
    body: `<p>Serwer wystawiony do internetu zaczyna być skanowany w ciągu minut. Poniżej kolejność od największego zysku.</p><h2>1. Klucze zamiast haseł</h2><pre><code>ssh-copy-id uzytkownik@serwer</code></pre><p>Po potwierdzeniu, że logowanie kluczem działa — w drugiej, otwartej sesji:</p><pre><code>PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password</code></pre><pre><code>sshd -t &amp;&amp; systemctl reload ssh</code></pre><p>To jedna zmiana, która usuwa sens wszystkich ataków siłowych.</p><h2>2. Zapora</h2><pre><code>ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw enable</code></pre><h2>3. Aktualizacje bezpieczeństwa</h2><pre><code>apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades</code></pre><h2>4. Konto zwykłego użytkownika</h2><pre><code>adduser admin
usermod -aG sudo admin</code></pre><p>Praca na roocie oznacza, że każda pomyłka ma pełne uprawnienia.</p><h2>5. Co nasłuchuje</h2><pre><code>ss -tulpn</code></pre><p>Usługi widoczne na wszystkich adresach, których nie potrzebujemy z zewnątrz, przestawiamy na pętlę zwrotną. Najlepszy port to port zamknięty.</p><h2>6. Czas</h2><pre><code>timedatectl set-ntp true</code></pre><h2>7. Ograniczenie hałasu</h2><pre><code>apt install fail2ban
systemctl enable --now fail2ban</code></pre><p>Przy wyłączonym logowaniu hasłem to porządkowanie dzienników, nie linia obrony — ale dzienniki stają się czytelne.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zmiana portu SSH nie jest zabezpieczeniem, tylko ograniczeniem hałasu w dziennikach. Nie chroni też przed podatnością w usłudze, którą świadomie wystawiamy — tam liczą się aktualizacje i ograniczenie uprawnień.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak sprawdzić, czy serwer nie został przejęty',
    excerpt: 'Ślady, których szuka się w pierwszej kolejności, i zasada ograniczonego zaufania do własnych narzędzi.',
    body: `<p>Podejrzenie włamania wymaga uporządkowanego przeglądu. Zaczynamy od rzeczy najtrudniejszych do ukrycia.</p><h2>1. Kto się logował</h2><pre><code>last -20
lastb -20
journalctl -u ssh --since "7 days ago" | grep -i "accepted"</code></pre><p>Logowanie z nieznanego adresu albo o nietypowej porze jest pierwszym sygnałem.</p><h2>2. Klucze SSH</h2><pre><code>cat ~/.ssh/authorized_keys
find /home /root -name authorized_keys -exec ls -l {} \;</code></pre><p>Dopisanie własnego klucza to najczęstszy sposób utrwalenia dostępu.</p><h2>3. Konta i uprawnienia</h2><pre><code>awk -F: '$3 == 0 {print}' /etc/passwd
grep -v ':\\*:\\|:!' /etc/shadow | cut -d: -f1</code></pre><p>Konta z identyfikatorem zero poza rootem nie powinny istnieć.</p><h2>4. Co działa i co nasłuchuje</h2><pre><code>ss -tulpn
ps auxf</code></pre><p>Proces bez ścieżki, o nazwie udającej systemową albo działający z katalogu tymczasowego to poważny sygnał.</p><h2>5. Utrwalenie</h2><pre><code>systemctl list-units --type=service --state=running
systemctl list-timers
crontab -l; for u in $(cut -d: -f1 /etc/passwd); do crontab -u $u -l 2&gt;/dev/null; done
ls -la /etc/cron.*</code></pre><h2>6. Pliki zmienione ostatnio</h2><pre><code>find /etc /usr/bin /usr/sbin -mtime -7 -type f</code></pre><h2>7. Zasada ograniczonego zaufania</h2><p>Na przejętej maszynie własne narzędzia mogą kłamać. Poważne podejrzenie oznacza analizę z zewnątrz — z nośnika ratunkowego albo z migawki dysku.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przy potwierdzonym włamaniu jedyną rzetelną drogą jest odtworzenie systemu od zera i wymiana wszystkich kluczy oraz haseł, które na nim były. Sprzątanie znalezionych śladów zostawia te, których się nie znalazło.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak włączyć dwuskładnikowe logowanie do SSH',
    excerpt: 'Klucz plus kod jednorazowy — konfiguracja bez ryzyka odcięcia się od serwera.',
    body: `<p>Wymaganie dwóch składników przy logowaniu ma sens tam, gdzie klucz prywatny może trafić w niepowołane ręce.</p><h2>1. Instalacja modułu</h2><pre><code>apt install libpam-google-authenticator</code></pre><h2>2. Konfiguracja dla użytkownika</h2><pre><code>google-authenticator -t -d -f -r 3 -R 30 -W</code></pre><p>Zapisujemy kody zapasowe. Bez nich utrata telefonu oznacza utratę dostępu.</p><h2>3. Konfiguracja PAM</h2><p>W <code>/etc/pam.d/sshd</code> dodajemy:</p><pre><code>auth required pam_google_authenticator.so nullok</code></pre><p>Opcja <code>nullok</code> przepuszcza użytkowników, którzy jeszcze nie skonfigurowali kodów — usuwamy ją po skonfigurowaniu wszystkich kont.</p><h2>4. Konfiguracja SSH</h2><pre><code>KbdInteractiveAuthentication yes
AuthenticationMethods publickey,keyboard-interactive</code></pre><p>Przecinek oznacza „oba wymagane". Spacja oznaczałaby „wystarczy jeden".</p><h2>5. Test bez ryzyka</h2><pre><code>sshd -t
systemctl reload ssh</code></pre><p><strong>Nie zamykamy bieżącej sesji.</strong> W drugim oknie próbujemy się zalogować. Dopiero po udanej próbie zamykamy pierwszą.</p><h2>6. Wyjątki</h2><p>Automatyczne zadania i systemy wdrożeniowe nie podadzą kodu. Dla nich robi się wyjątek po adresie źródłowym albo po użytkowniku:</p><pre><code>Match User wdrozenia
    AuthenticationMethods publickey</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Kod oparty na czasie wymaga zgodnych zegarów. Serwer z rozjechanym czasem odrzuci wszystkie kody — dlatego synchronizacja czasu musi działać, zanim się to włączy. Warto też mieć drugą drogę wejścia, na przykład konsolę u dostawcy.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak skonfigurować kopie zapasowe odporne na oprogramowanie szyfrujące',
    excerpt: 'Kopie, których zainfekowana maszyna nie może zaszyfrować ani skasować.',
    body: `<p>Kopia dostępna do zapisu z zainfekowanej maszyny zostanie zaszyfrowana razem z oryginałem. Odporność polega na tym, że maszyna nie ma władzy nad swoimi kopiami.</p><h2>1. Kierunek połączenia</h2><p>Serwer kopii sam pobiera dane z chronionej maszyny, zamiast przyjmować to, co ona wyśle. Wtedy przejęcie tej maszyny nie daje dostępu do archiwum.</p><h2>2. Klucz tylko do dodawania</h2><p>Przy narzędziach z repozytorium kopii — jak restic czy borg — używamy poświadczeń pozwalających wyłącznie dopisywać, bez prawa kasowania i nadpisywania. Wtedy nawet mając klucz, atakujący nie usunie historii.</p><h2>3. Niezmienność po stronie magazynu</h2><p>Obiekty z blokadą na określony czas, migawki po stronie systemu plików albo nośnik odłączany fizycznie. Kopia offline jest najprostszą i wciąż najskuteczniejszą formą.</p><h2>4. Kilka punktów w czasie</h2><p>Szyfrowanie bywa zauważane po dniach. Kopia z ostatniej doby może być już bezużyteczna — potrzebna jest polityka przechowywania obejmująca tygodnie i miesiące:</p><pre><code>restic forget --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune</code></pre><h2>5. Osobne poświadczenia</h2><p>Konto używane do kopii nie może być tym samym, którym loguje się administrator. Przejęcie stacji roboczej nie powinno dawać dostępu do archiwum.</p><h2>6. Monitorowanie</h2><p>Brak wykonanej kopii musi być zauważony. Cisza jest tu najgorszym stanem — proces, który przestał działać miesiąc temu, zwykle nikomu nie daje znać.</p><h2>7. Test odtworzenia</h2><p>Regularne odtworzenie losowych plików, okresowo całego systemu. Kopia nietestowana jest założeniem, nie zabezpieczeniem.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Odtworzenie z kopii nie odpowiada na pytanie, którędy weszli. Bez ustalenia i zamknięcia drogi wejścia historia się powtórzy — czasem z użyciem dostępu zdobytego przy pierwszym razie.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak sprawdzić bezpieczeństwo konfiguracji TLS na własnym serwerze',
    excerpt: 'Wersje protokołu, zestawy szyfrów i nagłówki — z wiersza poleceń i bez wysyłania domeny na zewnątrz.',
    body: `<p>Domyślna konfiguracja bywa albo zbyt liberalna, albo zbyt restrykcyjna dla starszych klientów. Warto ją zmierzyć.</p><h2>1. Obsługiwane wersje</h2><pre><code>for v in tls1 tls1_1 tls1_2 tls1_3; do
  echo -n "$v: "
  echo | openssl s_client -connect example.com:443 -servername example.com -$v 2&gt;/dev/null \\
    | grep -q "Protocol" &amp;&amp; echo OBSŁUGIWANY || echo brak
done</code></pre><p>TLS 1.0 i 1.1 powinny być wyłączone.</p><h2>2. Skanowanie lokalne</h2><pre><code>nmap --script ssl-enum-ciphers -p 443 example.com
testssl.sh example.com</code></pre><p>Oba narzędzia działają z własnej maszyny, bez wysyłania niczego do usług zewnętrznych — istotne przy systemach wewnętrznych.</p><h2>3. Rozsądna konfiguracja nginx</h2><pre><code>ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;</code></pre><h2>4. Łańcuch certyfikatów</h2><pre><code>openssl s_client -connect example.com:443 -servername example.com -showcerts &lt; /dev/null</code></pre><p>Brak certyfikatów pośrednich to najczęstszy błąd — działa w przeglądarce, nie działa w narzędziach i u części klientów.</p><h2>5. Nagłówki</h2><pre><code>curl -sI https://example.com | grep -iE "strict-transport|content-security|x-frame|x-content-type"</code></pre><h2>6. Pilnowanie terminu</h2><pre><code>echo | openssl s_client -connect example.com:443 -servername example.com 2&gt;/dev/null \\
  | openssl x509 -noout -enddate</code></pre><p>Automatyczne odnawianie potrafi cicho przestać działać. Powiadomienie na dwa tygodnie przed terminem ratuje przed awarią w weekend.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Doskonała konfiguracja TLS nie zabezpiecza aplikacji. Chroni dane w drodze i nic poza tym — podatność w kodzie pozostaje podatnością niezależnie od oceny szyfrowania.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak ograniczyć uprawnienia usługi w systemd',
    excerpt: 'Kilkanaście linii, które znacząco zmniejszają skutki przejęcia procesu.',
    body: `<p>systemd ma wbudowany zestaw ograniczeń, których włączenie kosztuje kilka linii i nie wymaga zmian w aplikacji.</p><h2>1. Punkt wyjścia</h2><pre><code>systemd-analyze security nazwa.service</code></pre><p>Narzędzie ocenia jednostkę i wypisuje, co można poprawić. Ocena to wskazówka, nie cel sam w sobie.</p><h2>2. Podstawowy zestaw</h2><pre><code>[Service]
User=mojaapp
Group=mojaapp
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictRealtime=true
LockPersonality=true
MemoryDenyWriteExecute=true</code></pre><h2>3. Zapis tylko tam, gdzie trzeba</h2><pre><code>ReadWritePaths=/var/lib/mojaapp /var/log/mojaapp
StateDirectory=mojaapp
LogsDirectory=mojaapp</code></pre><p>Dwie ostatnie opcje tworzą katalogi z właściwym właścicielem automatycznie.</p><h2>4. Ograniczenie sieci</h2><pre><code>RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
IPAddressDeny=any
IPAddressAllow=localhost 10.0.0.0/8</code></pre><h2>5. Zdolności zamiast roota</h2><pre><code>AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE</code></pre><p>Pozwala otworzyć port poniżej 1024 bez uprawnień roota do reszty systemu.</p><h2>6. Wdrażanie stopniowe</h2><p>Wszystkie opcje naraz zwykle psują działającą usługę. Dokładamy po kilka, sprawdzając po każdej zmianie:</p><pre><code>systemctl daemon-reload
systemctl restart nazwa
journalctl -u nazwa -n 50</code></pre><p>Opcja <code>MemoryDenyWriteExecute</code> psuje aplikacje kompilujące kod w locie — czyli większość języków z maszyną wirtualną.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>To ograniczanie szkód, nie zapobieganie włamaniu. Podatność w aplikacji nadal daje atakującemu dostęp do jej danych — ograniczenia decydują tylko o tym, jak daleko sięgnie dalej.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak bezpiecznie udostępnić plik lub hasło innej osobie',
    excerpt: 'Metody odpowiednie do zagrożenia — od zaszyfrowanego archiwum po współdzielony menedżer haseł.',
    body: `<p>Hasło wysłane komunikatorem zostaje w historii rozmowy po obu stronach, w kopiach zapasowych i często na serwerze dostawcy.</p><h2>1. Hasło w zespole</h2><p>Menedżer haseł ze wspólnym schowkiem. Rozwiązuje przy okazji odbieranie dostępu przy odejściu osoby — bez tego jedyną drogą jest zmiana wszystkich haseł.</p><h2>2. Jednorazowy przekaz</h2><p>Usługi tworzące odnośnik ważny do pierwszego otwarcia. Sam odnośnik nadal jedzie kanałem, któremu ufamy tylko częściowo — ale przynajmniej nie zostaje w historii na stałe.</p><h2>3. Plik zaszyfrowany hasłem</h2><pre><code>gpg -c --cipher-algo AES256 dokument.pdf</code></pre><p>Powstaje plik <code>.gpg</code>. Hasło przekazujemy <strong>innym kanałem</strong> niż plik — inaczej cała operacja nic nie daje.</p><h2>4. Plik zaszyfrowany kluczem odbiorcy</h2><pre><code>gpg --recipient odbiorca@example.com --encrypt dokument.pdf</code></pre><p>Nie wymaga uzgadniania hasła. Wymaga posiadania klucza publicznego odbiorcy i sprawdzenia jego odcisku niezależnym kanałem.</p><h2>5. Archiwum</h2><pre><code>7z a -p -mhe=on archiwum.7z katalog/</code></pre><p>Opcja <code>-mhe=on</code> szyfruje także nazwy plików — bez niej lista zawartości jest jawna.</p><h2>6. Wielkie pliki</h2><p>Szyfrujemy plik, wysyłamy przez dowolną usługę, hasło przekazujemy osobno. Zaufanie do usługi przestaje wtedy mieć znaczenie.</p><h2>7. Higiena</h2><p>Hasła nie wpisujemy w wierszu poleceń jako argument — trafia do historii powłoki i jest widoczne w liście procesów dla innych użytkowników.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Po przekazaniu tracisz kontrolę. Odbiorca może plik skopiować, przesłać dalej albo zostawić na niezabezpieczonym dysku. Szyfrowanie chroni dane w drodze, a nie po dotarciu.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak reagować na wyciek własnego klucza lub hasła',
    excerpt: 'Kolejność działań w pierwszych minutach — i częsty błąd polegający na odwróceniu tej kolejności.',
    body: `<p>Klucz w publicznym repozytorium bywa wykorzystany w ciągu minut. Boty przeszukują nowe commity nieprzerwanie.</p><h2>1. Unieważnij — natychmiast</h2><p>To jedyny krok, który naprawdę coś zmienia. Wszystko inne może poczekać.</p><pre><code># przykłady
aws iam delete-access-key --access-key-id AKIA...
gh auth refresh
# oraz: usunięcie klucza w panelu każdego dostawcy</code></pre><h2>2. Sprawdź, czy zdążyli</h2><p>Dzienniki dostępu, historia rozliczeń, powiadomienia o logowaniach z nowych miejsc. Nagły wzrost kosztów przy kluczu do chmury jest typowym objawem.</p><h2>3. Wygeneruj nowy i wdroż</h2><p>Przy okazji warto zawęzić uprawnienia — wyciek jest dobrym momentem, żeby sprawdzić, czy klucz naprawdę potrzebował pełnego dostępu.</p><h2>4. Dopiero teraz historia repozytorium</h2><pre><code>git filter-repo --path .env --invert-paths
# albo: bfg --delete-files .env</code></pre><p>Potem wymuszone wypchnięcie i informacja dla zespołu, że trzeba pobrać repozytorium na nowo.</p><h2>5. Dlaczego w tej kolejności</h2><p>Czyszczenie historii bez unieważnienia klucza to praca pozorna. Kopie repozytorium są u wszystkich, którzy je pobrali, w pamięci podręcznej serwisu i często w archiwach osób trzecich. Klucz raz opublikowany jest publiczny na zawsze.</p><h2>6. Hasło do konta</h2><p>Zmiana hasła, unieważnienie wszystkich aktywnych sesji, sprawdzenie ustawień, których atakujący mógł dotknąć: adresu e-mail, kluczy SSH, powiadomień, reguł przekazywania poczty.</p><h2>7. Zapobieganie</h2><pre><code>gitleaks protect --staged
git secrets --install</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie da się ustalić z pewnością, czy klucz został wykorzystany. Brak śladów w dziennikach nie jest dowodem — dlatego przy dostępie do danych osobowych obowiązują osobne procedury zgłoszeniowe, niezależnie od tego, co widać w logach.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak zabezpieczyć panel administracyjny aplikacji',
    excerpt: 'Warstwy ochrony dla części, która daje pełną władzę nad systemem.',
    body: `<p>Panel administracyjny to najcenniejszy cel w aplikacji. Zabezpieczenia warto tu układać warstwami.</p><h2>1. Nie wystawiaj go, jeśli nie musisz</h2><p>Nasłuch na pętli zwrotnej i dostęp przez VPN albo tunel SSH usuwa całą klasę problemów. Panel niedostępny z internetu nie da się zaatakować z internetu.</p><h2>2. Ograniczenie po adresie</h2><pre><code>location /admin {
    allow 203.0.113.5;
    deny all;
    proxy_pass http://127.0.0.1:3000;
}</code></pre><p>Pamiętając o IPv6 — reguła obejmująca tylko IPv4 zostawia otwartą furtkę.</p><h2>3. Osobne uwierzytelnianie</h2><p>Drugi składnik wymagany dla kont administracyjnych, nawet jeśli dla zwykłych jest opcjonalny.</p><h2>4. Ograniczenie prób</h2><p>Kilka prób na minutę na konto i na adres. Logowanie do panelu to miejsce, gdzie limit jest ważniejszy niż wygoda.</p><h2>5. Krótkie sesje</h2><p>Sesja administracyjna wygasająca po kilkudziesięciu minutach bezczynności, z ponownym pytaniem o hasło przy operacjach nieodwracalnych.</p><h2>6. Dziennik działań</h2><p>Kto, co i kiedy zmienił. Bez tego po incydencie nie da się ustalić zakresu szkód ani ich cofnąć.</p><h2>7. Nagłówki</h2><pre><code>add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy same-origin;</code></pre><h2>8. Zawężone konta</h2><p>Nie każdy administrator potrzebuje prawa kasowania danych. Rozdzielenie ról ogranicza skutki przejęcia jednego konta i pomyłek.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zmiana adresu panelu na trudny do odgadnięcia nie jest zabezpieczeniem — adres wycieka przez historię przeglądarki, nagłówek odesłania i dzienniki pośredników. Utrudnia skanowanie, nie chroni przed atakiem.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak przeprowadzić przegląd uprawnień w systemie',
    excerpt: 'Kto ma dostęp do czego — od kont systemowych po klucze API.',
    body: `<p>Uprawnienia narastają: nadane „na chwilę" zostają na lata, konta po odejściu osób pozostają aktywne. Przegląd raz na jakiś czas jest tańszy niż incydent.</p><h2>1. Konta w systemie</h2><pre><code>awk -F: '$3 &gt;= 1000 {print $1, $3, $7}' /etc/passwd
awk -F: '$3 == 0 {print $1}' /etc/passwd
getent group sudo</code></pre><p>Sprawdzamy, czy każde konto ma właściciela i czy nadal jest potrzebne.</p><h2>2. Klucze SSH</h2><pre><code>for h in /home/*/.ssh/authorized_keys /root/.ssh/authorized_keys; do
  echo "== $h"; cat "$h" 2&gt;/dev/null
done</code></pre><p>Komentarz na końcu klucza zwykle mówi, czyj jest — o ile ktoś go zostawił. Klucze bez rozpoznania usuwamy.</p><h2>3. Reguły sudo</h2><pre><code>cat /etc/sudoers /etc/sudoers.d/*
sudo -l -U uzytkownik</code></pre><p>Wpisy pozwalające na wykonanie dowolnego polecenia bez hasła warto uzasadnić albo usunąć.</p><h2>4. Pliki z bitem setuid</h2><pre><code>find / -perm -4000 -type f 2&gt;/dev/null</code></pre><p>Warto porównać listę ze stanem po instalacji — nowe pozycje wymagają wyjaśnienia.</p><h2>5. Uprawnienia w bazie</h2><pre><code>\\du
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants;</code></pre><p>Aplikacja rzadko potrzebuje prawa zmiany schematu w czasie normalnej pracy.</p><h2>6. Klucze API i integracje</h2><p>Lista aktywnych kluczy z datą utworzenia i ostatniego użycia. Klucze nieużywane od miesięcy to gotowi kandydaci do usunięcia.</p><h2>7. Zapisz wynik</h2><p>Krótka notatka: co znaleziono, co usunięto, co zostawiono i dlaczego. Przy następnym przeglądzie oszczędza to powtarzania tych samych ustaleń.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przegląd pokazuje stan na dziś. Bez procedury odbierania dostępu przy odejściu osoby albo zakończeniu projektu za pół roku sytuacja wróci do punktu wyjścia.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak rozpoznać próbę wyłudzenia danych',
    excerpt: 'Sygnały w wiadomościach i sposób weryfikacji, który działa niezależnie od tego, jak dobrze wygląda podróbka.',
    body: `<p>Wyłudzenia przestały być łatwe do rozpoznania po błędach językowych. Skuteczna obrona nie polega na ocenianiu wyglądu wiadomości.</p><h2>1. Sygnały w treści</h2><ul><li>Presja czasu: konto zostanie zablokowane, przesyłka zwrócona, płatność odrzucona.</li><li>Prośba o działanie poza normalnym trybem.</li><li>Nietypowy kanał — SMS od banku, który normalnie pisze w aplikacji.</li><li>Załącznik, którego się nie spodziewano.</li><li>Prośba o kod jednorazowy. Żadna prawdziwa instytucja o niego nie prosi.</li></ul><h2>2. Adres nadawcy</h2><p>Widoczna nazwa nadawcy jest dowolna. Liczy się adres, a i on bywa podrobiony, jeśli domena nie ma poprawnej konfiguracji uwierzytelniania poczty. W nagłówkach szukamy wyników sprawdzeń SPF, DKIM i DMARC.</p><h2>3. Odnośniki</h2><p>Sprawdzamy adres przed kliknięciem, patrząc na domenę <strong>od prawej strony</strong> — do ostatniej kropki przed pierwszym ukośnikiem. Adres <code>bank.example.evil.com</code> nie należy do banku.</p><h2>4. Jedyna metoda, która zawsze działa</h2><p>Nie korzystamy z odnośnika ani numeru z wiadomości. Otwieramy stronę wpisując adres samodzielnie albo dzwonimy pod numer z własnych zapisków. Ta zasada działa niezależnie od tego, jak przekonująca jest podróbka.</p><h2>5. Klucze sprzętowe</h2><p>To jedyne zabezpieczenie odporne z definicji: klucz nie wytworzy podpisu dla obcej domeny, nawet gdy człowiek da się nabrać.</p><h2>6. Gdy już się kliknęło</h2><ol><li>Zmiana hasła, jeśli zostało wpisane.</li><li>Unieważnienie sesji na wszystkich urządzeniach.</li><li>Sprawdzenie reguł przekazywania poczty — atakujący często je dodaje.</li><li>Kontakt z bankiem, jeśli w grę wchodziły płatności.</li></ol><h2>Czego ten materiał nie rozwiązuje</h2><p>Ataki kierowane, przygotowane pod konkretną osobę na podstawie jej publicznych danych, bywają nie do odróżnienia od prawdziwej korespondencji. Dlatego liczy się procedura weryfikacji, a nie czujność w danym momencie.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak skonfigurować szyfrowanie dysku z odblokowaniem przez TPM',
    excerpt: 'LUKS odblokowywany przy rozruchu bez hasła — z zachowaniem drogi awaryjnej.',
    body: `<p>Cel: dysk szyfrowany, komputer uruchamiający się bez pytania o hasło, dysk bezużyteczny po wyjęciu z maszyny.</p><h2>1. Warunki</h2><p>Moduł TPM w wersji 2.0 i włączony bezpieczny rozruch. Bez tego drugiego pomiary rozruchu nie mają wartości — dowolny nośnik mógłby doprowadzić do wydania klucza.</p><pre><code>ls /dev/tpm*
systemd-analyze has-tpm2</code></pre><h2>2. Stan szyfrowania</h2><pre><code>lsblk -f
cryptsetup luksDump /dev/sda2</code></pre><h2>3. Zapisanie hasła awaryjnego</h2><p>Krok wykonywany <strong>przed</strong> czymkolwiek innym. Aktualizacja oprogramowania układowego zmieni pomiary i klucz przestanie być wydawany — bez hasła oznacza to utratę danych.</p><h2>4. Powiązanie z TPM</h2><pre><code>systemd-cryptenroll --tpm2-device=auto --tpm2-pmcrs=7 /dev/sda2</code></pre><p>Wybór rejestrów decyduje o czułości: więcej rejestrów to lepsza ochrona i częstsze konieczne ponowne powiązanie po aktualizacjach.</p><h2>5. Konfiguracja odblokowania</h2><p>W <code>/etc/crypttab</code>:</p><pre><code>root UUID=... none tpm2-device=auto,luks</code></pre><pre><code>update-initramfs -u -k all</code></pre><h2>6. Sprawdzenie gniazd na klucze</h2><pre><code>cryptsetup luksDump /dev/sda2 | grep -A2 Keyslots</code></pre><p>Hasło awaryjne musi zostać w osobnym gnieździe. Usunięcie wszystkich poza TPM oznacza brak drogi powrotu.</p><h2>7. Test</h2><p>Restart i sprawdzenie, że system wstaje bez pytania. Potem próba uruchomienia z innego nośnika — klucz nie powinien zostać wydany.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Ochrona dotyczy maszyny wyłączonej albo dysku wyjętego. Uruchomiony system ma klucz w pamięci i szyfrowanie nie chroni przed atakiem zdalnym ani przed kimś, kto siądzie przy odblokowanym komputerze. Dla dodatkowej ochrony można wymagać kodu PIN przy odblokowaniu.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak sprawdzić zależności projektu pod kątem podatności',
    excerpt: 'Skanowanie, ocena rzeczywistego ryzyka i naprawa bez psucia wszystkiego naraz.',
    body: `<p>Skanery zgłaszają setki podatności, z których większość nie dotyczy nas w praktyce. Sztuką jest odróżnienie istotnych.</p><h2>1. Skanowanie</h2><pre><code>npm audit --omit=dev
pip-audit
cargo audit
trivy fs .</code></pre><p>Rozdzielenie zależności produkcyjnych od deweloperskich to pierwszy filtr — podatność w narzędziu budowania jest innym problemem niż w kodzie serwera.</p><h2>2. Ocena, a nie sama ocena liczbowa</h2><p>Dla każdego zgłoszenia pytamy:</p><ul><li>Czy podatny kod jest w ogóle wykonywany w naszym zastosowaniu?</li><li>Czy dane atakującego mogą do niego dotrzeć?</li><li>Co realnie uzyska?</li></ul><p>Krytyczna podatność w funkcji, której nigdy nie wywołujemy, jest mniej pilna niż średnia w kodzie obsługującym żądania z internetu.</p><h2>3. Naprawa</h2><pre><code>npm audit fix
npm install pakiet@wersja</code></pre><p>Automatyczna naprawa radzi sobie z drobnymi podniesieniami wersji. Przy zmianie wersji głównej trzeba przeczytać opis zmian i sprawdzić testy.</p><h2>4. Gdy poprawki nie ma</h2><ul><li>Sprawdź, czy da się usunąć zależność.</li><li>Ogranicz dostęp do podatnej funkcji na poziomie własnego kodu.</li><li>Odnotuj świadomą decyzję o zaakceptowaniu ryzyka — z datą i uzasadnieniem.</li></ul><h2>5. W procesie ciągłej integracji</h2><pre><code>- run: npm audit --audit-level=high --omit=dev</code></pre><p>Próg dobieramy tak, żeby proces nie stawał się czerwony codziennie — inaczej ludzie przestają na niego patrzeć.</p><h2>6. Wykaz składników</h2><pre><code>syft dir:. -o spdx-json &gt; sbom.json</code></pre><p>Pozwala po ujawnieniu nowej podatności odpowiedzieć na pytanie „czy nas to dotyczy" w minuty, a nie w dni.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Skanery znajdują tylko podatności już zgłoszone i opisane. Nie wykryją luki w twoim kodzie ani nieujawnionej luki w bibliotece — do tego służą inne narzędzia i przeglądy.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak bezpiecznie korzystać z publicznej sieci Wi-Fi',
    excerpt: 'Realne zagrożenia w otwartej sieci i środki, które faktycznie coś dają.',
    body: `<p>Zagrożenia w otwartej sieci są dziś inne niż dekadę temu — powszechny HTTPS usunął większość z nich. Warto wiedzieć, co zostało.</p><h2>1. Co jest widoczne mimo HTTPS</h2><ul><li>Adresy serwerów, z którymi się łączysz.</li><li>Nazwy domen w polu SNI powitania TLS.</li><li>Zapytania DNS, jeśli nie są szyfrowane.</li><li>Rozmiary i czasy przesyłanych danych.</li></ul><p>Treść pozostaje zaszyfrowana. „Ktoś przechwyci twoje hasło" to dziś scenariusz mało prawdopodobny, o ile nie klikniesz przez ostrzeżenie o certyfikacie.</p><h2>2. Realne zagrożenia</h2><ul><li>Fałszywy punkt dostępowy o nazwie łudząco podobnej do prawdziwego.</li><li>Strona przechwytująca podszywająca się pod stronę logowania do sieci.</li><li>Przekierowanie na podrobioną stronę przy wpisaniu adresu bez protokołu.</li><li>Twoje własne urządzenie widoczne dla innych w tej samej sieci.</li></ul><h2>3. Co pomaga</h2><ul><li><strong>VPN do zaufanego punktu</strong> — ukrywa adresy docelowe przed siecią lokalną. Przenosi zaufanie na dostawcę VPN, nie usuwa go.</li><li><strong>Szyfrowany DNS</strong> — ukrywa zapytania o nazwy.</li><li><strong>Wymuszanie HTTPS</strong> w przeglądarce.</li><li><strong>Zapora na urządzeniu</strong> i wyłączenie udostępniania plików.</li><li><strong>Klucze sprzętowe</strong> — chronią przed podstawioną stroną logowania.</li></ul><h2>4. Czego nie robić</h2><p>Nie klikać przez ostrzeżenie o certyfikacie. To jedyny moment, w którym otwarta sieć naprawdę może zaszkodzić — i jedyny, w którym decyzja należy do człowieka.</p><h2>5. Ustawienia urządzenia</h2><p>Wyłączone automatyczne łączenie z zapamiętanymi sieciami, losowy adres sprzętowy, sieć oznaczona jako publiczna.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>VPN nie czyni cię anonimowym — przenosi zaufanie z operatora sieci na operatora VPN. Przy logowaniu do własnych kont i tak jesteś rozpoznawalny, niezależnie od tunelu.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak wdrożyć politykę bezpieczeństwa treści bez psucia strony',
    excerpt: 'CSP krok po kroku: tryb raportowania, zbieranie naruszeń, dopiero potem egzekwowanie.',
    body: `<p>Polityka założona od razu w trybie egzekwowania niemal zawsze psuje działającą stronę. Kolejność ma tu znaczenie kluczowe.</p><h2>1. Tryb samego raportowania</h2><pre><code>Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report</code></pre><p>Przeglądarka niczego nie blokuje, tylko zgłasza, co <em>zostałoby</em> zablokowane.</p><h2>2. Zbieranie zgłoszeń</h2><p>Prosty punkt końcowy przyjmujący zgłoszenia i zapisujący je do dziennika. Zbieramy przez kilka dni, żeby objąć rzadziej odwiedzane podstrony.</p><h2>3. Analiza</h2><p>W zgłoszeniach zwykle znajdują się: skrypty analityczne, osadzone filmy, kroje pisma z zewnętrznych serwerów, style wstawione w atrybutach i rozszerzenia przeglądarki. Te ostatnie ignorujemy — nie da się ich objąć polityką.</p><h2>4. Polityka docelowa</h2><pre><code>Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{losowa}';
  style-src 'self';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'</code></pre><h2>5. Wartości jednorazowe zamiast unsafe-inline</h2><p>Polityka z <code>unsafe-inline</code> w dyrektywie skryptów nie chroni przed niczym. Zamiast tego generujemy losową wartość na każde żądanie i umieszczamy ją w atrybucie każdego skryptu wewnętrznego.</p><h2>6. Przełączenie</h2><p>Zmieniamy nazwę nagłówka na wersję egzekwującą, zostawiając zgłaszanie naruszeń. Obserwujemy przez kilka dni.</p><h2>7. Dyrektywy warte uwagi</h2><p><code>frame-ancestors</code> chroni przed osadzeniem strony w cudzej ramce, <code>form-action</code> przed przekierowaniem formularza na obcy adres, <code>base-uri</code> przed podmianą adresu bazowego.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>CSP ogranicza szkody po błędzie, a nie zastępuje poprawnego kodowania danych. Strona z podatnością na wstrzyknięcie skryptu i dobrą polityką jest bezpieczniejsza niż bez niej, ale wciąż ma podatność.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak zorganizować hasła w domu i w małym zespole',
    excerpt: 'Menedżer haseł, hasło główne i sytuacje awaryjne, o których zwykle nikt nie myśli.',
    body: `<p>Unikalne hasło do każdego serwisu jest wykonalne wyłącznie z menedżerem haseł. To jedyna zmiana, która realnie usuwa całą klasę zagrożeń.</p><h2>1. Wybór narzędzia</h2><p>Rozwiązanie chmurowe jest wygodniejsze i wystarczające dla większości. Własny magazyn plikowy synchronizowany po swojemu daje większą kontrolę i większą odpowiedzialność — łącznie z odpowiedzialnością za kopie zapasowe.</p><h2>2. Hasło główne</h2><p>Długa fraza z kilku niepowiązanych słów jest łatwiejsza do zapamiętania i trudniejsza do złamania niż krótkie hasło ze znakami specjalnymi. Tego jednego hasła nie zapisuje się w menedżerze — z oczywistych powodów.</p><h2>3. Drugi składnik do samego menedżera</h2><p>Klucz sprzętowy albo aplikacja z kodami. Menedżer haseł jest teraz najcenniejszym celem.</p><h2>4. Kody zapasowe</h2><p>Wydrukowane albo zapisane poza wszystkimi urządzeniami. Osobno od hasła głównego.</p><h2>5. Uporządkowanie istniejących haseł</h2><ol><li>Zacznij od kont najważniejszych: poczta, bank, menedżer haseł.</li><li>Poczta jest pierwsza — przez nią odzyskuje się wszystkie pozostałe.</li><li>Reszta stopniowo, przy okazji normalnego logowania.</li></ol><h2>6. W zespole</h2><p>Wspólny schowek na hasła współdzielone, osobne konta dla każdej osoby. Odejście pracownika kończy się wtedy odebraniem dostępu do schowka, a nie zmianą wszystkich haseł.</p><h2>7. Sytuacja awaryjna</h2><p>Co się stanie, gdy zapomnisz hasła głównego albo zabraknie cię na dłużej? Warto ustawić dostęp awaryjny dla zaufanej osoby albo trzymać zapieczętowaną kopię w bezpiecznym miejscu. To najczęściej pomijany element całego układu.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Menedżer haseł nie chroni przed podstawioną stroną logowania, jeśli wpiszesz hasło ręcznie — choć jego odmowa automatycznego wypełnienia na obcej domenie jest dobrą wskazówką, że coś jest nie tak.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak zabezpieczyć router domowy',
    excerpt: 'Ustawienia, które warto zmienić od razu, i funkcje, które lepiej wyłączyć.',
    body: `<p>Router jest jedynym urządzeniem stale wystawionym na internet w każdym domu. Warto poświęcić mu pół godziny.</p><h2>1. Hasło administratora</h2><p>Zmiana domyślnego to pierwszy krok — fabryczne kombinacje są publicznie dostępne dla każdego modelu.</p><h2>2. Dostęp do panelu</h2><p>Zarządzanie z internetu wyłączone. Panel dostępny wyłącznie z sieci lokalnej, najlepiej po HTTPS.</p><h2>3. Funkcje do wyłączenia</h2><ul><li><strong>UPnP</strong> — pozwala dowolnej aplikacji w sieci otworzyć port na świat bez pytania. Wygodne dla gier, ryzykowne dla wszystkiego innego.</li><li><strong>WPS</strong> — mechanizm z kodem PIN ma znane słabości.</li><li><strong>Zdalne zarządzanie</strong> po dowolnym protokole.</li><li><strong>Sieć gościnna</strong>, jeśli nieużywana.</li></ul><h2>4. Wi-Fi</h2><p>Szyfrowanie WPA3, a przy starszych urządzeniach WPA2 — nigdy WEP ani sieć otwarta. Hasło długie i unikalne; nazwa sieci bez informacji o modelu routera.</p><h2>5. Aktualizacje</h2><p>Sprawdzenie dostępnej wersji oprogramowania i włączenie automatycznych aktualizacji, jeśli producent je oferuje. Router bez wsparcia od kilku lat to najsłabszy punkt sieci — wymiana bywa tańsza niż konsekwencje.</p><h2>6. Osobna sieć dla urządzeń, którym się nie ufa</h2><p>Kamery, sprzęt inteligentnego domu i konsole na osobnej sieci gościnnej albo w osobnym VLAN. Ich oprogramowanie rzadko bywa aktualizowane.</p><h2>7. Sprawdzenie z zewnątrz</h2><p>Skan portów z sieci innej niż domowa pokazuje, co widać ze świata. Wynik z własnej sieci nie mówi nic.</p><h2>8. Przegląd urządzeń</h2><p>Lista podłączonych klientów w panelu. Urządzenie, którego nie rozpoznajesz, wymaga wyjaśnienia.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Router operatora bywa zarządzany zdalnie przez operatora i część ustawień jest niedostępna. Wtedy jedyną drogą do pełnej kontroli jest własne urządzenie za nim, ustawione w tryb mostu.</p>`,
  },
  {
    kat: 'bezpieczenstwo',
    title: 'Jak przygotować się na utratę dostępu do własnych kont',
    excerpt: 'Plan awaryjny na zgubiony telefon, wygasłą domenę i konto zablokowane bez wyjaśnienia.',
    body: `<p>Większość zabezpieczeń chroni przed obcymi. Ten materiał dotyczy scenariusza, w którym to ty tracisz dostęp — statystycznie bardziej prawdopodobnego.</p><h2>1. Kody zapasowe</h2><p>Do każdego konta z drugim składnikiem. Wydrukowane albo zapisane poza urządzeniami, których dotyczą. Bez nich zgubiony telefon oznacza procedurę odzyskiwania, o ile w ogóle istnieje.</p><h2>2. Drugi klucz sprzętowy</h2><p>Zarejestrowany na tych samych kontach, trzymany w innym miejscu. Jeden klucz to pojedynczy punkt awarii.</p><h2>3. Poczta jako korzeń zaufania</h2><p>Przez skrzynkę odzyskuje się wszystko inne, więc ona wymaga najmocniejszej ochrony i własnej ścieżki odzyskiwania. Adres na własnej domenie daje niezależność od jednego dostawcy — pod warunkiem, że domena nie wygaśnie.</p><h2>4. Domena</h2><p>Automatyczne odnawianie, aktualny adres kontaktowy u rejestratora, blokada przeniesienia. Wygaśnięcie domeny używanej do logowania oznacza utratę wszystkich kont z nią powiązanych.</p><h2>5. Kopia menedżera haseł</h2><p>Eksport szyfrowany, przechowywany osobno. Awaria dostawcy albo zablokowane konto nie mogą odcinać od wszystkich haseł naraz.</p><h2>6. Rozproszenie</h2><p>Nie wszystko u jednego dostawcy. Konto zablokowane automatycznie, bez możliwości kontaktu z człowiekiem, potrafi zabrać naraz pocztę, pliki i logowanie do dziesiątek serwisów.</p><h2>7. Test</h2><p>Raz na jakiś czas: zaloguj się kodem zapasowym, sprawdź, czy klucz zapasowy działa, otwórz kopię menedżera haseł. Plan awaryjny nietestowany zwykle nie działa.</p><h2>8. Osoba zaufana</h2><p>Ktoś, kto w razie potrzeby uzyska dostęp — przez mechanizm dostępu awaryjnego albo zapieczętowaną kopię w bezpiecznym miejscu.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Część dostawców nie ma realnej procedury odwoławczej. Przy koncie, którego utrata byłaby dotkliwa, jedynym zabezpieczeniem jest niezależność od tego dostawcy — własna domena i kopia danych u siebie.</p>`,
  },
];
