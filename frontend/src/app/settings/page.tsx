'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, KeyRound, User as UserIcon, Upload, Camera, Link2, Unlink, Lock } from 'lucide-react';
import Link from 'next/link';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { usePremium, useProWidoczne } from '@/lib/queries/premium';
import { WygladNicku } from '@/components/settings/wyglad-nicku';

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    }>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const t = useTranslations('settings');
  const tp = useTranslations('password');
  const ta = useTranslations('auth');
  const { user, token, updateUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');

  // Rozszerzony profil — pola UNDERNET PRO.
  const { data: premium } = usePremium();
  const proWidoczne = useProWidoczne();
  const profilPlatny = premium?.gated.includes('advanced-profile') ?? false;
  const profilDostepny = !profilPlatny || (premium?.isPro ?? false);
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [nameColor, setNameColor] = useState(user?.nameColor || '');
  const [nameStyle, setNameStyle] = useState(user?.nameStyle || 'none');
  const [avatarRing, setAvatarRing] = useState(user?.avatarRing || 'none');

  /*
   * Wczytanie profilu do formularza.
   *
   * `useState(user?.…)` policzyło się przy PIERWSZYM renderze, a wtedy
   * `user` jest jeszcze `null` — kontekst dopiero pobiera konto. Bez tego
   * synchronizowania wszystkie pola startowały puste, a „Zapisz profil"
   * wysyłał je jako zmienione i KASOWAŁ nazwę wyświetlaną, opis, odnośnik
   * i ozdoby. Zależność po `user?.id`, żeby nie nadpisywać tego, co ktoś
   * właśnie wpisuje.
   */
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAvatarUrl(user.avatarUrl || '');
    setAvatarPreview(user.avatarUrl || '');
    setBio(user.bio || '');
    setWebsite(user.website || '');
    setLocation(user.location || '');
    setNameColor(user.nameColor || '');
    setNameStyle(user.nameStyle || 'none');
    setAvatarRing(user.avatarRing || 'none');
  }, [user?.id]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Connected platforms
  /*
   * Kształt odpowiedzi zmienił się razem z przepisaniem logowania:
   * backend zwraca teraz listę { provider, connected, configured },
   * bo front musi odróżnić „niepodłączone" od „dostawca nieskonfigurowany".
   */
  const [platforms, setPlatforms] = useState<
    { provider: string; connected: boolean; configured: boolean }[]
  >([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [platformMsg, setPlatformMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!token) return;
    api.get('/oauth/platforms/connected')
      .then(({ data }) => setPlatforms(data))
      .catch(() => {})
      .finally(() => setPlatformsLoading(false));
  }, [token]);

  // Check for ?linked= param from OAuth callback
  useEffect(() => {
    const linked = searchParams.get('linked');
    if (linked) {
      setPlatformMsg({ type: 'success', text: t('connectedWith', { platform: linked }) });
      // Refresh platforms
      api.get('/oauth/platforms/connected')
        .then(({ data }) => setPlatforms(data))
        .catch(() => {});
    }
  }, [searchParams]);

  const handleUnlink = async (platform: string) => {
    setUnlinking(platform);
    setPlatformMsg(null);
    try {
      await api.delete(`/oauth/${platform}`);
      setPlatforms((prev) => prev.map((p) => (p.provider === platform ? { ...p, connected: false } : p)));
      setPlatformMsg({ type: 'success', text: t('disconnected', { platform }) });
    } catch (err: any) {
      setPlatformMsg({ type: 'error', text: err.response?.data?.message || t('disconnectFailed') });
    }
    setUnlinking(null);
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!token || !user) {
    router.push('/login');
    return null;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/uploads/avatars', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.url);
      setAvatarPreview(data.url);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('uploadError') });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, string> = {};
      if (displayName !== (user.displayName || '')) body.displayName = displayName;
      if (avatarUrl !== (user.avatarUrl || '')) body.avatarUrl = avatarUrl;

      // Pola PRO odsyłamy TYLKO, gdy naprawdę się zmieniły — inaczej sama
      // zmiana nazwy odbijałaby się od płatnej ściany.
      if (profilDostepny) {
        if (bio !== (user.bio || '')) body.bio = bio;
        if (website !== (user.website || '')) body.website = website;
        if (location !== (user.location || '')) body.location = location;
        if (nameColor !== (user.nameColor || '')) body.nameColor = nameColor;
        if (nameStyle !== (user.nameStyle || 'none')) body.nameStyle = nameStyle;
        if (avatarRing !== (user.avatarRing || 'none')) body.avatarRing = avatarRing;
      }

      if (Object.keys(body).length === 0) {
        setMessage({ type: 'error', text: t('noChanges') });
        setSaving(false);
        return;
      }

      const { data } = await api.patch('/users/me', body);
      updateUser(data);
      setMessage({ type: 'success', text: t('profileUpdated') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('genericError') });
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 8) {
      setPwMessage({ type: 'error', text: t('newPasswordMinLength') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: t('passwordsMismatch') });
      return;
    }

    setSavingPw(true);
    try {
      await api.patch('/users/me', { currentPassword, newPassword });
      setPwMessage({ type: 'success', text: t('passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMessage({ type: 'error', text: err.response?.data?.message || t('genericError') });
    }
    setSavingPw(false);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-display font-bold text-text-primary">{t('title')}</h1>
        </div>

        {/* Profile section */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleProfileSave}
          className="card-neon p-6 space-y-5"
        >
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <UserIcon className="w-4 h-4 text-neon-cyan" />
            {t('profile')}
          </div>

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar
                src={avatarPreview || null}
                name={displayName || user.username}
                size="lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="text-sm text-text-muted">
              <p className="font-medium text-text-primary">@{user.username}</p>
              <p>{user.email}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-1 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                {uploading ? t('uploading') : t('changeAvatar')}
              </button>
            </div>
          </div>

          <Input
            label={t('displayName')}
            placeholder={t('namePlaceholder')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <div className="space-y-4 border-t border-white/10 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              Rozszerzony profil
              {!profilDostepny && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-normal text-amber-400">
                  <Lock className="h-3 w-3" /> UNDERNET PRO
                </span>
              )}
            </div>

            {!profilDostepny ? (
              <p className="text-sm text-text-secondary">
                Opis, odnośnik i lokalizacja w profilu są częścią{' '}
                {proWidoczne ? (
                  <Link href="/pro" className="text-neon-green hover:underline">UNDERNET PRO</Link>
                ) : (
                  <span className="text-neon-green">UNDERNET PRO</span>
                )}.
                {(user.bio || user.website || user.location) &&
                  ' To, co już wpisałeś, zostaje widoczne — po prostu nie da się tego teraz zmienić.'}
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm text-text-secondary">O mnie</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Czym się zajmujesz, na czym się znasz."
                    className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-green/50 focus:outline-none"
                  />
                  <p className="mt-1 text-right text-xs text-text-muted">{bio.length}/500</p>
                </div>

                <Input
                  label="Strona"
                  placeholder="https://twoja-strona.pl"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />

                <Input
                  label="Lokalizacja"
                  placeholder="Kraków"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </>
            )}
          </div>

          <WygladNicku
            nazwa={displayName || user.username}
            avatarUrl={avatarPreview || null}
            kolor={nameColor}
            styl={nameStyle}
            otoczka={avatarRing}
            dostepne={profilDostepny}
            maPro={Boolean(premium?.isPro)}
            onKolor={setNameColor}
            onStyl={setNameStyle}
            onOtoczka={setAvatarRing}
          />

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-neon-green' : 'text-neon-red'}`}>
              {message.text}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? t('saving') : t('saveProfile')}
            </Button>
          </div>
        </motion.form>

        {/* Connected accounts section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-neon p-6 space-y-5"
        >
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <Link2 className="w-4 h-4 text-neon-green" />
            {t('connectedAccounts')}
          </div>

          {platformMsg && (
            <p className={`text-sm ${platformMsg.type === 'success' ? 'text-neon-green' : 'text-neon-red'}`}>
              {platformMsg.text}
            </p>
          )}

          {platformsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Dostawcy bez kluczy w konfiguracji nie pojawiają się wcale —
                  wiersz „Połącz", który nigdzie nie prowadzi, jest gorszy
                  niż jego brak. */}
              {platforms.filter((x) => x.configured).length === 0 && (
                <p className="text-sm text-text-muted">
                  Logowanie kontem zewnętrznym nie jest w tej chwili włączone.
                </p>
              )}
              {([
                { id: 'discord', name: 'Discord', color: '#5865F2' },
                { id: 'google', name: 'Google', color: '#4285F4' },
                { id: 'github', name: 'GitHub', color: '#EDEEF3' },
              ] as const)
                .map((p) => ({ ...p, state: platforms.find((x) => x.provider === p.id) }))
                .filter((p) => p.state?.configured)
                .map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-dark-800 border border-border-default">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.state?.connected ? p.color : '#475569' }} />
                    <span className="text-sm font-medium" style={{ color: p.state?.connected ? p.color : undefined }}>
                      {p.name}
                    </span>
                    {p.state?.connected && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green font-medium">
                        {t('connected')}
                      </span>
                    )}
                  </div>
                  {p.state?.connected ? (
                    <button
                      onClick={() => handleUnlink(p.id)}
                      disabled={unlinking === p.id}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-red transition-colors disabled:opacity-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      {unlinking === p.id ? t('disconnecting') : t('disconnect')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        window.location.href = `/api/oauth/${p.id}?action=link&token=${token}`;
                      }}
                      className="flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {t('connect')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Password section */}
        <motion.form
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handlePasswordChange}
          className="card-neon p-6 space-y-5"
        >
          <div className="flex items-center gap-2 text-text-primary font-semibold">
            <KeyRound className="w-4 h-4 text-neon-purple" />
            {t('changePassword')}
          </div>

          <Input
            label={t('currentPassword')}
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label={t('newPassword')}
            type="password"
            placeholder={ta('minChars')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label={t('confirmPassword')}
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {pwMessage && (
            <p className={`text-sm ${pwMessage.type === 'success' ? 'text-neon-green' : 'text-neon-red'}`}>
              {pwMessage.text}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={savingPw}>
              <KeyRound className="w-4 h-4" /> {savingPw ? tp('changing') : tp('changePassword')}
            </Button>
          </div>
        </motion.form>
      </div>
    </AppLayout>
  );
}
