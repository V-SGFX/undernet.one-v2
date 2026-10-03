# UNDERNET.ONE

Polski portal wiedzy technicznej, zbudowany wokół jednej ścieżki:

```
PRAWDZIWY PROBLEM  →  DYSKUSJA  →  HOW TO  →  WIKI
```

Ktoś opisuje problem w społeczności, ludzie go rozkładają w wątku, a to,
co z tego wyjdzie, trafia do poradnika i hasła wiki. Każdy materiał
pamięta wątek, z którego wyrósł, a wątek pokazuje materiały, które z niego
powstały.

Działa produkcyjnie pod **[undernet.one](https://undernet.one)**.

## Zasady redakcyjne

- **Bez AI w treściach.** Newsy, poradniki i hasła pisze człowiek.
- **Bez fałszywych danych.** Seed zakłada konto administratora i strukturę,
  nie wymyśla użytkowników ani dyskusji.
- **Bez scrapera RSS.** Newsy są pisane ręcznie (skrót „Napisz news” w studiu).
- Hasła wiki może zaproponować każdy zalogowany; publikuje moderacja.

## Co jest w środku

| Obszar | Co robi |
| --- | --- |
| Społeczności | hierarchia społeczności, posty, komentarze, głosowanie, reakcje |
| Baza wiedzy | News, Artykuł, How To, Wiki — **jeden model `ContentItem`** z polem `type`, nie cztery tabele |
| Studio | edytor (TipTap) do pisania materiałów, obieg propozycji wiki |
| Konto | rejestracja z potwierdzeniem e-mail, logowanie Discord / Google / GitHub |
| Profil | kolekcje, notatki, alerty, zapisane, obserwowani autorzy i tagi |
| UNDERNET PRO | płatna subskrypcja przez Stripe; funkcje włączane przełącznikami serwisu |
| Moderacja | zgłoszenia, filtr NSFW, role |
| Wyszukiwarka | wspólna dla wątków i bazy wiedzy |
| SEO | mapa witryny, OpenGraph, odświeżanie stron na żądanie po zapisie |

## Technologie

**backend/** — API

- NestJS 11, TypeScript
- PostgreSQL + Prisma 6
- Redis (cache, kolejki BullMQ)
- Passport/JWT, OAuth, Nodemailer, Stripe, sharp

**frontend/** — strona

- Next.js 16 (App Router), React 19
- TanStack Query, Tailwind CSS, Framer Motion
- next-intl (polski i angielski)

## Uruchomienie lokalne

Wymagania: Node.js 20+, PostgreSQL, Redis.

```bash
# API
cd backend
cp .env.example .env          # uzupełnij pola WPISZ_
npm ci
npx prisma migrate deploy
npm run seed                  # konto administratora z SEED_ADMIN_*
npm run start:dev             # http://127.0.0.1:4100/api

# strona
cd ../frontend
cp .env.example .env.local
npm ci
npm run dev                   # http://127.0.0.1:3005
```

Wszystkie zmienne są opisane w `backend/.env.example` i
`frontend/.env.example`. Logowanie zewnętrzne, poczta i Stripe są
opcjonalne — bez kluczy dany przycisk lub funkcja po prostu się nie pokazuje.

### Produkcja

```bash
cd backend  && npm run build && npm start
cd frontend && npm run build && npm start
```

Przed oboma procesami stoi reverse proxy (u nas nginx), które pod tą samą
domeną kieruje `/api/` i `/uploads/` do API, a resztę do Next.js.

Dwie rzeczy, które łatwo przeoczyć:

- **Nie ustawiaj `NEXT_PUBLIC_API_URL` na adres wewnętrzny.** Zmienne
  `NEXT_PUBLIC_*` są wkompilowywane w kod przeglądarki. Serwer Next.js
  woła API przez `INTERNAL_API_URL`, przeglądarka — ścieżką względną.
- **Ustaw `client_max_body_size`** w nginx (np. `10m`). Domyślny 1 MB
  odrzuca wgrywane obrazki, zanim dotrą do aplikacji.

## Struktura

```
backend/
  prisma/            schemat i migracje
  scripts/tresci/    wczytywanie przygotowanych haseł wiki i poradników
  src/<moduł>/       moduły NestJS (content, communities, posts, auth, oauth, stripe, …)
frontend/
  messages/          tłumaczenia pl / en
  src/app/           trasy Next.js
  src/components/    komponenty interfejsu
  src/lib/           klient API, kontekst logowania, typy
```

## Licencja

Kod udostępniony do wglądu. Wszystkie prawa zastrzeżone — jeśli chcesz
go wykorzystać, napisz przez [undernet.one](https://undernet.one).
