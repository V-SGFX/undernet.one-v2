/** Poradniki — System, część 1. */
export default [
  {
    kat: 'system',
    title: 'Jak znaleźć, co zajęło miejsce na dysku',
    excerpt: 'Od podziału na systemy plików po konkretny katalog — i przypadek, w którym miejsce zajmuje plik, którego nie ma.',
    body: `<p>Kolejność ma znaczenie: najpierw ustalamy, który system plików się zapełnił, dopiero potem szukamy w nim.</p><h2>1. Który system plików</h2><pre><code>df -h</code></pre><p>Szukamy pozycji przy stu procentach. Jeśli wszystkie mają zapas, a zapis nadal zawodzi, sprawdzamy i-węzły:</p><pre><code>df -i</code></pre><h2>2. Które katalogi</h2><pre><code>du -h --max-depth=1 /var | sort -h</code></pre><p>Powtarzamy w największym katalogu, schodząc w głąb. Ograniczenie do jednego systemu plików:</p><pre><code>du -hx --max-depth=1 /</code></pre><h2>3. Wygodniej, interaktywnie</h2><pre><code>ncdu -x /</code></pre><h2>4. Największe pojedyncze pliki</h2><pre><code>find / -xdev -type f -size +500M -exec ls -lh {} \; 2&gt;/dev/null</code></pre><h2>5. Gdy du pokazuje mniej niż df</h2><p>To najczęściej skasowany plik trzymany otwarty przez proces. Miejsce wróci dopiero po zamknięciu deskryptora:</p><pre><code>lsof +L1</code></pre><p>Kolumna z zerem w liczbie dowiązań wskazuje takie pliki. Wystarczy zrestartować usługę, która je trzyma — zwykle jest to demon piszący do skasowanego dziennika.</p><h2>6. Typowi winowajcy</h2><pre><code>journalctl --disk-usage
docker system df
apt clean   # albo: dnf clean all</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie mówi, czy dane wolno skasować. Przed usunięciem czegokolwiek z <code>/var/lib</code> warto ustalić, która usługa z tego korzysta — odzyskanie miejsca kosztem bazy danych jest gorszym problemem niż pełny dysk.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak ustawić usługę systemd dla własnego programu',
    excerpt: 'Od pliku jednostki po automatyczny restart i ograniczenie uprawnień.',
    body: `<p>Własny program uruchamiany „z ręki" nie wstanie po restarcie i nikt go nie wznowi po awarii. Jednostka systemd załatwia jedno i drugie.</p><h2>1. Konto dla usługi</h2><p>Usługa nie powinna działać jako root ani jako twoje konto:</p><pre><code>useradd --system --no-create-home --shell /usr/sbin/nologin mojaapp</code></pre><h2>2. Plik jednostki</h2><p>Zapisujemy w <code>/etc/systemd/system/mojaapp.service</code>:</p><pre><code>[Unit]
Description=Moja aplikacja
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mojaapp
WorkingDirectory=/opt/mojaapp
ExecStart=/usr/bin/node /opt/mojaapp/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target</code></pre><p><code>ExecStart</code> musi zawierać pełną ścieżkę — systemd nie korzysta z twojej zmiennej PATH.</p><h2>3. Zawężenie uprawnień</h2><p>Kilka linii, które znacząco ograniczają skutki przejęcia usługi:</p><pre><code>NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/mojaapp/dane</code></pre><h2>4. Uruchomienie</h2><pre><code>systemctl daemon-reload
systemctl enable --now mojaapp
systemctl status mojaapp</code></pre><h2>5. Podgląd dziennika</h2><pre><code>journalctl -u mojaapp -f</code></pre><h2>6. Zmienne wrażliwe</h2><p>Hasła nie wpisujemy do jednostki — jest czytelna dla wszystkich. Zamiast tego plik o ograniczonych prawach:</p><pre><code>EnvironmentFile=/etc/mojaapp/env</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p><code>Restart=on-failure</code> podnosi program po awarii, ale nie naprawia przyczyny. Usługa restartowana co pięć sekund w pętli to nie działająca usługa — warto ustawić limit prób przez <code>StartLimitBurst</code> i sprawdzać dziennik.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man5/systemd.service.5.html', title: 'man 5 systemd.service' }],
  },
  {
    kat: 'system',
    title: 'Jak zastąpić crona zegarem systemd',
    excerpt: 'Zadanie okresowe z dziennikiem, obsługą pominiętych uruchomień i losowym opóźnieniem.',
    body: `<p>Zegar systemd daje to, czego cron nie ma: dziennik z każdego uruchomienia, nadrabianie po wyłączeniu maszyny i rozrzut w czasie.</p><h2>1. Jednostka wykonująca pracę</h2><p>Plik <code>/etc/systemd/system/kopia.service</code>. Typ <code>oneshot</code>, bo zadanie kończy się i nie jest demonem:</p><pre><code>[Unit]
Description=Kopia zapasowa katalogu danych

[Service]
Type=oneshot
ExecStart=/usr/local/bin/kopia.sh</code></pre><p>Sekcja <code>[Install]</code> jest tu niepotrzebna — usługi nie włączamy, uruchamia ją zegar.</p><h2>2. Zegar</h2><p>Plik <code>/etc/systemd/system/kopia.timer</code> — nazwa musi się zgadzać z nazwą usługi:</p><pre><code>[Unit]
Description=Codzienna kopia zapasowa

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target</code></pre><p><code>Persistent=true</code> uruchomi zadanie po włączeniu maszyny, jeśli termin minął w czasie, gdy była wyłączona. <code>RandomizedDelaySec</code> rozrzuca uruchomienia — istotne, gdy wiele maszyn uderza w to samo miejsce.</p><h2>3. Włączenie</h2><pre><code>systemctl daemon-reload
systemctl enable --now kopia.timer</code></pre><h2>4. Sprawdzenie terminów</h2><pre><code>systemctl list-timers
systemd-analyze calendar "Mon *-*-* 03:00:00"</code></pre><p>Drugie polecenie pokazuje, kiedy naprawdę wypadnie podany zapis — warto sprawdzić przed wdrożeniem.</p><h2>5. Uruchomienie na żądanie</h2><pre><code>systemctl start kopia.service
journalctl -u kopia.service -n 50</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Zegar nie pilnuje, czy poprzednie uruchomienie się skończyło. Przy zadaniu trwającym dłużej niż odstęp warto dodać blokadę w samym skrypcie albo ustawić <code>OnUnitActiveSec</code> zamiast stałej godziny.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man5/systemd.timer.5.html', title: 'man 5 systemd.timer' }],
  },
  {
    kat: 'system',
    title: 'Jak dodać przestrzeń wymiany w pliku',
    excerpt: 'Swap bez zmiany partycji — przydatne na VPS, gdzie układ dysku jest ustalony.',
    body: `<p>Na maszynie bez partycji wymiany plik działa równie dobrze i można go założyć bez ruszania układu dysku.</p><h2>1. Sprawdzenie stanu</h2><pre><code>swapon --show
free -h</code></pre><h2>2. Utworzenie pliku</h2><pre><code>fallocate -l 2G /swapfile</code></pre><p>Gdy system plików nie obsługuje tego wywołania, alternatywa działająca zawsze:</p><pre><code>dd if=/dev/zero of=/swapfile bs=1M count=2048</code></pre><h2>3. Uprawnienia</h2><p>Krok obowiązkowy — jądro odmówi użycia pliku dostępnego dla innych:</p><pre><code>chmod 600 /swapfile</code></pre><h2>4. Sformatowanie i włączenie</h2><pre><code>mkswap /swapfile
swapon /swapfile
swapon --show</code></pre><h2>5. Trwałość po restarcie</h2><p>Dopisujemy do <code>/etc/fstab</code>:</p><pre><code>/swapfile none swap sw 0 0</code></pre><p>Sprawdzenie poprawności wpisu bez restartu:</p><pre><code>swapoff /swapfile &amp;&amp; mount -a &amp;&amp; swapon -a</code></pre><h2>6. Dostrojenie</h2><pre><code>echo 'vm.swappiness=10' &gt; /etc/sysctl.d/99-swappiness.conf
sysctl --system</code></pre><h2>Uwaga o systemach plików z kopiowaniem przy zapisie</h2><p>Na Btrfs plik wymiany wymaga osobnego przygotowania (brak kopiowania przy zapisie i brak kompresji), a na ZFS odradza się go całkowicie — grozi zakleszczeniem przy braku pamięci.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Swap nie zastąpi brakującej pamięci. Maszyna dławiąca się przy pełnym RAM będzie po dodaniu swapa dławić się wolniej i dłużej, zamiast szybko zakończyć problem przez OOM. Przy trwałym niedoborze właściwym rozwiązaniem jest więcej pamięci albo mniejsze zużycie.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak wejść do systemu, który się nie uruchamia',
    excerpt: 'Chroot z nośnika ratunkowego — reinstalacja programu rozruchowego, przebudowa initramfs, zmiana hasła.',
    body: `<p>Ścieżka dla maszyny, która przestała wstawać po aktualizacji jądra, zmianie w <code>fstab</code> albo uszkodzeniu programu rozruchowego.</p><h2>1. Uruchomienie z nośnika</h2><p>Dowolny obraz live tej samej architektury. Nie musi to być ta sama dystrybucja, choć ułatwia.</p><h2>2. Znalezienie partycji</h2><pre><code>lsblk -f</code></pre><p>Szukamy partycji głównej, rozruchowej i ewentualnej EFI.</p><h2>3. Montowanie</h2><pre><code>mount /dev/sda2 /mnt
mount /dev/sda1 /mnt/boot
mount /dev/sda1 /mnt/boot/efi   # gdy UEFI</code></pre><p>Przy szyfrowaniu najpierw odblokowanie:</p><pre><code>cryptsetup open /dev/sda2 root
mount /dev/mapper/root /mnt</code></pre><p>Przy LVM:</p><pre><code>vgchange -ay
mount /dev/vg0/root /mnt</code></pre><h2>4. Pseudosystemy plików</h2><p>Bez nich większość narzędzi zawiedzie:</p><pre><code>for k in dev proc sys run; do mount --bind /$k /mnt/$k; done
chroot /mnt /bin/bash</code></pre><h2>5. Typowe naprawy</h2><pre><code>update-initramfs -u -k all
grub-install /dev/sda
update-grub
passwd nazwa_uzytkownika</code></pre><h2>6. Wyjście</h2><pre><code>exit
umount -R /mnt</code></pre><p>Odmowa odmontowania oznacza, że coś nadal korzysta z katalogu — wskaże to <code>lsof /mnt</code>.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Chroot nie pomoże przy uszkodzonym systemie plików ani padającym dysku. Jeśli w dzienniku jądra widać błędy wejścia-wyjścia, pierwszym krokiem jest wykonanie obrazu dysku, a nie naprawa w miejscu.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak sprawdzić, co spowalnia rozruch systemu',
    excerpt: 'Pomiar czasu startu i znalezienie usługi, która blokuje resztę.',
    body: `<p>systemd mierzy czas każdej jednostki, więc nie trzeba niczego zgadywać.</p><h2>1. Podsumowanie</h2><pre><code>systemd-analyze</code></pre><p>Rozbija czas na oprogramowanie układowe, program rozruchowy, jądro i przestrzeń użytkownika.</p><h2>2. Najwolniejsze jednostki</h2><pre><code>systemd-analyze blame</code></pre><h2>3. Co naprawdę blokuje</h2><pre><code>systemd-analyze critical-chain</code></pre><p>To ważniejsze niż poprzednie: jednostka trwająca długo, ale uruchamiana równolegle, niczego nie opóźnia. Liczy się łańcuch zależności.</p><h2>4. Obraz graficzny</h2><pre><code>systemd-analyze plot &gt; rozruch.svg</code></pre><h2>5. Najczęstsi winowajcy</h2><ul><li>Oczekiwanie na sieć — usługa wymagająca <code>network-online.target</code>, gdy interfejs czeka na DHCP.</li><li>Wpis w <code>fstab</code> do zasobu sieciowego bez opcji <code>nofail</code> i <code>_netdev</code>; rozruch czeka do przekroczenia limitu czasu.</li><li>Usługa czekająca na źródło losowości przy starcie na maszynie wirtualnej.</li><li>Wyszukiwanie urządzeń wymiany, których już nie ma.</li></ul><h2>6. Wyłączenie zbędnej usługi</h2><pre><code>systemctl disable --now nazwa.service
systemctl list-unit-files --state=enabled</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Czas do znaku zachęty to nie to samo co gotowość usług. Serwer wstający w dziesięć sekund, ale z bazą danych odzyskującą dziennik przez minutę, jest gotowy po minucie. Optymalizowanie samego rozruchu bywa poprawianiem liczby, która nikogo nie obchodzi.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak bezpiecznie skonfigurować automatyczne aktualizacje bezpieczeństwa',
    excerpt: 'Nienadzorowane poprawki na Debianie i Ubuntu — z powiadomieniem i bez niespodziewanych restartów.',
    body: `<p>Serwer bez aktualizacji jest kwestią czasu. Aktualizacje w pełni automatyczne bywają jednak własnym źródłem awarii — złoty środek to same poprawki bezpieczeństwa.</p><h2>1. Instalacja</h2><pre><code>apt install unattended-upgrades apt-listchanges</code></pre><h2>2. Włączenie</h2><pre><code>dpkg-reconfigure -plow unattended-upgrades</code></pre><p>Tworzy to <code>/etc/apt/apt.conf.d/20auto-upgrades</code> z częstotliwością sprawdzania i instalacji.</p><h2>3. Zakres</h2><p>W <code>/etc/apt/apt.conf.d/50unattended-upgrades</code> zostawiamy odkomentowany wyłącznie wiersz z repozytorium bezpieczeństwa. Aktualizacje zwykłe wykonujemy świadomie, w wybranym momencie.</p><h2>4. Wyłączenia</h2><p>Pakiety, których aktualizacja ma być decyzją człowieka:</p><pre><code>Unattended-Upgrade::Package-Blacklist {
    "postgresql-.*";
    "docker-.*";
};</code></pre><h2>5. Powiadomienia i sprzątanie</h2><pre><code>Unattended-Upgrade::Mail "admin@example.com";
Unattended-Upgrade::MailReport "on-change";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";</code></pre><p>Ostatnia opcja jest istotna — nieusuwane stare jądra zapełniają małą partycję rozruchową i blokują kolejne aktualizacje.</p><h2>6. Restarty</h2><p>Automatyczny restart lepiej zostawić wyłączony, a zamiast tego sprawdzać potrzebę:</p><pre><code>cat /var/run/reboot-required</code></pre><h2>7. Próba na sucho</h2><pre><code>unattended-upgrade --dry-run --debug</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Aktualizacja pakietu nie restartuje usług, które wczytały starą bibliotekę. Po poprawce w bibliotece systemowej procesy nadal działają na podatnym kodzie do czasu ich restartu — wskaże je <code>needrestart</code>.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak zamontować zasób sieciowy tak, by nie blokował rozruchu',
    excerpt: 'Wpisy w fstab dla NFS i SMB z opcjami, które ratują przed zawieszonym startem.',
    body: `<p>Zasób sieciowy w <code>fstab</code> bez odpowiednich opcji potrafi zatrzymać rozruch na kilka minut albo na stałe, gdy serwer jest niedostępny.</p><h2>1. Opcje ratujące rozruch</h2><ul><li><code>nofail</code> — niedostępny zasób nie przerywa rozruchu.</li><li><code>_netdev</code> — montowanie dopiero po podniesieniu sieci.</li><li><code>x-systemd.automount</code> — montowanie przy pierwszym odwołaniu, nie przy starcie.</li><li><code>x-systemd.idle-timeout</code> — odmontowanie po okresie bezczynności.</li></ul><h2>2. NFS</h2><pre><code>serwer:/eksport /mnt/dane nfs4 defaults,_netdev,nofail,x-systemd.automount,x-systemd.idle-timeout=600 0 0</code></pre><h2>3. SMB</h2><p>Poświadczenia w osobnym pliku, nie w <code>fstab</code>:</p><pre><code>//serwer/udzial /mnt/udzial cifs credentials=/etc/samba/creds,uid=1000,gid=1000,_netdev,nofail,x-systemd.automount 0 0</code></pre><pre><code>printf 'username=uzytkownik\\npassword=haslo\\n' &gt; /etc/samba/creds
chmod 600 /etc/samba/creds</code></pre><h2>4. Sprawdzenie bez restartu</h2><pre><code>systemctl daemon-reload
mount -a
findmnt /mnt/dane</code></pre><p>Polecenie <code>daemon-reload</code> jest tu konieczne — systemd generuje jednostki montowania z <code>fstab</code> przy starcie i nie zauważy zmian bez odświeżenia.</p><h2>5. Twarde a miękkie montowanie NFS</h2><p>Domyślne twarde montowanie powoduje, że operacje na niedostępnym serwerze czekają w nieskończoność — proces staje się nieprzerywalny. Miękkie zwraca błąd, ale grozi uszkodzeniem danych przy zapisie. Do odczytu warto rozważyć miękkie z limitem czasu; do zapisu zostaje twarde.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Automatyczne montowanie nie naprawia zerwanego połączenia w trakcie pracy. Program z otwartym plikiem na zniknięciu serwera i tak dostanie błąd — odporność na to musi być po stronie aplikacji.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak przenieść działający system na nowy dysk',
    excerpt: 'Kopia całego systemu przy pomocy rsync, z odtworzeniem programu rozruchowego.',
    body: `<p>Metoda działająca niezależnie od rozmiarów dysków — w przeciwieństwie do kopiowania blok po bloku, które wymaga docelowego nośnika nie mniejszego od źródła.</p><h2>1. Przygotowanie nowego dysku</h2><p>Uruchamiamy z nośnika live, tworzymy tablicę partycji i systemy plików. Przy UEFI potrzebna jest partycja EFI typu FAT32.</p><pre><code>mkfs.ext4 /dev/sdb2
mkfs.vfat -F32 /dev/sdb1</code></pre><h2>2. Montowanie obu</h2><pre><code>mount /dev/sda2 /mnt/stary
mount /dev/sdb2 /mnt/nowy</code></pre><h2>3. Kopiowanie</h2><pre><code>rsync -aAXHv --numeric-ids \\
  --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*","/run/*","/mnt/*","/media/*","/lost+found"} \\
  /mnt/stary/ /mnt/nowy/</code></pre><p>Przełączniki mają znaczenie: <code>-A</code> zachowuje listy kontroli dostępu, <code>-X</code> atrybuty rozszerzone, <code>-H</code> dowiązania twarde, <code>--numeric-ids</code> chroni przed przemapowaniem właścicieli.</p><h2>4. Nowe identyfikatory w fstab</h2><pre><code>blkid /dev/sdb2</code></pre><p>Podmieniamy UUID w <code>/mnt/nowy/etc/fstab</code>. Pominięcie tego kroku to najczęstsza przyczyna nieudanego przeniesienia.</p><h2>5. Program rozruchowy</h2><pre><code>for k in dev proc sys run; do mount --bind /$k /mnt/nowy/$k; done
chroot /mnt/nowy
grub-install /dev/sdb
update-grub
update-initramfs -u -k all</code></pre><h2>6. Próba</h2><p>Odłączamy stary dysk fizycznie i uruchamiamy z nowego. Stary zostaje nietknięty jako kopia, dopóki nie potwierdzimy, że wszystko działa.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Przy szyfrowaniu, LVM albo ZFS dochodzą kroki związane z odtworzeniem tych warstw. Nie obejmuje też przenoszenia między różnymi trybami rozruchu — przejście z BIOS na UEFI wymaga osobnej procedury.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak ograniczyć rozmiar dziennika systemd',
    excerpt: 'Limity miejsca i czasu przechowywania oraz włączenie trwałego dziennika.',
    body: `<p>Dziennik bez limitów potrafi zająć do dziesiątej części partycji. Bez trwałości — znika przy restarcie, czyli dokładnie wtedy, gdy jest najbardziej potrzebny.</p><h2>1. Ile zajmuje teraz</h2><pre><code>journalctl --disk-usage</code></pre><h2>2. Trwałość</h2><pre><code>mkdir -p /var/log/journal
systemd-tmpfiles --create --prefix /var/log/journal
systemctl restart systemd-journald</code></pre><p>Sam katalog wystarczy — journald wykrywa jego obecność i zaczyna pisać na dysk.</p><h2>3. Limity</h2><p>W <code>/etc/systemd/journald.conf</code>:</p><pre><code>[Journal]
Storage=persistent
SystemMaxUse=500M
SystemKeepFree=1G
MaxRetentionSec=1month
MaxFileSec=1week</code></pre><h2>4. Zastosowanie</h2><pre><code>systemctl restart systemd-journald</code></pre><h2>5. Sprzątanie natychmiastowe</h2><pre><code>journalctl --vacuum-size=200M
journalctl --vacuum-time=14d</code></pre><h2>6. Ograniczenie gadatliwej usługi</h2><p>Zamiast obcinać cały dziennik, można ściszyć jedną jednostkę — w jej pliku:</p><pre><code>LogLevelMax=warning</code></pre><h2>7. Weryfikacja spójności</h2><pre><code>journalctl --verify</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Limit dotyczy dziennika systemd. Usługi piszące własne pliki w <code>/var/log</code> podlegają osobnemu mechanizmowi rotacji — jego konfiguracja to inny zestaw plików i częsty powód zdziwienia, że mimo limitów miejsce nadal ubywa.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak zaszyfrować dysk zewnętrzny w LUKS',
    excerpt: 'Utworzenie szyfrowanego kontenera, plik klucza i bezpieczne odmontowanie.',
    body: `<p>Zaszyfrowanie dysku przenośnego zajmuje kilka minut i chroni dane po jego zgubieniu.</p><h2>1. Rozpoznanie urządzenia</h2><pre><code>lsblk</code></pre><p>Krok, którego nie wolno pominąć — pomyłka w nazwie kasuje niewłaściwy dysk.</p><h2>2. Utworzenie kontenera</h2><pre><code>cryptsetup luksFormat /dev/sdX1</code></pre><p>Polecenie wymaga potwierdzenia napisanego wielkimi literami i hasła. Domyślne parametry współczesnych wersji są rozsądne i nie trzeba ich zmieniać.</p><h2>3. Otwarcie i system plików</h2><pre><code>cryptsetup open /dev/sdX1 dane
mkfs.ext4 /dev/mapper/dane
mount /dev/mapper/dane /mnt/dane</code></pre><h2>4. Odmontowanie</h2><pre><code>umount /mnt/dane
cryptsetup close dane</code></pre><p>Zamknięcie kontenera jest istotne: samo odmontowanie zostawia odszyfrowane urządzenie dostępne dla systemu.</p><h2>5. Dodatkowy klucz</h2><p>LUKS ma kilka gniazd na klucze. Warto dodać drugie hasło albo plik klucza — utrata jedynego hasła oznacza utratę danych:</p><pre><code>cryptsetup luksAddKey /dev/sdX1
cryptsetup luksDump /dev/sdX1</code></pre><h2>6. Kopia nagłówka</h2><p>Uszkodzenie nagłówka LUKS czyni dane nieodzyskiwalnymi, nawet ze znanym hasłem:</p><pre><code>cryptsetup luksHeaderBackup /dev/sdX1 --header-backup-file naglowek.img</code></pre><p>Plik kopii trzymamy osobno — daje on dostęp do danych każdemu, kto zna hasło z chwili jego wykonania.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Szyfrowanie chroni dysk odłączony. Podłączony i odblokowany jest dostępny dla całego systemu, w tym dla złośliwego oprogramowania. Nie chroni też przed uszkodzeniem nośnika — kopia zapasowa pozostaje osobną sprawą.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak znaleźć proces zajmujący port',
    excerpt: 'Od komunikatu o zajętym porcie do konkretnego procesu, także w kontenerze.',
    body: `<p>Komunikat o zajętym adresie przy starcie usługi ma zwykle jedną z trzech przyczyn: druga kopia tej samej usługi, inny program albo pozostałość po niezamkniętym połączeniu.</p><h2>1. Kto słucha</h2><pre><code>ss -tulpn | grep :8080</code></pre><p>Przełączniki: TCP, UDP, tylko nasłuchujące, z procesem, bez rozwiązywania nazw. Wymaga uprawnień roota, żeby zobaczyć właściciela procesu.</p><h2>2. Alternatywa</h2><pre><code>lsof -i :8080
fuser -v 8080/tcp</code></pre><h2>3. Gdy port zajmuje kontener</h2><p>Proces widoczny na hoście to <code>docker-proxy</code> albo nic. Wtedy:</p><pre><code>docker ps --format '{{.Names}}\\t{{.Ports}}'</code></pre><h2>4. Gdy nikt nie słucha, a port zajęty</h2><p>To zwykle połączenia w stanie oczekiwania po zamknięciu:</p><pre><code>ss -tan | grep :8080</code></pre><p>Rozwiązaniem jest opcja ponownego użycia adresu w kodzie usługi, a nie czekanie ani zabijanie czegokolwiek.</p><h2>5. Nasłuch na różnych adresach</h2><p>Usługa słuchająca na <code>127.0.0.1:8080</code> i druga na <code>0.0.0.0:8080</code> to konflikt, ale dwie na różnych adresach konkretnych — już nie. Kolumna adresu lokalnego w wyniku <code>ss</code> rozstrzyga.</p><h2>6. Zatrzymanie</h2><pre><code>systemctl stop nazwa
kill &lt;pid&gt;</code></pre><p>Po <code>kill -9</code> proces nie posprząta po sobie — to ostateczność, nie pierwszy krok.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie odpowiada, dlaczego druga kopia usługi w ogóle wystała. Częsta przyczyna to ręczne uruchomienie obok działającej jednostki systemd — warto sprawdzić <code>systemctl status</code>, zanim cokolwiek się zabije.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak ograniczyć zasoby procesu bez kontenera',
    excerpt: 'Limity pamięci, procesora i liczby procesów przy pomocy systemd i ulimit.',
    body: `<p>Nie trzeba kontenera, żeby ograniczyć program. Ten sam mechanizm, z którego korzystają kontenery, jest dostępny wprost.</p><h2>1. Jednorazowe uruchomienie z limitem</h2><pre><code>systemd-run --scope -p MemoryMax=512M -p CPUQuota=50% ./program</code></pre><p>Przydatne przy podejrzeniu wycieku pamięci — zamiast zabijać maszynę, program zostanie zatrzymany po przekroczeniu progu.</p><h2>2. Limity w jednostce usługi</h2><pre><code>[Service]
MemoryMax=1G
MemoryHigh=800M
CPUQuota=200%
TasksMax=100
IOWeight=50</code></pre><p><code>MemoryHigh</code> działa łagodniej: wymusza odzyskiwanie pamięci, zanim dojdzie do twardego limitu. <code>CPUQuota=200%</code> oznacza dwa pełne rdzenie.</p><h2>3. Sprawdzenie zużycia</h2><pre><code>systemctl status nazwa
systemd-cgtop</code></pre><h2>4. Limity klasyczne</h2><p>Dla programów uruchamianych z powłoki:</p><pre><code>ulimit -v 1048576   # pamięć wirtualna w kB
ulimit -n 4096      # otwarte pliki
ulimit -u 100       # procesy użytkownika</code></pre><p>Trwale w <code>/etc/security/limits.conf</code>, przy czym dla usług systemd te wpisy nie obowiązują — tam liczy się <code>LimitNOFILE=</code> w jednostce.</p><h2>5. Priorytet</h2><pre><code>nice -n 19 ./program
ionice -c 3 ./program</code></pre><p>Pierwsze zaniża priorytet procesora, drugie ustawia klasę bezczynną dla operacji dyskowych — razem sprawiają, że zadanie w tle nie przeszkadza reszcie.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Limit pamięci nie sprawia, że program zacznie jej używać mniej — po przekroczeniu zostanie zabity. To zabezpieczenie reszty systemu, a nie naprawa programu.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak czytać dmesg przy diagnozie sprzętu',
    excerpt: 'Komunikaty jądra, które faktycznie coś znaczą, i sposób ich filtrowania.',
    body: `<p>Dziennik jądra jest pierwszym miejscem, w którym widać problemy sprzętowe — zwykle na długo przed tym, jak zauważy je użytkownik.</p><h2>1. Czytelny format</h2><pre><code>dmesg -T --level=err,warn</code></pre><p>Przełącznik <code>-T</code> zamienia znaczniki czasu na czytelne daty; bez niego widać sekundy od startu.</p><h2>2. Z poprzedniego rozruchu</h2><pre><code>journalctl -k -b -1 -p err</code></pre><p>Kluczowe przy nagłych restartach: dziennik z bieżącego rozruchu nie powie nic o tym, co działo się przed padem.</p><h2>3. Komunikaty warte uwagi</h2><ul><li><code>I/O error</code>, <code>Buffer I/O error</code> — dysk lub kabel; sprawdzić S.M.A.R.T.</li><li><code>Out of memory: Killed process</code> — zadziałał OOM killer.</li><li><code>Machine Check Exception</code> — błąd sprzętowy zgłoszony przez procesor, często pamięć.</li><li><code>link is down</code> / <code>link becomes ready</code> w kółko — negocjacja karty sieciowej, kabel albo ASPM.</li><li><code>segfault at ... ip ...</code> — awaria programu, nie sprzętu.</li><li><code>reset SuperSpeed USB device</code> — zasilanie, kabel albo obudowa.</li></ul><h2>4. Śledzenie na żywo</h2><pre><code>dmesg -w</code></pre><p>Uruchomione przed podłączeniem urządzenia pokazuje dokładnie, co system o nim sądzi.</p><h2>5. Filtrowanie po podsystemie</h2><pre><code>dmesg -T | grep -i -E "ata|nvme|usb|eth|wlan"</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Brak komunikatów nie oznacza sprawnego sprzętu. Część awarii — zwłaszcza zasilania i pamięci — kończy się natychmiastowym wyłączeniem, przy którym nic nie zdąży się zapisać. Wtedy jedynym śladem jest cisza w dzienniku po godzinie, o której maszyna padła.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak skonfigurować rotację własnych plików dziennika',
    excerpt: 'logrotate dla aplikacji piszącej własne logi — z sygnałem przeładowania.',
    body: `<p>Aplikacja pisząca do własnego pliku będzie robić to w nieskończoność. Rotacja jest osobnym mechanizmem, którego nikt nie włącza za nas.</p><h2>1. Plik konfiguracyjny</h2><p>Zapisujemy w <code>/etc/logrotate.d/mojaapp</code>:</p><pre><code>/var/log/mojaapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 mojaapp adm
    sharedscripts
    postrotate
        systemctl reload mojaapp &gt;/dev/null 2&gt;&amp;1 || true
    endscript
}</code></pre><h2>2. Co znaczą opcje</h2><ul><li><code>rotate 14</code> — trzymaj czternaście poprzednich plików.</li><li><code>delaycompress</code> — nie kompresuj najświeższego; ratuje procesy, które nie zdążyły zamknąć pliku.</li><li><code>create</code> — nowy plik z określonymi prawami; bez tego aplikacja może stracić możliwość zapisu.</li><li><code>missingok</code> — brak pliku nie jest błędem.</li></ul><h2>3. Dlaczego postrotate</h2><p>Po zmianie nazwy pliku proces nadal pisze do starego deskryptora — nowy plik zostaje pusty, a miejsce nie wraca. Sygnał przeładowania każe aplikacji otworzyć plik na nowo. Aplikacje, które tego nie potrafią, wymagają opcji <code>copytruncate</code>, przy której grozi utrata kilku linii.</p><h2>4. Sprawdzenie bez czekania</h2><pre><code>logrotate -d /etc/logrotate.d/mojaapp
logrotate -f /etc/logrotate.d/mojaapp</code></pre><p>Pierwsze pokazuje, co by zrobił, drugie wymusza wykonanie.</p><h2>5. Kiedy to działa</h2><pre><code>systemctl list-timers logrotate.timer</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Rotacja dzienna nie uratuje przed aplikacją zapisującą gigabajty w godzinę. Wtedy potrzebna jest opcja rozmiarowa albo — lepiej — ograniczenie gadatliwości w samej aplikacji.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak sprawdzić, czy plik jest tym, za co się podaje',
    excerpt: 'Sumy kontrolne, podpisy i weryfikacja pobranego obrazu systemu.',
    body: `<p>Pobrany plik może być uszkodzony w transmisji albo podmieniony. To dwa różne problemy i wymagają dwóch różnych narzędzi.</p><h2>1. Suma kontrolna — wykrywa uszkodzenie</h2><pre><code>sha256sum obraz.iso
sha256sum -c SHA256SUMS</code></pre><p>Chroni przed przekłamaniem, ale nie przed podmianą: ktoś, kto podmienił plik, podmieni też plik z sumami.</p><h2>2. Podpis — potwierdza pochodzenie</h2><p>Dopiero podpis dystrybutora rozstrzyga, kto wystawił plik z sumami:</p><pre><code>gpg --verify SHA256SUMS.gpg SHA256SUMS</code></pre><h2>3. Klucz publiczny</h2><pre><code>gpg --recv-keys 0xIDENTYFIKATOR
gpg --fingerprint 0xIDENTYFIKATOR</code></pre><p>Odcisk klucza sprawdzamy w niezależnym źródle — najlepiej pod adresem HTTPS projektu. Pobranie klucza z tego samego miejsca co plik nie dowodzi niczego.</p><h2>4. Co znaczy komunikat o zaufaniu</h2><p>Ostrzeżenie, że klucz nie jest certyfikowany zaufanym podpisem, jest normalne i nie oznacza nieprawidłowego podpisu. Istotne jest, czy podpis jest poprawny i czy odcisk zgadza się z tym, który znamy.</p><h2>5. Weryfikacja pakietów</h2><p>Menedżery pakietów robią to automatycznie. Instalowanie z opcjami pomijającymi weryfikację wyłącza całą tę ochronę — również przy dodawaniu obcych repozytoriów, gdzie trzeba świadomie zaimportować klucz.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Poprawny podpis potwierdza autora, nie intencje. Podpisane oprogramowanie od podmiotu, któremu nie ma powodu ufać, pozostaje ryzykiem — weryfikacja odpowiada na pytanie „czy to od nich", a nie „czy to bezpieczne".</p>`,
  },
  {
    kat: 'system',
    title: 'Jak zdiagnozować wysokie obciążenie systemu',
    excerpt: 'Od wartości load average do konkretnej przyczyny — procesor, dysk czy oczekiwanie.',
    body: `<p>Wysokie obciążenie w Linuksie nie oznacza samego zajętego procesora — liczą się także procesy czekające na dysk.</p><h2>1. Pierwsze spojrzenie</h2><pre><code>uptime
top</code></pre><p>Trzy wartości to średnie z jednej, pięciu i piętnastu minut. Porównujemy je z liczbą rdzeni: obciążenie 4 na czterech rdzeniach to pełne wykorzystanie, na jednym — czterokrotne przeciążenie.</p><h2>2. Procesor czy dysk</h2><pre><code>vmstat 1 5</code></pre><p>Kolumna <code>wa</code> to czas czekania na wejście-wyjście. Wysoka wartość przy niskim <code>us</code> oznacza, że wąskim gardłem jest dysk, a nie obliczenia.</p><h2>3. Który proces</h2><pre><code>pidstat -d 1
iotop -o</code></pre><p>Stan <code>D</code> w <code>ps</code> oznacza proces w nieprzerywalnym oczekiwaniu — zwykle na dysk albo na zawieszony zasób sieciowy. Takich procesów nie da się zabić.</p><h2>4. Presja na zasoby</h2><pre><code>cat /proc/pressure/cpu
cat /proc/pressure/io
cat /proc/pressure/memory</code></pre><p>Te liczniki mówią wprost, ile czasu zadania traciły na czekanie — bywają czytelniejsze niż średnie obciążenie.</p><h2>5. Pamięć jako ukryta przyczyna</h2><pre><code>free -h
vmstat 1</code></pre><p>Duże wartości w kolumnach wymiany oznaczają dławienie: system spędza czas na przenoszeniu stron zamiast na pracy. Objawia się to jako obciążenie dyskiem, choć przyczyną jest brak pamięci.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie odpowiada, dlaczego proces robi to, co robi. Ustalenie, że baza danych zajmuje dysk, jest początkiem — dalej trzeba szukać w jej własnych narzędziach, na przykład wśród najwolniejszych zapytań.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak odzyskać miejsce zajęte przez Dockera',
    excerpt: 'Bezpieczne sprzątanie obrazów, wolumenów i pamięci podręcznej budowania.',
    body: `<p>Docker nie sprząta po sobie. Na maszynie budującej obrazy potrafi to być kilkadziesiąt gigabajtów.</p><h2>1. Co ile zajmuje</h2><pre><code>docker system df
docker system df -v</code></pre><p>Druga postać rozbija to na pojedyncze obrazy, kontenery i wolumeny.</p><h2>2. Bezpieczne sprzątanie</h2><pre><code>docker container prune
docker image prune
docker builder prune</code></pre><p>Usuwają zatrzymane kontenery, obrazy bez etykiet i pamięć podręczną budowania. Nie ruszają wolumenów.</p><h2>3. Sprzątanie szersze</h2><pre><code>docker image prune -a</code></pre><p>Usuwa wszystkie obrazy nieużywane przez żaden kontener — także te, które będą potrzebne za chwilę i trzeba będzie je pobrać ponownie.</p><h2>4. Wolumeny — ostrożnie</h2><pre><code>docker volume ls
docker volume prune</code></pre><p>To jedyne polecenie z tej listy, które kasuje dane. Wolumen odłączony od kontenera nadal może zawierać bazę danych zatrzymanej usługi. Przed uruchomieniem warto obejrzeć listę.</p><h2>5. Dzienniki kontenerów</h2><p>Częsta i pomijana przyczyna. Limit ustawia się w konfiguracji demona:</p><pre><code>{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}</code></pre><p>Zmiana obowiązuje kontenery utworzone po restarcie demona, nie istniejące.</p><h2>6. Automatycznie</h2><pre><code>docker system prune -af --filter "until=168h"</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Polecenie <code>docker system prune -a</code> bez zastanowienia usuwa też obrazy zbudowane lokalnie i nigdzie nieopublikowane — odtworzenie wymaga posiadania źródeł. Warto wiedzieć, co jest w rejestrze, zanim się je skasuje.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak ustawić stałą nazwę interfejsu sieciowego',
    excerpt: 'Reguła udev oparta o adres MAC — koniec z nazwą zmieniającą się po przełożeniu karty.',
    body: `<p>Nazwy typu <code>enp3s0</code> pochodzą z położenia karty na magistrali. Przełożenie jej do innego gniazda zmienia nazwę i zrywa konfigurację sieci.</p><h2>1. Ustalenie adresu MAC</h2><pre><code>ip -br link show</code></pre><h2>2. Reguła udev</h2><p>Zapisujemy w <code>/etc/udev/rules.d/70-nazwy-sieci.rules</code>:</p><pre><code>SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="aa:bb:cc:dd:ee:ff", NAME="lan0"</code></pre><p>Adres MAC musi być małymi literami. Nazwy nie zaczynamy od <code>eth</code> — ryzyko kolizji z nazwami nadawanymi przez jądro.</p><h2>3. Zastosowanie</h2><pre><code>udevadm control --reload
reboot</code></pre><p>Zmiana nazwy działającego interfejsu wymaga restartu — nie da się jej wykonać na podniesionym urządzeniu.</p><h2>4. Wariant dla systemd-networkd</h2><p>Plik <code>/etc/systemd/network/10-lan0.link</code>:</p><pre><code>[Match]
MACAddress=aa:bb:cc:dd:ee:ff

[Link]
Name=lan0</code></pre><h2>5. Alternatywa: wyłączenie nazw przewidywalnych</h2><p>Parametr jądra <code>net.ifnames=0</code> przywraca stare nazewnictwo. Rozwiązuje problem tylko na maszynie z jedną kartą — przy kilku kolejność bywa losowa przy każdym rozruchu, co jest gorsze niż nazwa, którą przynajmniej da się przewidzieć.</p><h2>6. Weryfikacja</h2><pre><code>ip -br link show
udevadm info /sys/class/net/lan0</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Wiązanie po adresie MAC przestaje działać po wymianie karty. Na maszynach wirtualnych z losowanym adresem przy każdym uruchomieniu trzeba adres ustalić na stałe po stronie hipernadzorcy.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak sprawdzić, które procesy używają najwięcej pamięci',
    excerpt: 'Odczyt zajętości pamięci bez mylenia się o współdzielone strony i pamięć podręczną.',
    body: `<p>Odczyt zużycia pamięci w Linuksie jest mniej oczywisty, niż się wydaje — te same strony bywają liczone wielokrotnie.</p><h2>1. Ogólny obraz</h2><pre><code>free -h</code></pre><p>Istotna jest kolumna dostępnej pamięci, nie wolnej. Pamięć zajęta przez cache zostanie oddana na żądanie — „zajęta" nie znaczy tu „niedostępna".</p><h2>2. Ranking procesów</h2><pre><code>ps aux --sort=-rss | head -20</code></pre><p>Kolumna RSS to strony rezydentne, ale wliczają się w nią biblioteki współdzielone. Suma RSS wszystkich procesów bywa większa niż cała pamięć maszyny i jest to normalne.</p><h2>3. Uczciwsza miara</h2><pre><code>smem -rs pss</code></pre><p>PSS dzieli strony współdzielone między procesy, które ich używają. Suma PSS ma sens i odpowiada rzeczywistemu zużyciu.</p><h2>4. Szczegóły jednego procesu</h2><pre><code>cat /proc/&lt;pid&gt;/status | grep -E "VmRSS|VmSwap"
pmap -x &lt;pid&gt; | tail -1</code></pre><h2>5. Zużycie przez usługi</h2><pre><code>systemd-cgtop -m</code></pre><p>Grupuje po jednostkach, więc pokazuje usługę razem z jej procesami potomnymi — zwykle to jest pytanie, które naprawdę chcemy zadać.</p><h2>6. Wyciek czy nie</h2><p>Jednorazowy pomiar niczego nie rozstrzyga. Trend rosnący bez opadania przy stałym obciążeniu wskazuje wyciek:</p><pre><code>while :; do date +%s; ps -o rss= -p &lt;pid&gt;; sleep 60; done</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Programy z własnym zarządzaniem pamięcią — maszyny wirtualne języków, bazy danych — pokazują na zewnątrz zajętość, która niekoniecznie jest używana. Do nich trzeba sięgnąć po ich własne narzędzia.</p>`,
  },
  {
    kat: 'system',
    title: 'Jak przygotować maszynę do pracy jako serwer domowy',
    excerpt: 'Podstawowa konfiguracja po instalacji: dostęp, aktualizacje, czas, dziennik i pierwsza kopia.',
    body: `<p>Lista rzeczy, które warto ustawić raz, zanim maszyna zacznie robić cokolwiek pożytecznego.</p><h2>1. Dostęp bez hasła</h2><pre><code>ssh-copy-id uzytkownik@serwer</code></pre><p>Po potwierdzeniu, że logowanie kluczem działa, w <code>/etc/ssh/sshd_config.d/</code>:</p><pre><code>PasswordAuthentication no
PermitRootLogin prohibit-password</code></pre><pre><code>systemctl reload ssh</code></pre><p>Drugą sesję zostawiamy otwartą do czasu potwierdzenia — to jedyne zabezpieczenie przed odcięciem się od maszyny.</p><h2>2. Zapora</h2><pre><code>ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw enable</code></pre><h2>3. Czas</h2><pre><code>timedatectl set-timezone Europe/Warsaw
timedatectl status</code></pre><p>Rozjechany zegar psuje certyfikaty, kody jednorazowe i korelację dzienników.</p><h2>4. Trwały dziennik z limitem</h2><pre><code>mkdir -p /var/log/journal
systemctl restart systemd-journald</code></pre><h2>5. Aktualizacje bezpieczeństwa</h2><pre><code>apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades</code></pre><h2>6. Nazwa i identyfikacja</h2><pre><code>hostnamectl set-hostname serwer-dom</code></pre><h2>7. Kopia zapasowa od pierwszego dnia</h2><p>Kopia założona „później" nie powstaje nigdy. Wystarczy zadanie kopiujące katalog z danymi w inne miejsce — byle poza tę maszynę.</p><h2>8. Monitoring miejsca</h2><p>Pełny dysk to najczęstsza awaria serwera domowego. Prosty zegar sprawdzający zajętość i wysyłający powiadomienie oszczędza wiele godzin.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>To konfiguracja maszyny dostępnej w sieci lokalnej. Wystawienie czegokolwiek do internetu wymaga osobnej rozmowy o odwrotnym proxy, certyfikatach i aktualizacjach usług — a przede wszystkim świadomej decyzji, co naprawdę musi być widoczne z zewnątrz.</p>`,
  },
];
