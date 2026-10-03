/** Poradniki — Kod. */
export default [
  {
    kat: 'kod',
    title: 'Jak cofnąć zmiany w Gicie w zależności od sytuacji',
    excerpt: 'Ściąga: co użyć, gdy zmiana jest w katalogu roboczym, w poczekalni, w commicie albo już wypchnięta.',
    body: `<p>Git ma kilka poleceń o podobnym brzmieniu i bardzo różnych skutkach. Wybór zależy od tego, dokąd zmiana zdążyła dojść.</p><h2>1. Zmiana w pliku, jeszcze nieprzygotowana</h2><pre><code>git restore plik.txt
git restore .</code></pre><p>Kasuje zmiany bezpowrotnie — nie ma ich nigdzie zapisanych.</p><h2>2. Plik dodany do poczekalni</h2><pre><code>git restore --staged plik.txt</code></pre><p>Zmiany zostają w pliku, znika tylko przygotowanie do commita.</p><h2>3. Poprawienie ostatniego commita</h2><pre><code>git commit --amend</code></pre><p>Tylko przed wypchnięciem — tworzy nowy commit w miejsce poprzedniego.</p><h2>4. Cofnięcie commita z zachowaniem zmian</h2><pre><code>git reset --soft HEAD~1   # zmiany zostają w poczekalni
git reset HEAD~1          # zmiany zostają w plikach
git reset --hard HEAD~1   # zmiany znikają</code></pre><p>Ostatni wariant to jedyne polecenie z tej listy, które niszczy pracę bez ostrzeżenia.</p><h2>5. Commit już wypchnięty</h2><pre><code>git revert &lt;hash&gt;</code></pre><p>Tworzy nowy commit odwracający tamten. Historia zostaje nietknięta, więc nikt nie musi ratować swojej kopii — to właściwe narzędzie dla wspólnej gałęzi.</p><h2>6. Odzyskanie tego, co wydawało się stracone</h2><pre><code>git reflog
git reset --hard &lt;hash z reflog&gt;</code></pre><p>Reflog pamięta, gdzie wskazywała gałąź przy każdej zmianie — ratuje po nieudanym rebase i po <code>reset --hard</code>. Wpisy żyją domyślnie kilkadziesiąt dni.</p><h2>7. Odłożenie pracy na bok</h2><pre><code>git stash push -m "opis"
git stash list
git stash pop</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Zmiany nigdy niedodane do repozytorium i nadpisane przez <code>restore</code> są nie do odzyskania. Przed każdą operacją, w której nazwie występuje słowo „hard", warto zapisać stan przez commit lub odłożenie.</p>`,
    sources: [{ url: 'https://git-scm.com/docs/git-reset', title: 'git-reset — dokumentacja' }],
  },
  {
    kat: 'kod',
    title: 'Jak napisać Dockerfile, który się szybko buduje',
    excerpt: 'Kolejność instrukcji, budowanie wieloetapowe i obraz bez narzędzi kompilacji.',
    body: `<p>Różnica między dobrym a złym plikiem Dockerfile to zwykle kilkanaście sekund kontra kilka minut przy każdej zmianie kodu.</p><h2>1. Kolejność decyduje o pamięci podręcznej</h2><pre><code>FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build</code></pre><p>Zależności instalują się ponownie tylko przy zmianie plików pakietowych. Przy odwrotnej kolejności każda zmiana jednej linii kodu powoduje pełną instalację.</p><h2>2. Budowanie wieloetapowe</h2><pre><code>FROM node:22-alpine AS budowanie
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=budowanie /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]</code></pre><p>Do obrazu końcowego trafia wynik, a nie narzędzia budowania i kod źródłowy.</p><h2>3. Plik .dockerignore</h2><pre><code>node_modules
.git
.env
dist
*.log</code></pre><p>Bez niego cały katalog jedzie do demona przy każdym budowaniu — z <code>node_modules</code> włącznie. To najczęstsza przyczyna wolnego startu budowania.</p><h2>4. Sprzątanie w tej samej warstwie</h2><pre><code>RUN apt-get update &amp;&amp; apt-get install -y --no-install-recommends curl \\
 &amp;&amp; rm -rf /var/lib/apt/lists/*</code></pre><h2>5. Nie jako root</h2><pre><code>USER node</code></pre><h2>6. Sekrety</h2><p>Hasło przekazane przez <code>ARG</code> zostaje w warstwach obrazu na zawsze. Do budowania służy osobny mechanizm montowania sekretów, do uruchomienia — zmienne środowiskowe.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Mniejszy obraz nie znaczy szybsza aplikacja. Obrazy oparte na bardzo okrojonych dystrybucjach potrafią sprawiać kłopoty z bibliotekami systemowymi — oszczędność stu megabajtów rzadko jest warta dnia diagnostyki.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak zdiagnozować wolne zapytanie SQL',
    excerpt: 'Od znalezienia winnego zapytania po odczytanie planu wykonania.',
    body: `<p>Zamiast zgadywać, które zapytanie spowalnia aplikację, warto zapytać o to bazę.</p><h2>1. Znalezienie kandydatów</h2><p>W PostgreSQL, po włączeniu rozszerzenia zbierającego statystyki:</p><pre><code>SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;</code></pre><p>Sortowanie po czasie łącznym, nie średnim: zapytanie trwające pięć milisekund, wykonywane milion razy, kosztuje więcej niż jedno trwające sekundę.</p><h2>2. Zapytania trwające teraz</h2><pre><code>SELECT pid, now() - query_start AS czas, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY czas DESC;</code></pre><h2>3. Plan wykonania</h2><pre><code>EXPLAIN (ANALYZE, BUFFERS) SELECT ...;</code></pre><p><code>ANALYZE</code> naprawdę wykonuje zapytanie i pokazuje czasy rzeczywiste. Przy poleceniach zmieniających dane trzeba to robić w transakcji zakończonej wycofaniem.</p><h2>4. Co czytać w planie</h2><ul><li><strong>Seq Scan</strong> na dużej tabeli z wąskim warunkiem — brakuje indeksu.</li><li>Duża różnica między liczbą wierszy szacowaną a rzeczywistą — statystyki nieaktualne, warto uruchomić <code>ANALYZE</code>.</li><li><strong>Nested Loop</strong> z dużą liczbą powtórzeń — zwykle skutek złego oszacowania.</li><li><strong>Sort</strong> z zapisem na dysk — za mało pamięci roboczej na sortowanie.</li></ul><h2>5. Dziennik wolnych zapytań</h2><pre><code>ALTER SYSTEM SET log_min_duration_statement = '500ms';
SELECT pg_reload_conf();</code></pre><h2>6. Sprawdzenie po zmianie</h2><p>Po dodaniu indeksu powtarzamy <code>EXPLAIN ANALYZE</code>. Indeks, którego planista nie używa, tylko spowalnia zapisy.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Najczęstszą przyczyną wolnej strony nie jest jedno ciężkie zapytanie, tylko setka lekkich — problem N+1. Widać go po liczbie zapytań na żądanie, a nie po czasie pojedynczego.</p>`,
    sources: [{ url: 'https://www.postgresql.org/docs/current/using-explain.html', title: 'PostgreSQL — EXPLAIN' }],
  },
  {
    kat: 'kod',
    title: 'Jak bezpiecznie przechowywać sekrety w projekcie',
    excerpt: 'Od pliku .env po sekrety w systemie budowania — i co zrobić, gdy klucz trafił do repozytorium.',
    body: `<p>Hasło w repozytorium jest hasłem publicznym od chwili pierwszego wypchnięcia — także po skasowaniu, bo zostaje w historii.</p><h2>1. Podstawy</h2><pre><code>echo ".env" &gt;&gt; .gitignore
git rm --cached .env</code></pre><p>Do repozytorium trafia wyłącznie <code>.env.example</code> z nazwami zmiennych i pustymi wartościami.</p><h2>2. Uprawnienia pliku</h2><pre><code>chmod 600 .env</code></pre><h2>3. Na serwerze</h2><p>Dla usług systemd plik wskazany przez <code>EnvironmentFile=</code>, nie zmienne wpisane wprost w jednostce — ta jest czytelna dla wszystkich użytkowników.</p><h2>4. W kontenerach</h2><p>Sekret przekazany jako <code>ARG</code> przy budowaniu zostaje w warstwach obrazu na zawsze. Do budowania służy montowanie sekretu, do uruchomienia — zmienne przekazywane w chwili startu.</p><h2>5. Gdy sekret już wyciekł</h2><p>Kolejność ma znaczenie:</p><ol><li><strong>Unieważnij klucz</strong> u dostawcy. To jedyny krok, który naprawdę coś zmienia.</li><li>Wygeneruj nowy i wdroż.</li><li>Dopiero potem, opcjonalnie, wyczyść historię repozytorium.</li></ol><p>Czyszczenie historii bez unieważnienia klucza jest pracą pozorną — kopie repozytorium istnieją u każdego, kto je pobrał.</p><h2>6. Zapobieganie</h2><pre><code>git secrets --install
gitleaks detect</code></pre><p>Skanery uruchamiane przed commitem wyłapują typowe wzorce kluczy.</p><h2>7. Gdzie trzymać zespołowo</h2><p>Menedżer haseł ze współdzielonym schowkiem albo dedykowana usługa przechowywania sekretów. Przesyłanie kluczy komunikatorem zostawia je w historii rozmowy na zawsze.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Sekret musi być gdzieś odszyfrowany, żeby aplikacja mogła go użyć. Celem jest ograniczenie liczby miejsc, w których występuje jawnie, a nie ich całkowite wyeliminowanie.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak napisać skrypt powłoki, który nie zaskoczy',
    excerpt: 'Tryb ścisły, obsługa błędów i cudzysłowy — czyli dlaczego skrypty psują dane.',
    body: `<p>Domyślne zachowanie powłoki to kontynuowanie mimo błędów. Przy skrypcie kopiującym albo kasującym dane bywa to kosztowne.</p><h2>1. Nagłówek</h2><pre><code>#!/usr/bin/env bash
set -euo pipefail
IFS=$'\\n\\t'</code></pre><ul><li><code>-e</code> — przerwij po błędzie.</li><li><code>-u</code> — niezdefiniowana zmienna to błąd. Ratuje przed <code>rm -rf "$KATALOG/"</code>, gdy zmienna jest pusta.</li><li><code>-o pipefail</code> — błąd w środku potoku nie zostaje pominięty.</li></ul><h2>2. Cudzysłowy wokół zmiennych</h2><pre><code>cp "$plik" "$cel"</code></pre><p>Bez nich nazwa ze spacją rozpada się na dwa argumenty. To najczęstszy błąd w skryptach i najczęstsza przyczyna zniszczonych danych.</p><h2>3. Sprzątanie po sobie</h2><pre><code>tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT</code></pre><p>Katalog zniknie także po przerwaniu skryptu.</p><h2>4. Sprawdzanie warunków wstępnych</h2><pre><code>command -v rsync &gt;/dev/null || { echo "Brak rsync" &gt;&amp;2; exit 1; }
[[ -d "$ZRODLO" ]] || { echo "Nie ma katalogu $ZRODLO" &gt;&amp;2; exit 1; }</code></pre><h2>5. Komunikaty na właściwe wyjście</h2><pre><code>echo "Błąd: ..." &gt;&amp;2</code></pre><p>Błędy na strumień diagnostyczny, wyniki na standardowe — inaczej nie da się użyć skryptu w potoku.</p><h2>6. Tryb próbny</h2><pre><code>DRY=\${DRY:-0}
[[ "$DRY" == 1 ]] &amp;&amp; echo "rm -rf $cel" || rm -rf "$cel"</code></pre><h2>7. Sprawdzenie skryptu</h2><pre><code>shellcheck skrypt.sh
bash -n skrypt.sh</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Tryb ścisły nie zastąpi obsługi błędów tam, gdzie niepowodzenie jest przewidywalnym stanem. Skrypt przerwany w połowie operacji na danych może zostawić je w stanie niespójnym — nad tym trzeba panować świadomie.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak zrobić kopię zapasową bazy PostgreSQL i ją odtworzyć',
    excerpt: 'Zrzut logiczny, kopia fizyczna i test odtworzenia, bez którego kopia nic nie znaczy.',
    body: `<p>Dwa rodzaje kopii odpowiadają na różne potrzeby i nie zastępują się nawzajem.</p><h2>1. Zrzut logiczny jednej bazy</h2><pre><code>pg_dump -Fc -d mojabaza -f kopia.dump</code></pre><p>Format niestandardowy pozwala odtwarzać wybiórczo i równolegle. Przy zrzucie tekstowym takiej możliwości nie ma.</p><h2>2. Wszystkie bazy z rolami</h2><pre><code>pg_dumpall -f pelna.sql</code></pre><p>Role i uprawnienia nie znajdują się w zrzucie pojedynczej bazy — przy odtwarzaniu na czystym serwerze ich brak jest częstym zaskoczeniem.</p><h2>3. Odtworzenie</h2><pre><code>createdb nowabaza
pg_restore -d nowabaza -j 4 kopia.dump</code></pre><p>Odtwarzanie do bazy istniejącej wymaga świadomej decyzji, czy czyścić jej zawartość.</p><h2>4. Kopia fizyczna</h2><pre><code>pg_basebackup -D /kopie/baza -Ft -z -P</code></pre><p>Kopiuje pliki klastra. Odtwarza wyłącznie na tej samej wersji głównej serwera, ale pozwala na odtworzenie do wybranego momentu w czasie razem z archiwum dziennika.</p><h2>5. Automatyzacja</h2><p>Zegar systemd uruchamiający skrypt, który wykonuje zrzut, kopiuje go poza maszynę i kasuje stare pliki. Kopia na tym samym dysku co baza nie jest kopią.</p><h2>6. Test odtworzenia</h2><pre><code>createdb proba
pg_restore -d proba kopia.dump
psql -d proba -c "SELECT count(*) FROM najwazniejsza_tabela;"
dropdb proba</code></pre><p>To jedyny krok, który zamienia założenie w wiedzę. Kopia nietestowana bywa uszkodzona, niepełna albo pusta — i wychodzi to w najgorszym momencie.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zrzut jest spójny w chwili rozpoczęcia. Baza zmieniana od tego czasu oznacza utratę danych z okna między kopiami — jeśli to nie do przyjęcia, potrzebne jest archiwizowanie dziennika i odtwarzanie do punktu w czasie.</p>`,
    sources: [{ url: 'https://www.postgresql.org/docs/current/backup.html', title: 'PostgreSQL — kopie zapasowe' }],
  },
  {
    kat: 'kod',
    title: 'Jak znaleźć wyciek pamięci w aplikacji Node.js',
    excerpt: 'Od potwierdzenia, że wyciek istnieje, po zrzut sterty i porównanie migawek.',
    body: `<p>Rosnące zużycie pamięci nie zawsze jest wyciekiem — mechanizm sprzątania pamięci działa leniwie. Najpierw to rozstrzygamy.</p><h2>1. Czy to naprawdę wyciek</h2><pre><code>while :; do date +%s; ps -o rss= -p &lt;pid&gt;; sleep 60; done</code></pre><p>Wykres rosnący bez opadania przy stałym obciążeniu, przez wiele godzin, wskazuje wyciek. Wzrost do pewnego poziomu i stabilizacja to normalna praca.</p><h2>2. Ograniczenie sterty</h2><pre><code>node --max-old-space-size=512 app.js</code></pre><p>Niższy limit sprawia, że problem ujawnia się szybciej i kończy czytelnym błędem zamiast zabiciem przez system.</p><h2>3. Zrzut sterty</h2><pre><code>node --inspect app.js
kill -USR2 &lt;pid&gt;   # w niektórych konfiguracjach</code></pre><p>Wygodniej z poziomu kodu, na sygnał:</p><pre><code>const v8 = require('node:v8');
process.on('SIGUSR2', () =&gt; v8.writeHeapSnapshot());</code></pre><h2>4. Porównanie migawek</h2><p>Robimy dwie: po rozgrzaniu aplikacji i po godzinie pracy. W narzędziach deweloperskich przeglądarki, w widoku porównania, sortujemy po przyroście. Interesuje nas nie największa liczba obiektów, tylko największy przyrost.</p><h2>5. Typowe przyczyny</h2><ul><li>Nasłuchiwacze zdarzeń dodawane bez usuwania — ostrzeżenie o przekroczeniu limitu jest tu wskazówką.</li><li>Rosnąca w nieskończoność tablica lub mapa w pamięci procesu.</li><li>Domknięcia trzymające referencje do dużych obiektów.</li><li>Zegary i interwały nigdy nieczyszczone.</li><li>Pamięć podręczna bez limitu rozmiaru i bez wygasania.</li></ul><h2>6. Weryfikacja poprawki</h2><p>Ten sam pomiar co w kroku pierwszym, przez porównywalny czas i przy porównywalnym obciążeniu.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Wycieki w kodzie natywnym — w bibliotekach z rozszerzeniami — nie pokazują się w zrzucie sterty. Rosnące RSS przy stabilnej stercie wskazuje właśnie na to i wymaga zupełnie innych narzędzi.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak ustawić prosty proces ciągłej integracji',
    excerpt: 'Automatyczne testy przy każdej zmianie — minimalna konfiguracja, która realnie coś daje.',
    body: `<p>Nawet najprostszy proces uruchamiający testy przy każdym wypchnięciu wyłapuje błędy, zanim zobaczy je ktokolwiek inny.</p><h2>1. Co uruchamiać</h2><p>Kolejność od najszybszego do najwolniejszego, żeby wynik przychodził wcześnie:</p><ol><li>Sprawdzenie stylu i analiza statyczna.</li><li>Sprawdzenie typów.</li><li>Testy jednostkowe.</li><li>Budowanie.</li><li>Testy integracyjne.</li></ol><h2>2. Przykład dla GitHub Actions</h2><p>Plik <code>.github/workflows/ci.yml</code>:</p><pre><code>name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build</code></pre><h2>3. Dlaczego npm ci, a nie npm install</h2><p>Instalacja z pliku blokady, dokładnie tych wersji co lokalnie. <code>npm install</code> potrafi zaktualizować zależności i sprawić, że wynik zależy od dnia uruchomienia.</p><h2>4. Baza w testach integracyjnych</h2><pre><code>    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: &gt;-
          --health-cmd pg_isready --health-interval 10s --health-retries 5</code></pre><h2>5. Sekrety</h2><p>Nigdy w pliku konfiguracji — wyłącznie przez mechanizm sekretów repozytorium. Warto pamiętać, że w publicznym repozytorium proces uruchamiany dla zgłoszeń z zewnątrz nie powinien mieć do nich dostępu.</p><h2>6. Wymuszenie</h2><p>Proces, którego wynik można zignorować, przestaje mieć znaczenie po pierwszym pilnym wdrożeniu. Warto ustawić go jako wymagany przed scaleniem.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zielony wynik oznacza tylko tyle, że testy przeszły. Przy niskim pokryciu daje fałszywe poczucie bezpieczeństwa — a wolny proces trwający kwadrans przestaje być używany, bo ludzie przestają na niego czekać.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak napisać migrację bazy, która nie zablokuje produkcji',
    excerpt: 'Zmiany schematu na działającej bazie — kolejność kroków i pułapki blokad.',
    body: `<p>Migracja, która zablokuje tabelę na minutę, zatrzymuje całą aplikację. Kolejność operacji rozstrzyga, czy to się stanie.</p><h2>1. Dodanie kolumny</h2><p>Kolumna dopuszczająca puste wartości, bez wartości domyślnej, jest tania. Kolumna z wymogiem niepustości i wartością domyślną w starszych wersjach silników przepisywała całą tabelę — w nowszych PostgreSQL jest to operacja natychmiastowa, ale warto sprawdzić wersję przed założeniem.</p><h2>2. Bezpieczna kolejność</h2><ol><li>Dodaj kolumnę dopuszczającą puste wartości.</li><li>Wdroż kod, który zapisuje do starej i nowej.</li><li>Uzupełnij dane partiami.</li><li>Dodaj ograniczenie niepustości.</li><li>Wdroż kod czytający wyłącznie z nowej.</li><li>Usuń starą kolumnę.</li></ol><p>Każdy krok jest wstecznie zgodny — w każdej chwili można się zatrzymać.</p><h2>3. Indeks bez blokady</h2><pre><code>CREATE INDEX CONCURRENTLY idx_nazwa ON tabela (kolumna);</code></pre><p>Trwa dłużej, ale nie blokuje zapisów. Nie działa wewnątrz transakcji, więc narzędzie do migracji musi to obsłużyć. Nieudane tworzenie zostawia indeks w stanie nieprawidłowym — trzeba go usunąć i powtórzyć.</p><h2>4. Uzupełnianie danych partiami</h2><pre><code>UPDATE tabela SET nowa = stara
WHERE id BETWEEN 1 AND 10000 AND nowa IS NULL;</code></pre><p>Jedno polecenie na milionach wierszy trzyma blokady i puchnie dziennik transakcji.</p><h2>5. Limit czasu oczekiwania na blokadę</h2><pre><code>SET lock_timeout = '3s';</code></pre><p>Migracja czekająca na blokadę ustawia za sobą kolejkę wszystkich innych zapytań. Lepiej, żeby poddała się szybko i została powtórzona.</p><h2>6. Próba na kopii</h2><p>Migrację uruchamiamy najpierw na kopii produkcyjnej bazy, mierząc czas. Wynik z bazy deweloperskiej z tysiącem wierszy nie mówi nic.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Usunięcie kolumny jest nieodwracalne. Zanim to zrobisz, upewnij się, że żadna wersja kodu — także ta, do której można się wycofać — z niej nie korzysta.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak debugować aplikację działającą w kontenerze',
    excerpt: 'Wejście do środka, podgląd dzienników i podłączenie debuggera bez przebudowy obrazu.',
    body: `<p>Kontener utrudnia diagnostykę tylko pozornie — narzędzia są te same, dochodzi jedna warstwa dostępu.</p><h2>1. Dzienniki</h2><pre><code>docker logs -f --tail 100 nazwa
docker compose logs -f usluga</code></pre><h2>2. Powłoka w działającym kontenerze</h2><pre><code>docker exec -it nazwa sh
docker exec -it nazwa bash</code></pre><p>W obrazach minimalnych bywa dostępna tylko pierwsza.</p><h2>3. Gdy kontener natychmiast się kończy</h2><pre><code>docker logs nazwa
docker run --rm -it --entrypoint sh obraz</code></pre><p>Podmiana punktu wejścia pozwala wejść do środka i sprawdzić, dlaczego program nie startuje — najczęściej brakuje pliku, uprawnień albo zmiennej.</p><h2>4. Narzędzia w obrazie bez narzędzi</h2><pre><code>docker run -it --rm --pid container:nazwa --net container:nazwa \\
  --cap-add SYS_PTRACE nicolaka/netshoot</code></pre><p>Kontener diagnostyczny wpięty w te same przestrzenie nazw widzi procesy i sieć badanego, mając własny zestaw narzędzi.</p><h2>5. Debugger Node.js</h2><pre><code>docker run -p 9229:9229 obraz node --inspect=0.0.0.0:9229 app.js</code></pre><p>Adres nasłuchu musi być <code>0.0.0.0</code> — domyślna pętla zwrotna jest w kontenerze niedostępna z zewnątrz.</p><h2>6. Zmienne i konfiguracja</h2><pre><code>docker inspect nazwa | jq '.[0].Config.Env'
docker compose config</code></pre><h2>7. Zasoby</h2><pre><code>docker stats</code></pre><p>Kontener zabijany z kodem 137 to przekroczony limit pamięci, a nie awaria aplikacji.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zmiany wprowadzone przez <code>docker exec</code> znikają przy odtworzeniu kontenera. To narzędzie diagnostyczne — poprawka musi trafić do obrazu albo do konfiguracji.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak dodać uwierzytelnianie dwuskładnikowe do własnej aplikacji',
    excerpt: 'TOTP od strony implementacji: rejestracja, weryfikacja, kody zapasowe i typowe błędy.',
    body: `<p>Drugi składnik oparty na czasie da się dodać bez usług zewnętrznych — algorytm jest prosty, a biblioteki istnieją dla każdego języka.</p><h2>1. Sekret dla użytkownika</h2><p>Losowy ciąg co najmniej 160 bitów, zakodowany w Base32. Przechowywany zaszyfrowany, nie jawnie — wyciek bazy z sekretami znosi cały mechanizm.</p><h2>2. Przekazanie do aplikacji</h2><p>Kod QR z adresem w formacie:</p><pre><code>otpauth://totp/NazwaSerwisu:uzytkownik@example.com?secret=BASE32&amp;issuer=NazwaSerwisu</code></pre><p>Obok kodu warto pokazać sekret tekstem — nie każdy może zeskanować obraz.</p><h2>3. Potwierdzenie przy włączaniu</h2><p>Sekret zapisujemy jako aktywny dopiero po tym, jak użytkownik poprawnie przepisze pierwszy kod. Inaczej łatwo zablokować sobie konto źle dodanym wpisem.</p><h2>4. Weryfikacja</h2><p>Sprawdzamy kod dla bieżącego przedziału czasu i zwykle jednego wstecz oraz w przód, żeby wybaczyć drobny rozjazd zegara. Szersze okno osłabia zabezpieczenie.</p><h2>5. Ochrona przed powtórzeniem</h2><p>Zapamiętujemy numer ostatnio użytego przedziału i odrzucamy ten sam kod po raz drugi. Bez tego przechwycony kod działa przez cały pozostały czas jego ważności.</p><h2>6. Ograniczenie liczby prób</h2><p>Sześć cyfr to milion możliwości — bez limitu prób atak siłowy jest realny. Kilka prób na minutę, potem blokada.</p><h2>7. Kody zapasowe</h2><p>Generowane raz, pokazywane jednorazowo, przechowywane jako skróty. Każdy do jednokrotnego użycia. Bez nich utrata telefonu oznacza utratę konta.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>TOTP nie chroni przed stroną podszywającą się pod serwis — kod da się wyłudzić razem z hasłem. Odporność na to dają dopiero klucze sprzętowe weryfikujące domenę. Warto też pamiętać, że procedura odzyskiwania konta staje się teraz najsłabszym ogniwem.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak przygotować aplikację Node.js do produkcji',
    excerpt: 'Różnice między środowiskiem pracy a produkcją: proces, dzienniki, limity i wyłączanie.',
    body: `<p>Aplikacja działająca lokalnie i ta sama aplikacja na serwerze różnią się kilkoma rzeczami, o których łatwo zapomnieć.</p><h2>1. Tryb produkcyjny</h2><pre><code>NODE_ENV=production</code></pre><p>Wiele bibliotek zmienia zachowanie na podstawie tej zmiennej — wyłącza szczegółowe komunikaty błędów i włącza pamięci podręczne.</p><h2>2. Zależności</h2><pre><code>npm ci --omit=dev</code></pre><h2>3. Zarządzanie procesem</h2><p>Aplikacja musi wstawać po restarcie i po awarii. Wystarczy jednostka systemd z <code>Restart=on-failure</code> — nie trzeba dodatkowego menedżera procesów.</p><h2>4. Czyste wyłączanie</h2><pre><code>process.on('SIGTERM', async () =&gt; {
  server.close();
  await pula.end();
  process.exit(0);
});</code></pre><p>Bez tego wdrożenie zrywa trwające żądania w połowie. Systemd wysyła <code>SIGTERM</code> i czeka, zanim zabije proces.</p><h2>5. Dzienniki na wyjście standardowe</h2><p>Nie do plików — niech zbiera je journald albo mechanizm kontenera. Rotacja i limity są wtedy poza aplikacją, gdzie ich miejsce.</p><h2>6. Limity</h2><pre><code>[Service]
MemoryMax=1G
LimitNOFILE=65535</code></pre><p>Domyślny limit otwartych plików bywa zbyt niski dla serwera obsługującego wiele połączeń.</p><h2>7. Kontrola stanu</h2><p>Punkt końcowy sprawdzający także zależności — samo „aplikacja odpowiada" nie mówi nic, gdy baza jest niedostępna.</p><h2>8. Nie jako root</h2><p>Osobne konto systemowe i pojedyncza zdolność, jeśli potrzebny jest niski port. Częściej i tak przed aplikacją stoi odwrotne proxy.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Node działa w jednym wątku. Wykorzystanie wielu rdzeni wymaga uruchomienia kilku procesów za wspólnym proxy — co z kolei wymusza, żeby stan sesji nie żył w pamięci pojedynczego procesu.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak korzystać z git bisect do znalezienia commita psującego kod',
    excerpt: 'Przeszukiwanie połówkowe historii — kilkanaście kroków zamiast przeglądania setek zmian.',
    body: `<p>Gdy wiadomo, że kiedyś działało, a teraz nie, <code>git bisect</code> znajduje winowajcę w liczbie kroków rzędu logarytmu z liczby commitów.</p><h2>1. Start</h2><pre><code>git bisect start
git bisect bad                 # obecny stan jest zły
git bisect good v1.2.0         # ta wersja działała</code></pre><p>Git przechodzi do commita w połowie zakresu.</p><h2>2. Ocena i kolejny krok</h2><pre><code>git bisect good   # albo: git bisect bad</code></pre><p>Powtarzamy, aż zostanie jeden commit. Przy tysiącu commitów to około dziesięciu kroków.</p><h2>3. Zakończenie</h2><pre><code>git bisect reset</code></pre><h2>4. Automatycznie</h2><pre><code>git bisect start HEAD v1.2.0
git bisect run npm test</code></pre><p>Skrypt musi zwracać zero dla stanu dobrego i wartość niezerową dla złego. Kod wyjścia 125 oznacza „nie da się ocenić" i taki commit zostanie pominięty — przydatne, gdy część historii się nie buduje.</p><h2>5. Własny skrypt oceniający</h2><pre><code>#!/usr/bin/env bash
npm ci --silent || exit 125
npm run build --silent || exit 125
./sprawdz-blad.sh</code></pre><h2>6. Pomijanie</h2><pre><code>git bisect skip</code></pre><h2>7. Podgląd postępu</h2><pre><code>git bisect log
git bisect visualize</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Metoda zakłada, że błąd pojawia się jednoznacznie w jednym commicie. Przy błędach zależnych od czasu albo od danych zewnętrznych ocena bywa niepewna i wynik wskaże niewłaściwe miejsce. Wymaga też, żeby każdy pośredni commit dawał się zbudować — historia z popsutymi stanami pośrednimi znacznie to utrudnia.</p>`,
    sources: [{ url: 'https://git-scm.com/docs/git-bisect', title: 'git-bisect — dokumentacja' }],
  },
  {
    kat: 'kod',
    title: 'Jak ograniczyć rozmiar obrazu kontenera',
    excerpt: 'Praktyczne sposoby zejścia z gigabajtów do dziesiątek megabajtów — i kiedy nie warto.',
    body: `<p>Duży obraz to dłuższe pobieranie przy każdym wdrożeniu i większa powierzchnia ataku.</p><h2>1. Zmierz, zanim zaczniesz</h2><pre><code>docker images
docker history obraz:tag</code></pre><p>Druga komenda pokazuje rozmiar każdej warstwy — od razu widać, która instrukcja waży najwięcej.</p><h2>2. Budowanie wieloetapowe</h2><p>Największy pojedynczy zysk. Kompilator, nagłówki i zależności deweloperskie zostają w etapie budowania.</p><h2>3. Mniejszy obraz bazowy</h2><ul><li>Warianty <code>slim</code> — bezpieczny wybór, zwykle wystarczający.</li><li>Warianty na Alpine — mniejsze, ale inna biblioteka standardowa C; część pakietów z komponentami natywnymi wymaga wtedy kompilacji.</li><li>Obrazy bez powłoki — najmniejsze i najbezpieczniejsze, ale niemożliwe do zdiagnozowania od środka.</li></ul><h2>4. Sprzątanie w tej samej warstwie</h2><pre><code>RUN apt-get update &amp;&amp; apt-get install -y --no-install-recommends pakiet \\
 &amp;&amp; rm -rf /var/lib/apt/lists/*</code></pre><p>Kasowanie w osobnej instrukcji nie zmniejsza obrazu — pliki zostają w warstwie niżej.</p><h2>5. Plik .dockerignore</h2><p>Bez niego do obrazu trafia katalog <code>.git</code> z całą historią i lokalne zależności.</p><h2>6. Tylko potrzebne pliki</h2><pre><code>COPY --from=budowanie /app/dist ./dist
COPY --from=budowanie /app/node_modules ./node_modules</code></pre><h2>7. Sprawdzenie zawartości</h2><pre><code>docker run --rm -it obraz sh -c "du -sh /* 2&gt;/dev/null | sort -h"</code></pre><h2>Czego ten materiał nie rozwiązuje</h2><p>Poniżej pewnego progu dalsze zmniejszanie przestaje się opłacać. Warstwy bazowe są współdzielone i pobierane raz, więc różnica między obrazem pięćdziesięcio- a stumegabajtowym bywa niewidoczna — a diagnostyka obrazu bez powłoki potrafi kosztować cały dzień.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak obsłużyć webhooki, żeby nie zgubić ani nie zdublować zdarzeń',
    excerpt: 'Weryfikacja podpisu, idempotentność i kolejka — trzy rzeczy, bez których to nie działa.',
    body: `<p>Webhook to żądanie od zewnętrznej usługi. Trzy rzeczy trzeba założyć z góry: może przyjść dwa razy, może przyjść z opóźnieniem i może przyjść od kogoś innego.</p><h2>1. Weryfikacja podpisu</h2><p>Bez niej trasa webhooka jest publicznym przyciskiem do wywołania dowolnego zdarzenia. Podpis liczy się z <strong>surowej treści</strong> żądania — po przetworzeniu przez parser JSON i ponownym złożeniu bajty bywają inne i podpis się nie zgodzi. W wielu frameworkach wymaga to wyłączenia parsera dla tej jednej trasy.</p><h2>2. Odpowiadaj szybko</h2><p>Dostawcy mają krótkie limity czasu. Kolejność właściwa: zweryfikuj podpis, zapisz zdarzenie, odpowiedz 200, przetwarzaj w tle. Ciężka praca przed odpowiedzią kończy się przekroczeniem czasu i ponowieniem — czyli podwójnym przetworzeniem.</p><h2>3. Idempotentność</h2><p>Każde zdarzenie ma identyfikator. Zapisujemy go z ograniczeniem unikalności i przy powtórzeniu po prostu potwierdzamy odbiór:</p><pre><code>INSERT INTO zdarzenia (id_zewnetrzne) VALUES ($1)
ON CONFLICT (id_zewnetrzne) DO NOTHING</code></pre><p>Brak wstawionego wiersza oznacza, że to powtórka.</p><h2>4. Kolejność nie jest gwarantowana</h2><p>Zdarzenie o anulowaniu potrafi przyjść przed zdarzeniem o utworzeniu. Stan wyliczamy z danych pobranych od dostawcy albo ze znacznika czasu zdarzenia, nie z kolejności doręczeń.</p><h2>5. Kody odpowiedzi</h2><p>Dla dostawcy błąd znaczy „przyślij ponownie". Przy zdarzeniu, którego nie umiemy obsłużyć, lepiej odpowiedzieć 200 i zapisać problem u siebie — inaczej dostawca będzie ponawiał je przez dobę.</p><h2>6. Testowanie lokalne</h2><p>Narzędzia tunelujące udostępniają lokalny port publicznie. Wielu dostawców ma też własne narzędzia do przekazywania zdarzeń na maszynę deweloperską.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Webhook może nie dojść wcale — przy dłuższej awarii część dostawców przestaje ponawiać. Przy zdarzeniach krytycznych, jak płatności, potrzebny jest okresowy proces uzgadniający stan z dostawcą.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak sensownie wersjonować własne API',
    excerpt: 'Kiedy wersjonować, jak to zrobić i jak wycofać starą wersję bez psucia klientów.',
    body: `<p>Wersjonowanie potrzebne jest wtedy, gdy zmiana psuje istniejących klientów. Dodanie nowego pola nią nie jest.</p><h2>1. Co łamie zgodność</h2><ul><li>Usunięcie lub zmiana nazwy pola.</li><li>Zmiana typu albo formatu wartości.</li><li>Nowe pole wymagane w żądaniu.</li><li>Zmiana znaczenia istniejącego pola — najgroźniejsza, bo niewidoczna.</li><li>Zmiana kodów odpowiedzi w sytuacjach błędnych.</li></ul><h2>2. Co zgodności nie łamie</h2><p>Dodanie pola w odpowiedzi, dodanie opcjonalnego parametru, dodanie nowego punktu końcowego. Pod warunkiem, że klienci ignorują nieznane pola — warto to udokumentować jako wymóg.</p><h2>3. Sposoby wersjonowania</h2><ul><li><strong>W ścieżce</strong> (<code>/v1/zasoby</code>) — najczytelniejsze, łatwe do przekierowania i podejrzenia w dzienniku.</li><li><strong>W nagłówku</strong> — czystsze teoretycznie, trudniejsze w diagnostyce i w pamięciach podręcznych.</li><li><strong>Po dacie</strong> — klient deklaruje wersję datą; elastyczne, ale kosztowne w utrzymaniu.</li></ul><h2>4. Wycofywanie</h2><ol><li>Ogłoś termin z wyprzedzeniem.</li><li>Dodaj nagłówek ostrzegawczy w odpowiedziach starej wersji.</li><li>Sprawdź w dziennikach, kto jeszcze z niej korzysta.</li><li>Krótkie okresowe wyłączenia przed terminem — pokazują, kto naprawdę nie zdążył.</li><li>Wyłącz.</li></ol><h2>5. Domyślna wersja</h2><p>Żądanie bez wskazania wersji nie powinno automatycznie dostawać najnowszej — klient napisany dziś przestanie działać przy kolejnej zmianie. Lepiej wymagać jawnego wskazania.</p><h2>6. Dziennik jako źródło wiedzy</h2><p>Zapisywanie wersji i identyfikatora klienta przy każdym żądaniu jest jedynym sposobem, żeby wiedzieć, kogo dotknie wyłączenie.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Każda utrzymywana wersja to kod, który trzeba testować i łatać. Dwie wersje to dwa razy więcej pracy — dlatego warto wersjonować rzadko i wycofywać zdecydowanie.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak sprawdzić, co spowalnia stronę internetową',
    excerpt: 'Od pomiaru po przyczynę: serwer, sieć, zasoby czy kod w przeglądarce.',
    body: `<p>„Strona wolno się ładuje" ma kilka rozłącznych przyczyn. Pomiar wskazuje, w której warstwie szukać.</p><h2>1. Czas odpowiedzi serwera</h2><pre><code>curl -o /dev/null -s -w "dns:%{time_namelookup} tcp:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\\n" https://example.com</code></pre><p>Wysoki czas do pierwszego bajtu przy niskich pozostałych oznacza, że problem jest po stronie serwera — sieć i uzgadnianie są w porządku.</p><h2>2. Wielkość i liczba zasobów</h2><p>W narzędziach deweloperskich, w zakładce sieci, sortujemy po rozmiarze. Typowi winowajcy to nieskompresowane obrazy, kroje pisma i biblioteki wczytywane w całości dla jednej funkcji.</p><h2>3. Blokowanie renderowania</h2><p>Skrypty i style w nagłówku wstrzymują wyświetlenie. Skrypty niepotrzebne od razu oznaczamy jako odroczone albo asynchroniczne.</p><h2>4. Obrazy</h2><ul><li>Nowoczesne formaty zamiast JPEG i PNG.</li><li>Rozmiar dopasowany do miejsca wyświetlania — nie skalowanie w przeglądarce.</li><li>Leniwe ładowanie poniżej pierwszego ekranu.</li><li>Podane wymiary, żeby układ nie skakał po doładowaniu.</li></ul><h2>5. Kompresja i pamięć podręczna</h2><pre><code>curl -sI -H "Accept-Encoding: gzip, br" https://example.com | grep -iE "content-encoding|cache-control"</code></pre><h2>6. Praca w przeglądarce</h2><p>Zakładka wydajności pokazuje, ile czasu zajmuje wykonywanie skryptów i przeliczanie układu. Długie zadania blokujące główny wątek objawiają się jako strona, która się wyświetliła, ale nie reaguje.</p><h2>7. Pomiar u prawdziwych użytkowników</h2><p>Test z szybkiego łącza na mocnym komputerze nie mówi nic o telefonie w sieci komórkowej. Warto włączyć symulację wolniejszego łącza i procesora.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Nie wskaże, dlaczego serwer długo generuje odpowiedź. To osobna diagnostyka — najczęściej po stronie zapytań do bazy albo wywołań usług zewnętrznych.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak uporządkować zależności w projekcie',
    excerpt: 'Plik blokady, audyt podatności i aktualizacje, które nie psują wszystkiego naraz.',
    body: `<p>Zależności to kod, za który odpowiadasz, choć go nie napisałeś. Warto wiedzieć, co się w nich dzieje.</p><h2>1. Plik blokady jest obowiązkowy</h2><p><code>package-lock.json</code>, <code>yarn.lock</code> czy odpowiednik trafia do repozytorium zawsze. Bez niego to samo polecenie instaluje inne wersje na innych maszynach i w innych dniach.</p><h2>2. Instalacja odtwarzalna</h2><pre><code>npm ci</code></pre><p>Instaluje dokładnie to, co w pliku blokady, i przerywa przy rozjeździe z deklaracją zależności.</p><h2>3. Co jest w drzewie</h2><pre><code>npm ls --all
npm ls nazwa-pakietu</code></pre><p>Drugie polecenie pokazuje, kto ciągnie daną zależność — przydatne przy ustalaniu, dlaczego coś w ogóle się znalazło w projekcie.</p><h2>4. Podatności</h2><pre><code>npm audit
npm audit --omit=dev</code></pre><p>Warto oddzielić zależności produkcyjne od narzędzi deweloperskich — podatność w narzędziu budowania to inna sprawa niż w kodzie serwera.</p><h2>5. Aktualizacje</h2><pre><code>npm outdated
npm update            # w granicach zakresów
npm install pakiet@latest</code></pre><p>Zmiany wersji głównej robimy pojedynczo, z przeczytaniem informacji o zmianach. Aktualizacja dwudziestu pakietów naraz przy błędzie nie mówi, który go spowodował.</p><h2>6. Sprzątanie</h2><pre><code>npx depcheck</code></pre><p>Wskazuje zależności zadeklarowane, ale nieużywane.</p><h2>7. Przed dodaniem nowej</h2><p>Warto sprawdzić datę ostatniej zmiany, liczbę własnych zależności i to, czy funkcja, dla której ją bierzemy, nie mieści się w dwudziestu linijkach własnego kodu.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Automatyczne aktualizacje bez testów przenoszą problem, zamiast go rozwiązywać. Bot podnoszący wersje ma sens dopiero przy działającym procesie testów — inaczej produkuje zgłoszenia, których nikt nie umie ocenić.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak napisać test, który faktycznie coś sprawdza',
    excerpt: 'Co testować, czego nie, i dlaczego wysokie pokrycie bywa mylące.',
    body: `<p>Test ma odpowiadać na pytanie „czy to nadal działa", a nie podnosić statystykę pokrycia.</p><h2>1. Trzy części</h2><pre><code>test('odrzuca zamówienie przy pustym magazynie', async () =&gt; {
  const magazyn = { sztuk: 0 };            // przygotowanie
  const wynik = await zamow(magazyn, 1);   // działanie
  expect(wynik.ok).toBe(false);            // sprawdzenie
});</code></pre><h2>2. Nazwa opisuje zachowanie</h2><p>„odrzuca zamówienie przy pustym magazynie" mówi, co się zepsuło, gdy test padnie. „test zamówienia" nie mówi nic.</p><h2>3. Co warto testować</h2><ul><li>Logikę biznesową i przypadki brzegowe.</li><li>Błędy, które już raz wystąpiły — test przed poprawką.</li><li>Miejsca styku z systemami zewnętrznymi.</li></ul><h2>4. Czego nie warto</h2><ul><li>Cudzych bibliotek — one mają własne testy.</li><li>Prostych metod dostępowych bez logiki.</li><li>Szczegółów implementacji: test sprawdzający, że wywołano konkretną metodę wewnętrzną, psuje się przy każdej refaktoryzacji, choć zachowanie się nie zmieniło.</li></ul><h2>5. Pułapka pokrycia</h2><p>Pokrycie mówi, które linie zostały wykonane — nie, czy cokolwiek sprawdzono. Test wywołujący funkcję bez asercji podnosi pokrycie i nie wykrywa niczego. Sto procent pokrycia bywa gorszym sygnałem niż sześćdziesiąt, bo sugeruje testy pisane pod miarę.</p><h2>6. Testy muszą być niezależne</h2><p>Test zależny od kolejności wykonania albo od stanu zostawionego przez poprzedni będzie migotał. Migoczące testy uczą ignorować czerwony wynik — i to jest ich najgorszy skutek.</p><h2>7. Szybkość</h2><p>Testy jednostkowe uruchamiane po każdej zmianie muszą trwać sekundy. Wolniejsze, integracyjne, uruchamia się rzadziej.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Zielony wynik nie dowodzi poprawności — dowodzi jedynie, że sprawdzone przypadki działają. Błędy biorą się zwykle z przypadków, o których nikt nie pomyślał, więc i testu na nie nie ma.</p>`,
  },
  {
    kat: 'kod',
    title: 'Jak wdrożyć aplikację bez przerwy w działaniu',
    excerpt: 'Wdrożenie, przy którym użytkownicy nie widzą błędu — z zachowaniem możliwości wycofania.',
    body: `<p>Zatrzymanie starej wersji i uruchomienie nowej daje przerwę równą czasowi startu aplikacji. Da się tego uniknąć.</p><h2>1. Warunek wstępny: czyste wyłączanie</h2><p>Aplikacja po otrzymaniu sygnału zakończenia przestaje przyjmować nowe połączenia, kończy trwające i dopiero wychodzi. Bez tego każde wdrożenie zrywa żądania w połowie.</p><h2>2. Dwie kopie za proxy</h2><p>Uruchamiamy nową obok starej, czekamy na jej gotowość, przełączamy ruch, wygaszamy starą. Proxy musi mieć kontrolę stanu, żeby nie kierować ruchu do instancji, która jeszcze nie wstała.</p><h2>3. Kolejność przy zmianach w bazie</h2><p>Migracja musi być zgodna z <strong>obiema</strong> wersjami kodu, bo przez chwilę działają razem. Stąd zasada: najpierw dodaj, potem wdroż kod, potem usuń — nigdy w jednym kroku.</p><h2>4. Kontrola stanu, która coś znaczy</h2><p>Punkt sprawdzający także połączenie z bazą i innymi zależnościami. Odpowiedź „żyję" od aplikacji bez dostępu do bazy jest gorsza niż jej brak.</p><h2>5. Wycofanie</h2><p>Poprzednia wersja musi dać się uruchomić natychmiast. Oznacza to zachowanie poprzedniego obrazu albo katalogu i pewność, że działa on z bieżącym schematem bazy — dlatego migracje niszczące odkłada się na później.</p><h2>6. Prosty wariant przez systemd</h2><pre><code>systemctl reload-or-restart mojaapp</code></pre><p>Przy aplikacji obsługującej przeładowanie bez zrywania połączeń to bywa wystarczające.</p><h2>7. Stopniowe wypuszczanie</h2><p>Kierowanie części ruchu do nowej wersji i obserwacja błędów przed przełączeniem reszty. Wymaga proxy, które to potrafi, i mierzenia właściwych wskaźników.</p><h2>Czego ten materiał nie rozwiązuje</h2><p>Wdrożenie bez przerwy nie chroni przed złym kodem — rozkłada tylko awarię w czasie. Bez obserwacji wskaźników po wdrożeniu przełączy się cały ruch na wersję, która działa gorzej.</p>`,
  },
];
