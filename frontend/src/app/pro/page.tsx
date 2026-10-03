'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check, Loader2, Sparkles, CreditCard, Clock, ShieldCheck,
  ArrowRight, Lock, Unlock, Zap,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth-context';
import { usePremium, useProWidoczne, type PremiumFeature } from '@/lib/queries/premium';
import { useCennik, useStanPro, useStripeAkcje, type Plan } from '@/lib/queries/stripe';
import { OPRAWA, DOMYSLNA } from './features-map';

export default function ProPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="py-24 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-muted" />
          </div>
        </AppLayout>
      }
    >
      <ProContent />
    </Suspense>
  );
}

function ProContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: premium, isLoading: premiumLadowanie } = usePremium();
  const proWidoczne = useProWidoczne();
  const { data: cennik, isLoading: cennikLadowanie } = useCennik();
  const { data: stan } = useStanPro(Boolean(user));
  const { kup, panel } = useStripeAkcje();
  const [blad, setBlad] = useState<string | null>(null);

  const platnosc = params.get('platnosc');
  const czekamy = platnosc === 'ok' && !stan?.isPro;

  /*
   * Po powrocie z płatności PRO nie pojawia się natychmiast: nadaje je
   * dopiero webhook, który przychodzi osobnym połączeniem. Dlatego przez
   * chwilę odpytujemy — zamiast kazać użytkownikowi odświeżać stronę
   * i zgadywać, czy przelew przeszedł.
   */
  useEffect(() => {
    if (!czekamy) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['stripe', 'moj-stan'] });
      qc.invalidateQueries({ queryKey: ['premium', 'features'] });
    }, 3000);
    const koniec = setTimeout(() => clearInterval(t), 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(koniec);
    };
  }, [czekamy, qc]);

  const funkcje = [...(premium?.features ?? [])].sort((a, b) => a.position - b.position);
  const platnych = funkcje.filter((f) => f.requiresPremium).length;
  const wszystkoZaDarmo = funkcje.length > 0 && platnych === 0;

  const idzDoStripe = async (okres: 'month' | 'year') => {
    setBlad(null);
    try {
      const { url } = await kup.mutateAsync(okres);
      if (url) window.location.href = url;
    } catch (e: any) {
      setBlad(e?.response?.data?.message ?? 'Nie udało się rozpocząć płatności.');
    }
  };

  const idzDoPanelu = async () => {
    setBlad(null);
    try {
      const { url } = await panel.mutateAsync();
      if (url) window.location.href = url;
    } catch (e: any) {
      setBlad(e?.response?.data?.message ?? 'Nie udało się otworzyć panelu płatności.');
    }
  };

  /*
   * Schowane PRO = strona zamknięta, nie sam ukryty przycisk.
   * Adres bywa zapamiętany w zakładkach i podsuwany przez przeglądarkę,
   * więc bez tego strona z cennikiem żyłaby dalej mimo wyłączenia.
   *
   * Czekamy na odpowiedź, zanim cokolwiek orzekniemy: inaczej każdy
   * dostałby najpierw „niedostępne", a dopiero potem właściwą stronę.
   */
  if (premiumLadowanie) {
    return (
      <AppLayout>
        <div className="py-24 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-content-muted" />
        </div>
      </AppLayout>
    );
  }

  if (!proWidoczne) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md py-24 text-center">
          <Sparkles className="mx-auto mb-4 h-7 w-7 text-content-muted" />
          <h1 className="text-xl font-semibold text-content-primary">
            UNDERNET PRO jeszcze nie wystartowało
          </h1>
          <p className="mt-2 text-sm text-content-secondary">
            Wszystko na portalu jest teraz otwarte dla każdego konta.
            Damy znać, gdy będzie co kupować.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line-strong px-5 py-2.5 text-sm text-content-secondary transition-colors hover:text-content-primary"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-14 pb-10">
        {/* ══════════════ HERO ══════════════ */}
        <section className="relative overflow-hidden rounded-3xl border border-line bg-mesh px-6 py-14 text-center sm:px-10 sm:py-20">
          {/* Siatka i dwie poświaty w tle. `pointer-events-none`, bo to
              dekoracja — nie może przechwytywać kliknięć w przyciski. */}
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden />
          <div
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-neon-purple/20 blur-[100px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-neon-cyan/20 blur-[100px]"
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-green/30 bg-neon-green/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-neon-green">
              <Zap className="h-3 w-3" />
              {funkcje.length > 0 ? `${funkcje.length} funkcji` : 'Wsparcie portalu'}
            </span>

            <h1 className="mt-5 text-4xl font-bold leading-tight text-content-primary sm:text-6xl">
              UNDERNET{' '}
              <span className="bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink bg-clip-text text-transparent">
                PRO
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-content-secondary">
              Portal zostaje otwarty dla wszystkich — treść, wiedza i dyskusje bez opłat.
              PRO dokłada narzędzia dla tych, którzy siedzą tu na co dzień. I trzyma serwer przy życiu.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#cennik"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
              >
                Zobacz plany
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#co-daje"
                className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-6 py-3 text-sm font-medium text-content-secondary transition-colors hover:text-content-primary"
              >
                Co dostaję
              </a>
            </div>
          </motion.div>
        </section>

        {/* ══════════════ KOMUNIKATY PO PŁATNOŚCI ══════════════ */}
        {platnosc === 'anulowana' && (
          <p className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-center text-sm text-content-secondary">
            Płatność anulowana — nic nie zostało pobrane.
          </p>
        )}

        {czekamy && (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-neon-green/25 bg-neon-green/5 px-4 py-3 text-center text-sm text-content-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Czekamy na potwierdzenie ze Stripe’a. Zwykle trwa to kilka sekund.
          </p>
        )}

        {stan?.isPro && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-neon-green/30 bg-neon-green/[0.06] px-6 py-6 text-center glow-green"
          >
            <ShieldCheck className="mx-auto h-7 w-7 text-neon-green" />
            <p className="mt-2 text-lg font-semibold text-content-primary">Masz aktywne PRO</p>
            {stan.proUntil && (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-content-muted">
                <Clock className="h-3.5 w-3.5" />
                Opłacone do {new Date(stan.proUntil).toLocaleDateString('pl-PL')}
              </p>
            )}
            {stan.maPlatnosci && (
              <button
                onClick={idzDoPanelu}
                disabled={panel.isPending}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-4 py-2 text-sm text-content-secondary transition-colors hover:text-content-primary"
              >
                {panel.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
                Zarządzaj subskrypcją
              </button>
            )}
          </motion.div>
        )}

        {/* ══════════════ CO DAJE PRO ══════════════ */}
        <section id="co-daje" className="relative scroll-mt-24">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-neon-cyan/10 blur-[120px]"
            aria-hidden
          />
          <header className="relative text-center">
            <h2 className="text-2xl font-bold text-content-primary sm:text-3xl">
              Co daje{' '}
              <span className="text-neon-cyan text-glow-cyan">PRO</span>
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-content-secondary">
              {wszystkoZaDarmo
                ? 'Dziś wszystko poniżej jest otwarte dla każdego konta. Kupując PRO, płacisz za utrzymanie portalu — nie za odblokowanie tych funkcji.'
                : 'Osiem narzędzi. Kłódka pokazuje, które z nich są dziś częścią PRO.'}
            </p>
          </header>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
            {funkcje.map((f, i) => (
              <KartaFunkcji
                key={f.key}
                funkcja={f}
                opoznienie={i * 0.05}
                pokazPlakietke={!wszystkoZaDarmo}
              />
            ))}
          </div>

          {funkcje.length === 0 && (
            <p className="py-8 text-center text-sm text-content-muted">Wczytywanie listy funkcji…</p>
          )}
        </section>

        {/* ══════════════ CENNIK ══════════════ */}
        <section id="cennik" className="scroll-mt-24">
          <header className="text-center">
            <h2 className="text-2xl font-bold text-content-primary sm:text-3xl">Plany</h2>
            <p className="mt-2 text-sm text-content-secondary">
              Rezygnacja w każdej chwili. Opłacony okres zostaje do końca.
            </p>
          </header>

          {cennikLadowanie ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-content-muted" />
            </div>
          ) : !cennik?.wlaczone ? (
            <p className="mt-6 rounded-xl border border-line bg-surface-raised px-4 py-5 text-center text-sm text-content-muted">
              Płatności nie są jeszcze uruchomione.
            </p>
          ) : stan?.isPro ? (
            <p className="mt-6 text-center text-sm text-content-muted">
              Plan zmienisz w panelu subskrypcji powyżej.
            </p>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {cennik.plany.map((p, i) => (
                <KartaPlanu
                  key={p.priceId}
                  plan={p}
                  plany={cennik.plany}
                  zalogowany={Boolean(user)}
                  pracuje={kup.isPending}
                  onKup={() => idzDoStripe(p.okres)}
                  opoznienie={i * 0.08}
                />
              ))}
            </div>
          )}

          {blad && <p className="mt-4 text-center text-sm text-neon-red">{blad}</p>}
        </section>

        {/* ══════════════ SPOKÓJ ══════════════ */}
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              tytul: 'Płaci Stripe, nie my',
              tresc: 'Danych karty nie widzimy ani nie przechowujemy. Cała płatność dzieje się po stronie Stripe’a.',
            },
            {
              tytul: 'Rezygnacja bez rozmów',
              tresc: 'Jedno kliknięcie w panelu subskrypcji. Żadnego pisania do nas ani okienek „na pewno?”.',
            },
            {
              tytul: 'Nic nie znika',
              tresc: 'Po wygaśnięciu PRO Twoje notatki, kolekcje i profil zostają. Przestają się tylko dawać zmieniać.',
            },
          ].map((k) => (
            <div key={k.tytul} className="rounded-xl border border-line bg-surface-raised p-4">
              <p className="text-sm font-semibold text-content-primary">{k.tytul}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-content-muted">{k.tresc}</p>
            </div>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

function KartaFunkcji({
  funkcja,
  opoznienie,
  pokazPlakietke,
}: {
  funkcja: PremiumFeature;
  opoznienie: number;
  pokazPlakietke: boolean;
}) {
  const o = OPRAWA[funkcja.key] ?? DOMYSLNA;
  const Ikona = o.icon;
  const platna = funkcja.requiresPremium;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: opoznienie }}
      className={`group relative overflow-hidden rounded-2xl border border-line bg-surface-raised p-5 transition-all hover:-translate-y-0.5 ${o.obwodka}`}
    >
      {/* Kreska w kolorze funkcji, zapalana najechaniem. Czysta dekoracja,
          więc `aria-hidden` i bez przechwytywania kliknięć. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${o.kreska}`}
        aria-hidden
      />

      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/5 transition-transform duration-300 group-hover:scale-110 ${o.tlo}`}
        >
          <Ikona className={`h-[22px] w-[22px] ${o.kolor} ${o.poswiata}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-content-primary">{funkcja.name}</h3>
            {pokazPlakietke && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  platna ? 'bg-neon-yellow/10 text-neon-yellow' : 'bg-neon-green/10 text-neon-green'
                }`}
              >
                {platna ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                {platna ? 'w PRO' : 'za darmo'}
              </span>
            )}
          </div>

          {/* Zdanie z oprawy mówi „co to realnie daje"; opis z panelu jest
              zapasem, żeby nowy klucz nie wyświetlił pustej karty. */}
          <p className="mt-1.5 text-xs leading-relaxed text-content-secondary">
            {o.zdanie || funkcja.description}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function KartaPlanu({
  plan,
  plany,
  zalogowany,
  pracuje,
  onKup,
  opoznienie,
}: {
  plan: Plan;
  plany: Plan[];
  zalogowany: boolean;
  pracuje: boolean;
  onKup: () => void;
  opoznienie: number;
}) {
  const roczny = plan.okres === 'year';

  /*
   * Oszczędność liczona z faktycznych cen ze Stripe'a, nie wpisana w kod.
   * Gdybyś zmienił kwotę w panelu Stripe, napis policzy się sam — zamiast
   * obiecywać rabat, którego już nie ma.
   */
  const miesieczny = plany.find((p) => p.okres === 'month');
  const oszczednosc =
    roczny && miesieczny ? Math.round((1 - plan.kwota / (miesieczny.kwota * 12)) * 100) : 0;

  const kwota = (v: number) => v.toFixed(2).replace('.', ',');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: opoznienie }}
      className={`relative overflow-hidden rounded-2xl border p-6 text-center transition-all ${
        roczny
          ? 'border-neon-cyan/40 bg-gradient-to-b from-neon-cyan/[0.07] to-transparent'
          : 'border-line bg-surface-raised'
      }`}
    >
      {roczny && oszczednosc > 0 && (
        <span className="absolute right-4 top-4 rounded-full bg-neon-cyan/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neon-cyan">
          −{oszczednosc}%
        </span>
      )}

      <p className="text-xs font-medium uppercase tracking-wider text-content-muted">
        {roczny ? 'Rocznie' : 'Miesięcznie'}
      </p>

      <p className="mt-3 text-4xl font-bold text-content-primary">
        {kwota(plan.kwota)}
        <span className="ml-1.5 text-base font-normal text-content-muted">{plan.waluta}</span>
      </p>

      <p className="mt-1 h-4 text-xs text-content-muted">
        {roczny && miesieczny ? `${kwota(plan.kwota / 12)} ${plan.waluta} miesięcznie` : ''}
      </p>

      {zalogowany ? (
        <button
          onClick={onKup}
          disabled={pracuje}
          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-50 ${
            roczny
              ? 'bg-gradient-to-r from-neon-cyan to-neon-purple text-black'
              : 'border border-line-strong text-content-primary hover:bg-surface-hover'
          }`}
        >
          {pracuje ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Wykup PRO
        </button>
      ) : (
        <Link
          href="/login?next=/pro"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong px-5 py-3 text-sm font-medium text-content-secondary transition-colors hover:text-content-primary"
        >
          Zaloguj się, żeby wykupić
        </Link>
      )}

      <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-content-muted">
        <Check className="h-3 w-3 text-neon-green" />
        Bez zobowiązań, rezygnacja w każdej chwili
      </p>
    </motion.div>
  );
}
