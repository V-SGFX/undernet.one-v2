'use client';

import { useState } from 'react';
import { BellRing, Plus, Trash2, Loader2, Lock, Power } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth-context';
import { usePremium, useProWidoczne } from '@/lib/queries/premium';
import { useAlerts, useAlertMutations, type ZakresAlertu } from '@/lib/queries/alerts';
import Link from 'next/link';

const ZAKRESY: { value: ZakresAlertu; label: string }[] = [
  { value: 'BOTH', label: 'Wszędzie' },
  { value: 'POSTS', label: 'Tylko wątki' },
  { value: 'CONTENT', label: 'Tylko materiały' },
];

/**
 * Alerty na frazę.
 *
 * Ekran jest zarządzaniem, nie czytaniem — trafienia lądują w zwykłych
 * powiadomieniach, bo tam użytkownik i tak zagląda. Osobna skrzynka na
 * alerty byłaby drugim miejscem do pilnowania.
 */
export default function AlertyPage() {
  const { user } = useAuth();
  const { data: premium } = usePremium();
  const proWidoczne = useProWidoczne();
  const [fraza, setFraza] = useState('');
  const [zakres, setZakres] = useState<ZakresAlertu>('BOTH');
  const [blad, setBlad] = useState<string | null>(null);

  const platne = premium?.gated.includes('alerts') ?? false;
  const dostepne = !platne || (premium?.isPro ?? false);

  const { data: alerty, isLoading } = useAlerts(Boolean(user));
  const { utworz, przelacz, usun } = useAlertMutations();

  if (!user) {
    return (
      <AppLayout>
        <p className="py-16 text-center text-sm text-text-secondary">
          <Link href="/login" className="text-neon-cyan hover:underline">Zaloguj się</Link>, żeby ustawiać alerty.
        </p>
      </AppLayout>
    );
  }

  const dodaj = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlad(null);
    try {
      await utworz.mutateAsync({ phrase: fraza.trim(), scope: zakres });
      setFraza('');
    } catch (err: any) {
      setBlad(err?.response?.data?.message ?? 'Nie udało się dodać alertu.');
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <BellRing className="h-5 w-5 text-neon-cyan" />
            Alerty
            {!dostepne && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-normal text-amber-400">
                <Lock className="h-3 w-3" /> UNDERNET PRO
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pilnujemy frazy w nowych wątkach i materiałach. Trafienie przychodzi
            jako zwykłe powiadomienie — sprawdzamy co kwadrans.
          </p>
        </header>

        {!dostepne ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-text-secondary">
            Alerty są częścią{' '}
            {proWidoczne ? (
              <Link href="/pro" className="text-neon-green hover:underline">UNDERNET PRO</Link>
            ) : (
              <span className="text-neon-green">UNDERNET PRO</span>
            )}.
            {(alerty?.length ?? 0) > 0 &&
              ' Twoje dotychczasowe alerty zostają zapisane i ruszą z powrotem po wykupieniu.'}
          </div>
        ) : (
          <form onSubmit={dodaj} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={fraza}
                onChange={(e) => setFraza(e.target.value)}
                placeholder="Fraza, np. ZFS albo Proxmox"
                maxLength={100}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-green/50 focus:outline-none"
              />
              <select
                value={zakres}
                onChange={(e) => setZakres(e.target.value as ZakresAlertu)}
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary focus:border-neon-green/50 focus:outline-none"
              >
                {ZAKRESY.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={utworz.isPending || fraza.trim().length < 3}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neon-green/90 px-4 py-2 text-sm font-medium text-black hover:bg-neon-green disabled:opacity-40"
              >
                {utworz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Dodaj
              </button>
            </div>
            {blad && <p className="mt-2 text-xs text-red-400">{blad}</p>}
            <p className="mt-2 text-xs text-text-muted">
              Nowy alert pilnuje tego, co dopiero się pojawi — nie przeszukuje archiwum.
            </p>
          </form>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : (alerty?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">Nie masz jeszcze żadnych alertów.</p>
        ) : (
          <ul className="space-y-2">
            {alerty!.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${a.isActive ? 'text-text-primary' : 'text-text-muted line-through'}`}>
                    {a.phrase}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {ZAKRESY.find((z) => z.value === a.scope)?.label}
                    {a.hitCount > 0 && ` · ${a.hitCount} trafień`}
                  </p>
                </div>
                <button
                  onClick={() => przelacz.mutate(a.id)}
                  title={a.isActive ? 'Wstrzymaj' : 'Wznów'}
                  className={`rounded-lg p-1.5 ${a.isActive ? 'text-neon-green hover:bg-white/5' : 'text-text-muted hover:bg-white/5'}`}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => usun.mutate(a.id)}
                  title="Usuń"
                  className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
