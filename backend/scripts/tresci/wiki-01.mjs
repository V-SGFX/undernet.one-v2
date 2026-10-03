/** Hasła wiki — System, część 1. */
export default [
  {
    kat: 'system',
    title: 'i-węzeł (inode)',
    excerpt: 'Struktura opisująca plik w systemach plików uniksowych — wszystko poza jego nazwą.',
    body: `<p><strong>I-węzeł</strong> (ang. <em>inode</em>) to rekord przechowujący metadane pliku: typ, prawa dostępu, właściciela, rozmiar, znaczniki czasu i wskaźniki na bloki z danymi. Nie zawiera jednej rzeczy — nazwy.</p><h2>Nazwa jest osobno</h2><p>Nazwa pliku żyje we wpisie katalogu, który wskazuje na numer i-węzła. Dlatego jeden plik może mieć wiele nazw (dowiązania twarde), a zmiana nazwy nie rusza danych.</p><h2>Wyczerpanie i-węzłów</h2><p>Ich liczba jest ustalana przy tworzeniu systemu plików. Można więc wyczerpać i-węzły przy wolnym miejscu — typowe przy milionach malutkich plików w katalogu z cache albo kolejką poczty. Objaw myli, bo <code>df -h</code> pokazuje wolne miejsce, a zapis zwraca „No space left on device".</p><pre><code>df -i</code></pre><h2>Kasowanie zajętego pliku</h2><p>Usunięcie nazwy zmniejsza licznik dowiązań. Miejsce wraca dopiero, gdy licznik spadnie do zera <em>i</em> żaden proces nie trzyma pliku otwartego. Stąd klasyczna sytuacja: skasowano log, a miejsca nie przybyło, bo demon nadal pisze do otwartego deskryptora.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man7/inode.7.html', title: 'man 7 inode' }],
  },
  {
    kat: 'system',
    title: 'cgroups',
    excerpt: 'Mechanizm jądra Linux ograniczający i rozliczający zasoby grup procesów — fundament kontenerów.',
    body: `<p><strong>cgroups</strong> (control groups) to mechanizm jądra Linux pozwalający zebrać procesy w grupę i nałożyć na nią limity zasobów oraz zliczać ich zużycie.</p><h2>Kontrolery</h2><ul><li><strong>cpu</strong> — udział w czasie procesora i twardy sufit.</li><li><strong>memory</strong> — limit pamięci; przekroczenie kończy się zabiciem procesu w grupie, nie w całym systemie.</li><li><strong>io</strong> — przepustowość i liczba operacji na urządzeniach blokowych.</li><li><strong>pids</strong> — maksymalna liczba procesów, zabezpieczenie przed bombą rozgałęziającą.</li></ul><h2>Wersja druga</h2><p>cgroup v2 porządkuje bałagan pierwszej wersji: zamiast osobnej hierarchii na kontroler jest jedno drzewo, a proces należy dokładnie do jednego węzła. Współczesne dystrybucje montują v2 pod <code>/sys/fs/cgroup</code>.</p><h2>Gdzie się to widzi</h2><p>Docker, Podman i systemd to nakładki na ten sam mechanizm. Limit pamięci kontenera to wpis w pliku cgroup, a nie żadna wirtualizacja — stąd kontener widzi w <code>free</code> pamięć całej maszyny, choć zostanie zabity po przekroczeniu swojego limitu.</p>`,
    sources: [{ url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html', title: 'Dokumentacja jądra — Control Group v2' }],
  },
  {
    kat: 'system',
    title: 'Przestrzenie nazw (namespaces)',
    excerpt: 'Izolacja widoku zasobów systemu dla grupy procesów — druga połowa fundamentu kontenerów.',
    body: `<p><strong>Przestrzenie nazw</strong> to mechanizm jądra Linux, który daje procesowi własny widok wybranego zasobu systemu. Podczas gdy cgroups odpowiadają na pytanie „ile wolno zużyć", przestrzenie nazw odpowiadają na „co w ogóle widać".</p><h2>Rodzaje</h2><ul><li><strong>mnt</strong> — własne drzewo zamontowanych systemów plików.</li><li><strong>pid</strong> — własna numeracja procesów; proces główny kontenera ma PID 1.</li><li><strong>net</strong> — własne interfejsy, trasy i reguły filtrowania.</li><li><strong>uts</strong> — własna nazwa hosta.</li><li><strong>ipc</strong> — własne kolejki i pamięć dzielona.</li><li><strong>user</strong> — własne mapowanie identyfikatorów użytkowników.</li><li><strong>cgroup</strong> — własny widok hierarchii cgroup.</li></ul><h2>Kontener to nie maszyna</h2><p>Kontener jest zwykłym procesem hosta, tylko z podmienionym widokiem. Na hoście widać go w <code>ps</code>, dzieli z systemem to samo jądro i tę samą listę modułów. Dlatego kontener nie chroni przed luką w jądrze tak, jak chroni maszyna wirtualna.</p><h2>Przestrzeń użytkowników</h2><p>Namespace typu <code>user</code> pozwala być rootem wewnątrz i zwykłym użytkownikiem na zewnątrz. To podstawa kontenerów bezrootowych i najskuteczniejszy sposób ograniczenia szkód po ucieczce z kontenera.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man7/namespaces.7.html', title: 'man 7 namespaces' }],
  },
  {
    kat: 'system',
    title: 'OOM killer',
    excerpt: 'Mechanizm jądra zabijający proces, gdy w systemie kończy się pamięć — i dlaczego rzadko trafia w winnego.',
    body: `<p><strong>OOM killer</strong> (Out Of Memory killer) to część jądra Linux, która przy wyczerpaniu pamięci wybiera i zabija proces, żeby uratować resztę systemu.</p><h2>Jak wybiera ofiarę</h2><p>Każdy proces dostaje punktację w <code>/proc/&lt;pid&gt;/oom_score</code>, liczoną głównie z zajętości pamięci. Ginie proces z najwyższym wynikiem — czyli zwykle ten największy, a nie ten, który spowodował problem. Baza danych bywa zabijana przez wyciek w skrypcie, który zajął resztę.</p><h2>Nadprzydział</h2><p>Linux domyślnie przydziela więcej pamięci, niż fizycznie ma, zakładając, że programy nie użyją wszystkiego, o co poprosiły. Dlatego <code>malloc()</code> rzadko zawodzi, a problem ujawnia się dopiero przy faktycznym zapisie do stron.</p><h2>Wpływ na wybór</h2><pre><code>echo -1000 &gt; /proc/&lt;pid&gt;/oom_score_adj</code></pre><p>Wartości od <code>-1000</code> (praktyczna nietykalność) do <code>1000</code> (pierwszy do odstrzału). W systemd to opcja <code>OOMScoreAdjust=</code> w jednostce.</p><h2>Rozpoznanie</h2><p>Zabicie zostawia ślad w dzienniku jądra. Jeśli usługa „sama się wyłączyła" bez wpisu w swoich logach, to pierwsze miejsce do sprawdzenia:</p><pre><code>journalctl -k | grep -i "out of memory"</code></pre>`,
    sources: [{ url: 'https://docs.kernel.org/admin-guide/sysctl/vm.html', title: 'Dokumentacja jądra — parametry vm' }],
  },
  {
    kat: 'system',
    title: 'swappiness',
    excerpt: 'Parametr jądra sterujący skłonnością do wypychania stron na przestrzeń wymiany — nie procent użycia swapa.',
    body: `<p><strong>swappiness</strong> to parametr jądra Linux o wartościach od 0 do 200, określający, jak chętnie system wypycha strony pamięci anonimowej na przestrzeń wymiany zamiast usuwać strony cache.</p><h2>Częste nieporozumienie</h2><p>To nie jest „procent pamięci, po którym zacznie się swapowanie". To waga w decyzji między dwoma sposobami odzyskania pamięci: wyrzuceniem cache plikowego a wypchnięciem danych procesu.</p><h2>Wartości</h2><ul><li><strong>60</strong> — domyślna w większości dystrybucji.</li><li><strong>10</strong> — rozsądne na maszynie z dużą ilością RAM, gdzie zależy nam na czasach odpowiedzi.</li><li><strong>1</strong> — swap prawie wyłącznie jako zawór bezpieczeństwa.</li><li><strong>0</strong> — nie wyłącza swapa; wyłącza tylko wypychanie z wyprzedzenia. Przy braku pamięci system nadal go użyje.</li></ul><h2>Ustawienie</h2><pre><code>sysctl vm.swappiness
echo 'vm.swappiness=10' &gt; /etc/sysctl.d/99-swappiness.conf</code></pre><h2>Kiedy zmiana nie pomoże</h2><p>Jeśli maszyna dławi się przy pełnej pamięci, problem jest w jej ilości albo w wycieku, a nie w tym parametrze. Zmniejszenie swappiness wtedy tylko przyspiesza dojście do OOM killera.</p>`,
    sources: [{ url: 'https://docs.kernel.org/admin-guide/sysctl/vm.html', title: 'Dokumentacja jądra — vm.swappiness' }],
  },
  {
    kat: 'system',
    title: 'tmpfs',
    excerpt: 'System plików trzymany w pamięci — szybki, ulotny i liczony do limitu pamięci, nie dysku.',
    body: `<p><strong>tmpfs</strong> to system plików istniejący wyłącznie w pamięci operacyjnej. Zapisane w nim dane znikają przy odmontowaniu i po restarcie maszyny.</p><h2>Gdzie się go spotyka</h2><p>Na typowym Linuksie tmpfs obsługuje <code>/dev/shm</code>, <code>/run</code>, a w wielu dystrybucjach także <code>/tmp</code>. Sprawdzenie:</p><pre><code>findmnt -t tmpfs</code></pre><h2>Rozmiar bywa mylący</h2><p>Podany przy montowaniu rozmiar to sufit, nie rezerwacja — pusty tmpfs o rozmiarze 8 GB nie zajmuje nic. Zajęte strony mogą trafić na swap, więc tmpfs nie gwarantuje, że dane nie opuszczą pamięci.</p><h2>Praktyczne zastosowania</h2><ul><li>Katalogi robocze kompilacji i przetwarzania obrazów — oszczędza cykle zapisu SSD.</li><li>Pliki tymczasowe z danymi wrażliwymi, których nie chcemy zostawiać na dysku.</li><li>Gniazda i pliki PID usług, czyszczone automatycznie przy restarcie.</li></ul><h2>Pułapka</h2><p>Zapis do tmpfs zajmuje pamięć systemu. Proces zapisujący tam duży plik może doprowadzić do OOM, choć <code>df</code> pokazuje wolne miejsce na dyskach.</p>`,
    sources: [{ url: 'https://docs.kernel.org/filesystems/tmpfs.html', title: 'Dokumentacja jądra — tmpfs' }],
  },
  {
    kat: 'system',
    title: 'Jednostka systemd',
    excerpt: 'Plik opisujący usługę, punkt montowania, gniazdo lub zegar zarządzany przez systemd.',
    body: `<p><strong>Jednostka</strong> (ang. <em>unit</em>) to plik konfiguracyjny opisujący coś, czym systemd zarządza. Nazwa kończy się przyrostkiem określającym rodzaj.</p><h2>Rodzaje</h2><ul><li><code>.service</code> — proces w tle.</li><li><code>.timer</code> — wyzwalacz czasowy, następca crona.</li><li><code>.socket</code> — gniazdo uruchamiające usługę przy pierwszym połączeniu.</li><li><code>.mount</code> i <code>.automount</code> — punkty montowania.</li><li><code>.target</code> — grupa jednostek, odpowiednik dawnych poziomów pracy.</li></ul><h2>Gdzie leżą</h2><p>Kolejność ma znaczenie: <code>/etc/systemd/system</code> przesłania <code>/usr/lib/systemd/system</code>. Plików pakietu nie edytuje się w miejscu — aktualizacja je nadpisze. Zamiast tego robi się nadpisanie:</p><pre><code>systemctl edit nazwa.service</code></pre><p>Powstaje wtedy plik <code>override.conf</code> w katalogu <code>.d</code>, w którym zmienia się tylko wybrane opcje.</p><h2>Po każdej zmianie</h2><pre><code>systemctl daemon-reload</code></pre><h2>Co naprawdę zostało wczytane</h2><p>Przy nadpisaniach z kilku miejsc trudno powiedzieć, jaka konfiguracja obowiązuje. Rozstrzyga:</p><pre><code>systemctl cat nazwa.service
systemctl show nazwa.service</code></pre>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man5/systemd.unit.5.html', title: 'man 5 systemd.unit' }],
  },
  {
    kat: 'system',
    title: 'initramfs',
    excerpt: 'Tymczasowy system plików ładowany do pamięci przed właściwym rootem — miejsce, gdzie kończy się większość awarii rozruchu.',
    body: `<p><strong>initramfs</strong> to skompresowane archiwum rozpakowywane do pamięci przez program rozruchowy razem z jądrem. Zawiera minimalny zestaw narzędzi i modułów potrzebnych do dotarcia do właściwego systemu plików głównego.</p><h2>Po co to jest</h2><p>Jądro musi zamontować root, ale żeby to zrobić, może potrzebować sterownika kontrolera, obsługi LVM, RAID albo hasła do szyfrowanego wolumenu. Wkompilowanie wszystkiego na stałe dałoby jądro ogromne i niepraktyczne — więc te elementy jadą w initramfs.</p><h2>Kiedy się psuje</h2><p>Typowe objawy to zatrzymanie rozruchu w powłoce awaryjnej z komunikatem o braku urządzenia głównego. Najczęstsze przyczyny: zmiana UUID wolumenu bez przebudowy obrazu, aktualizacja jądra przerwana w połowie, brak modułu kontrolera po migracji dysku do innej maszyny.</p><h2>Przebudowa</h2><pre><code>update-initramfs -u -k all      # Debian, Ubuntu
dracut --force --regenerate-all # Fedora, RHEL
mkinitcpio -P                   # Arch</code></pre><h2>Zaglądanie do środka</h2><pre><code>lsinitramfs /boot/initrd.img-$(uname -r)</code></pre><p>Warto, gdy trzeba potwierdzić, że moduł faktycznie znalazł się w obrazie, zamiast zgadywać po objawach.</p>`,
  },
  {
    kat: 'system',
    title: 'LVM',
    excerpt: 'Warstwa między dyskami a systemami plików, pozwalająca zmieniać rozmiary i układ wolumenów bez przenoszenia danych.',
    body: `<p><strong>LVM</strong> (Logical Volume Manager) to warstwa abstrakcji między urządzeniami blokowymi a systemami plików. Zamiast montować partycję, montuje się wolumen logiczny, którego rozmiar i położenie można zmieniać w locie.</p><h2>Trzy poziomy</h2><ul><li><strong>PV</strong> (physical volume) — dysk lub partycja oddana pod LVM.</li><li><strong>VG</strong> (volume group) — pula złożona z jednego lub wielu PV.</li><li><strong>LV</strong> (logical volume) — wykrojony z puli wolumen, na którym zakłada się system plików.</li></ul><h2>Co to daje</h2><p>Powiększenie wolumenu bez odmontowania, rozłożenie jednego systemu plików na kilku dyskach, przeniesienie danych na nowy dysk przy działającym systemie oraz migawki.</p><h2>Migawki</h2><p>Migawka LVM zapisuje wyłącznie bloki zmienione od jej wykonania. Jest tania w chwili utworzenia, ale rośnie z każdą zmianą — i po zapełnieniu przydzielonego miejsca staje się bezużyteczna. To narzędzie do spójnej kopii w trakcie backupu, a nie zamiennik kopii zapasowej: migawka leży na tych samych dyskach co oryginał.</p><h2>Podstawowy przegląd</h2><pre><code>pvs
vgs
lvs</code></pre>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man8/lvm.8.html', title: 'man 8 lvm' }],
  },
  {
    kat: 'system',
    title: 'Poziomy RAID',
    excerpt: 'Sposoby łączenia dysków w macierz — co dają w wydajności, a co w odporności na awarię.',
    body: `<p><strong>RAID</strong> to sposób połączenia kilku dysków tak, by system widział jedno urządzenie. Poziom określa, jak dane są rozłożone i ile dysków może paść bez utraty danych.</p><h2>Najczęstsze poziomy</h2><ul><li><strong>RAID 0</strong> — dane rozłożone na wszystkich dyskach. Największa przepustowość i pełna pojemność, ale awaria jednego dysku niszczy całość. To nie jest RAID w sensie odporności.</li><li><strong>RAID 1</strong> — lustro. Pojemność jednego dysku, przeżywa awarię wszystkich poza jednym.</li><li><strong>RAID 5</strong> — dane plus parzystość rozłożona na dyskach. Traci pojemność jednego dysku, przeżywa awarię jednego.</li><li><strong>RAID 6</strong> — dwie parzystości. Traci pojemność dwóch dysków, przeżywa awarię dwóch.</li><li><strong>RAID 10</strong> — lustra połączone w pasek. Traci połowę pojemności, dobrze znosi obciążenia losowe.</li></ul><h2>Odbudowa jest niebezpieczna</h2><p>Po wymianie dysku macierz czyta wszystkie pozostałe od początku do końca. To najcięższe obciążenie, jakie te dyski widzą — i moment, w którym najczęściej pada drugi. Przy dużych dyskach jest to główny argument za RAID 6 zamiast 5.</p><h2>Zdanie, które trzeba zapamiętać</h2><p>RAID nie jest kopią zapasową. Chroni przed awarią sprzętu, ale skasowany plik, szyfrujące oprogramowanie wymuszające okup i błąd administratora replikują się na wszystkie dyski natychmiast.</p>`,
  },
  {
    kat: 'system',
    title: 'journald',
    excerpt: 'Dziennik systemd — logi w formacie binarnym, z indeksowaniem i metadanymi zamiast płaskich plików tekstowych.',
    body: `<p><strong>journald</strong> to usługa systemd zbierająca komunikaty jądra, usług i aplikacji. Zapisuje je w formacie binarnym z metadanymi, dzięki czemu można filtrować po jednostce, priorytecie, PID czy identyfikatorze rozruchu.</p><h2>Podstawowe użycie</h2><pre><code>journalctl -u nginx --since "1 hour ago"
journalctl -p err -b        # błędy z bieżącego rozruchu
journalctl -k               # komunikaty jądra
journalctl -f               # śledzenie na żywo</code></pre><h2>Ulotność</h2><p>Domyślnie w wielu dystrybucjach dziennik trafia do <code>/run</code>, czyli do pamięci — i znika przy restarcie. To najczęstsze zaskoczenie po awarii: logi z chwili padu przepadły. Trwałość włącza katalog:</p><pre><code>mkdir -p /var/log/journal
systemd-tmpfiles --create --prefix /var/log/journal
systemctl restart systemd-journald</code></pre><h2>Rozmiar</h2><p>Limitami sterują <code>SystemMaxUse=</code> i <code>MaxRetentionSec=</code> w <code>/etc/systemd/journald.conf</code>. Bez nich dziennik zajmuje do 10% rozmiaru partycji.</p><h2>Uszkodzenie</h2><p>Format binarny znosi nagłe wyłączenie gorzej niż plik tekstowy. Sprawdzenie i sprzątnięcie:</p><pre><code>journalctl --verify
journalctl --vacuum-time=30d</code></pre>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man1/journalctl.1.html', title: 'man 1 journalctl' }],
  },
  {
    kat: 'system',
    title: 'udev',
    excerpt: 'Podsystem zarządzający urządzeniami w przestrzeni użytkownika — nazwy interfejsów, prawa dostępu i reakcje na podłączenie sprzętu.',
    body: `<p><strong>udev</strong> to część systemd odpowiedzialna za obsługę zdarzeń sprzętowych: tworzy węzły w <code>/dev</code>, nadaje im prawa i uruchamia akcje po podłączeniu lub odłączeniu urządzenia.</p><h2>Reguły</h2><p>Reguły leżą w <code>/etc/udev/rules.d</code> (własne) i <code>/usr/lib/udev/rules.d</code> (pakietowe). Wczytywane są w kolejności nazw, dlatego pliki zaczynają się od liczby.</p><h2>Typowe zastosowania</h2><ul><li>Stała nazwa interfejsu sieciowego niezależna od kolejności wykrywania.</li><li>Dostęp do programatora lub czytnika bez uprawnień roota, przez przypisanie grupy.</li><li>Stała ścieżka do dysku, gdy litery urządzeń potrafią się zamienić po restarcie.</li></ul><h2>Znajdowanie atrybutów</h2><p>Reguła musi trafić w konkretne cechy urządzenia. Wypisuje je:</p><pre><code>udevadm info -a -n /dev/ttyUSB0</code></pre><h2>Przeładowanie</h2><pre><code>udevadm control --reload
udevadm trigger</code></pre><h2>Uwaga o nazwach sieciówek</h2><p>Nazwy typu <code>enp3s0</code> pochodzą z położenia na magistrali. Przełożenie karty do innego gniazda zmienia nazwę i potrafi zerwać konfigurację sieci — własna reguła udev oparta o adres MAC rozwiązuje to na stałe.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man7/udev.7.html', title: 'man 7 udev' }],
  },
  {
    kat: 'system',
    title: 'Bit setuid',
    excerpt: 'Znacznik uprawnień uruchamiający program z prawami właściciela pliku, a nie osoby wywołującej.',
    body: `<p><strong>setuid</strong> to bit uprawnień, po którego ustawieniu program działa z prawami właściciela pliku wykonywalnego zamiast z prawami użytkownika, który go uruchomił.</p><h2>Po co istnieje</h2><p>Klasyczny przykład to <code>passwd</code>: zwykły użytkownik musi zmienić wpis w <code>/etc/shadow</code>, do którego nie ma dostępu. Program należy do roota i ma ustawiony setuid, więc na czas działania dysponuje jego prawami.</p><h2>Rozpoznanie</h2><p>W wyniku <code>ls -l</code> widać <code>s</code> w miejscu bitu wykonywania właściciela:</p><pre><code>-rwsr-xr-x 1 root root ... /usr/bin/passwd</code></pre><p>Wyszukanie wszystkich takich plików:</p><pre><code>find / -perm -4000 -type f 2&gt;/dev/null</code></pre><h2>Dlaczego to obszar ryzyka</h2><p>Każdy program z setuid roota jest granicą uprawnień. Błąd w obsłudze argumentów, zmiennych środowiskowych czy ścieżek zamienia się w podniesienie uprawnień do roota. Historia bezpieczeństwa Uniksa to w dużej części historia takich błędów.</p><h2>Czego nie robi</h2><p>Setuid nie działa na skryptach powłoki w większości współczesnych jąder — jest tam ignorowany, właśnie ze względu na niemożliwe do zabezpieczenia wyścigi. Na skrypcie ustawiony bit nie da żadnego efektu.</p><h2>Nowsze podejście</h2><p>Zamiast pełnych praw roota nadaje się dziś pojedyncze zdolności (capabilities), na przykład <code>cap_net_bind_service</code> do otwarcia portu poniżej 1024.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man7/credentials.7.html', title: 'man 7 credentials' }],
  },
  {
    kat: 'system',
    title: 'umask',
    excerpt: 'Maska odbierająca uprawnienia nowo tworzonym plikom i katalogom.',
    body: `<p><strong>umask</strong> to maska bitowa określająca, które uprawnienia mają zostać <em>odjęte</em> nowo tworzonym plikom i katalogom. Nie ustawia uprawnień — ogranicza te, o które prosi program.</p><h2>Rachunek</h2><p>Programy tworzą pliki zwykle z żądaniem <code>666</code>, a katalogi <code>777</code>. Od tego odejmowana jest maska:</p><ul><li><code>umask 022</code> → pliki <code>644</code>, katalogi <code>755</code> — domyślne na większości systemów.</li><li><code>umask 077</code> → pliki <code>600</code>, katalogi <code>700</code> — nic dla grupy i reszty świata.</li><li><code>umask 002</code> → pliki <code>664</code> — używane przy pracy zespołowej we wspólnej grupie.</li></ul><h2>Gdzie się ustawia</h2><p>Dla powłoki w plikach startowych, dla usługi przez <code>UMask=</code> w jednostce systemd. Maska jest dziedziczona przez procesy potomne, więc ustawiona w skrypcie obowiązuje wszystko, co ten skrypt uruchomi.</p><h2>Typowy błąd</h2><p>Generowanie kluczy prywatnych bez zawężenia maski. Stąd w poradnikach linia:</p><pre><code>umask 077</code></pre><p>przed wygenerowaniem klucza — inaczej plik powstanie z prawami do odczytu dla innych, a większość narzędzi odmówi wtedy jego użycia.</p>`,
  },
  {
    kat: 'system',
    title: 'Dowiązanie twarde a symboliczne',
    excerpt: 'Dwa sposoby wskazania na plik — jeden przez i-węzeł, drugi przez ścieżkę.',
    body: `<p><strong>Dowiązanie twarde</strong> to druga nazwa dla tego samego i-węzła. <strong>Dowiązanie symboliczne</strong> to osobny plik zawierający ścieżkę do celu.</p><h2>Różnice praktyczne</h2><ul><li>Skasowanie oryginału nie psuje dowiązania twardego — dane żyją, dopóki istnieje choć jedna nazwa. Dowiązanie symboliczne staje się wtedy wiszące.</li><li>Dowiązanie twarde nie może przekroczyć granicy systemu plików ani wskazywać na katalog. Symboliczne może jedno i drugie.</li><li>Po dowiązaniu twardym nie da się poznać, która nazwa była pierwsza — są równorzędne.</li></ul><h2>Tworzenie</h2><pre><code>ln plik nazwa-twarda
ln -s /sciezka/do/celu nazwa-symboliczna</code></pre><h2>Gdzie to widać na co dzień</h2><p>Kopie zapasowe przyrostowe w stylu <code>rsync --link-dest</code> zajmują ułamek miejsca właśnie dzięki dowiązaniom twardym: pliki niezmienione między kopiami to jeden i-węzeł z wieloma nazwami.</p><h2>Pułapka względnej ścieżki</h2><p>Dowiązanie symboliczne ze ścieżką względną rozwiązuje się względem katalogu, w którym leży dowiązanie — nie względem katalogu roboczego osoby, która je odczytuje. Przeniesienie takiego dowiązania gdzie indziej zwykle je psuje.</p>`,
  },
  {
    kat: 'system',
    title: 'Overlayfs',
    excerpt: 'System plików łączący dwie warstwy w jeden widok — mechanizm stojący za obrazami kontenerów i systemami live.',
    body: `<p><strong>Overlayfs</strong> to system plików nakładkowy: składa katalog dolny (tylko do odczytu) i górny (zapisywalny) w jeden widoczny katalog.</p><h2>Warstwy</h2><ul><li><strong>lower</strong> — warstwa bazowa, nietykana.</li><li><strong>upper</strong> — tu trafiają wszystkie zmiany.</li><li><strong>work</strong> — katalog roboczy wymagany przez implementację.</li><li><strong>merged</strong> — wynikowy widok, który się montuje.</li></ul><h2>Kopiowanie przy zapisie</h2><p>Odczyt pliku idzie z warstwy dolnej. Pierwsza próba zapisu kopiuje cały plik do warstwy górnej i dopiero tam go zmienia. Dlatego zmiana jednego bajtu w wielogigabajtowym pliku wewnątrz kontenera potrafi zająć chwilę i tyle miejsca, ile waży cały plik.</p><h2>Kasowanie</h2><p>Pliku z warstwy dolnej nie da się usunąć naprawdę. Zamiast tego w warstwie górnej powstaje znacznik zasłaniający. Stąd obraz kontenera nie chudnie po skasowaniu plików w kolejnej warstwie — trzeba je usunąć w tym samym kroku, w którym powstały.</p><h2>Gdzie się to spotyka</h2><p>Warstwy obrazów Dockera, systemy live uruchamiane z nośnika tylko do odczytu, systemy wbudowane z niezmiennym rootem i zapisywalną nakładką.</p>`,
    sources: [{ url: 'https://docs.kernel.org/filesystems/overlayfs.html', title: 'Dokumentacja jądra — overlayfs' }],
  },
  {
    kat: 'system',
    title: 'Kopiowanie przy zapisie (copy-on-write)',
    excerpt: 'Strategia odkładania kopiowania do chwili pierwszej zmiany — podstawa migawek, forka i nowoczesnych systemów plików.',
    body: `<p><strong>Kopiowanie przy zapisie</strong> to zasada, wedle której kopia danych powstaje dopiero w chwili pierwszej próby ich zmiany. Do tego czasu obie strony korzystają z jednego egzemplarza.</p><h2>Gdzie działa</h2><ul><li><strong>fork()</strong> — nowy proces nie dostaje kopii pamięci rodzica, tylko wspólne strony oznaczone jako tylko do odczytu. Kopiowana jest dopiero strona, w którą ktoś pisze.</li><li><strong>Migawki</strong> w ZFS, Btrfs i LVM — utworzenie jest natychmiastowe, bo nic się nie kopiuje.</li><li><strong>Warstwy kontenerów</strong> — patrz overlayfs.</li></ul><h2>Konsekwencja dla pojemności</h2><p>Migawka zajmuje na starcie tyle co nic, a rośnie proporcjonalnie do liczby zmian w oryginale. Zapomniana migawka na aktywnie zapisywanym wolumenie potrafi zapełnić pulę i zatrzymać system — jedna z częstszych awarii na ZFS i Btrfs.</p><h2>Konsekwencja dla wydajności</h2><p>Systemy plików CoW nie nadpisują bloków w miejscu, tylko zapisują nową wersję gdzie indziej. To chroni przed uszkodzeniem przy nagłym zaniku zasilania, ale rozprasza pliki zapisywane w kółko małymi porcjami — stąd zalecenia wyłączania CoW dla plików baz danych i obrazów maszyn wirtualnych.</p>`,
  },
  {
    kat: 'system',
    title: 'noatime',
    excerpt: 'Opcja montowania wyłączająca aktualizację czasu ostatniego dostępu — tania oszczędność zapisów.',
    body: `<p><strong>noatime</strong> to opcja montowania, która wyłącza zapisywanie znacznika czasu ostatniego odczytu pliku.</p><h2>Na czym polega problem</h2><p>W domyślnym zachowaniu odczyt pliku powoduje zapis — aktualizację pola <code>atime</code> w i-węźle. Odczyt tysiąca małych plików generuje tysiąc dodatkowych zapisów metadanych, mimo że nic się nie zmieniło.</p><h2>Warianty</h2><ul><li><strong>noatime</strong> — nie aktualizuj nigdy.</li><li><strong>nodiratime</strong> — nie aktualizuj tylko dla katalogów.</li><li><strong>relatime</strong> — aktualizuj tylko wtedy, gdy poprzedni <code>atime</code> jest starszy niż <code>mtime</code> albo starszy niż doba. To domyślne zachowanie współczesnych jąder Linuksa i rozsądny kompromis.</li></ul><h2>Ustawienie</h2><p>W <code>/etc/fstab</code>, w kolumnie opcji:</p><pre><code>UUID=... /  ext4  defaults,noatime  0 1</code></pre><h2>Kiedy nie wyłączać</h2><p>Nieliczne programy naprawdę czytają <code>atime</code> — klasyczny przykład to niektóre systemy poczty rozróżniające skrzynki nowe od przeczytanych oraz narzędzia szukające plików nietykanych od lat. Poza takimi przypadkami <code>relatime</code> lub <code>noatime</code> są bezpieczne.</p>`,
  },
  {
    kat: 'system',
    title: 'chroot',
    excerpt: 'Zmiana katalogu głównego dla procesu — narzędzie naprawcze, nie mechanizm bezpieczeństwa.',
    body: `<p><strong>chroot</strong> zmienia katalog widziany przez proces jako główny. Od tego momentu proces nie potrafi zaadresować niczego poza wskazanym poddrzewem.</p><h2>Do czego naprawdę służy</h2><p>Najczęstsze zastosowanie to naprawa niebootującego systemu z nośnika ratunkowego: montuje się partycje, wchodzi do środka i uruchamia narzędzia tak, jakby system działał normalnie — przebudowa initramfs, reinstalacja programu rozruchowego, zmiana hasła.</p><h2>Co trzeba podmontować</h2><p>Bez pseudosystemów plików większość narzędzi zawiedzie:</p><pre><code>mount --bind /dev  /mnt/dev
mount --bind /proc /mnt/proc
mount --bind /sys  /mnt/sys
chroot /mnt /bin/bash</code></pre><h2>To nie jest zabezpieczenie</h2><p>chroot nie był projektowany jako granica bezpieczeństwa i nią nie jest. Proces z prawami roota wewnątrz może się z niego wydostać — jest to udokumentowane i proste. Do izolacji służą przestrzenie nazw, kontenery albo maszyny wirtualne.</p><h2>Nowsze narzędzie</h2><p>Do wielu zastosowań wygodniejsze jest <code>systemd-nspawn</code>, które robi to samo, ale z osobnymi przestrzeniami nazw i automatycznym podmontowaniem tego, co potrzebne.</p>`,
    sources: [{ url: 'https://man7.org/linux/man-pages/man2/chroot.2.html', title: 'man 2 chroot' }],
  },
  {
    kat: 'system',
    title: 'zram',
    excerpt: 'Skompresowane urządzenie blokowe w pamięci, używane najczęściej jako szybki swap.',
    body: `<p><strong>zram</strong> to moduł jądra tworzący urządzenie blokowe, które trzyma dane w pamięci operacyjnej w postaci skompresowanej.</p><h2>Zastosowanie jako swap</h2><p>Zamiast wypychać strony na dysk, system kompresuje je i zostawia w RAM. Zapis i odczyt są o rzędy wielkości szybsze niż na nośniku, a typowe dane procesów kompresują się dwu-, trzykrotnie. Efektem jest więcej użytecznej pamięci bez dokładania kości.</p><h2>Gdzie ma największy sens</h2><ul><li>Maszyny z małą ilością pamięci — komputery jednopłytkowe, stare laptopy.</li><li>Systemy bez swapa na dysku, gdzie chodzi o łagodne przetrwanie chwilowych szczytów.</li><li>Nośniki, których nie chcemy zajeżdżać zapisami.</li></ul><h2>Czego nie daje</h2><p>zram zajmuje pamięć, którą ma oszczędzać — działa dopóki dane się kompresują. Przy danych już skompresowanych (wideo, archiwa) zysk jest bliski zeru. Nie zastąpi też brakującego RAM-u przy trwałym niedoborze; przesuwa tylko granicę, za którą zaczyna się dławienie.</p><h2>Stan</h2><pre><code>zramctl
swapon --show</code></pre>`,
    sources: [{ url: 'https://docs.kernel.org/admin-guide/blockdev/zram.html', title: 'Dokumentacja jądra — zram' }],
  },
];
