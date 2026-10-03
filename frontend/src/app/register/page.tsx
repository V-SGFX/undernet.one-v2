'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Zap, UserPlus, Mail } from 'lucide-react';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { AuthDivider } from '@/components/auth-divider';
import { useTranslations } from 'next-intl';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  /** Czy list potwierdzający faktycznie wyszedł — backend mówi to wprost. */
  const [mailSent, setMailSent] = useState(true);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState('');
  const t = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, username, password });
      /*
       * Ekran „sprawdź skrzynkę" pokazywał się ZAWSZE — także wtedy, gdy
       * poczta leżała i żaden list nie miał prawa dotrzeć. Backend mówi
       * teraz wprost, czy wyszedł.
       */
      setMailSent(data?.mailSent !== false);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('registerFailed'));
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <div className="flex-1 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-neon-cyan/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-sm mx-4"
        >
          <div className="card-neon p-8 space-y-6">
            {success ? (
              <div className="text-center space-y-4">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${mailSent ? 'bg-neon-purple/10' : 'bg-amber-500/10'}`}>
                  <Mail className={`w-8 h-8 ${mailSent ? 'text-neon-cyan' : 'text-amber-400'}`} />
                </div>

                {mailSent ? (
                  <>
                    <h1 className="text-2xl font-display font-bold text-text-primary">{t('checkEmail')}</h1>
                    <p className="text-text-muted">{t('verificationSent', { email })}</p>
                    <p className="text-sm text-text-dimmed">{t('checkSpam')}</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-display font-bold text-text-primary">Konto założone</h1>
                    <p className="text-text-muted">
                      Nie udało się jednak wysłać listu potwierdzającego na <strong>{email}</strong>.
                      Bez potwierdzenia nie da się zalogować — spróbuj wysłać go ponownie.
                    </p>
                  </>
                )}

                {/*
                  Wysłanie linku ponownie.

                  Bez tego konto z niedoręczonym listem było martwe: adres
                  i nazwa już zajęte, a zalogować się nie sposób.
                */}
                <button
                  type="button"
                  disabled={resendState === 'sending' || resendState === 'sent'}
                  onClick={async () => {
                    setResendState('sending');
                    setResendError('');
                    try {
                      await api.post('/auth/resend-verification', { email });
                      setResendState('sent');
                    } catch (e: any) {
                      setResendError(e?.response?.data?.message ?? 'Nie udało się wysłać listu.');
                      setResendState('error');
                    }
                  }}
                  className="w-full rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                >
                  {resendState === 'sending' ? 'Wysyłam…'
                    : resendState === 'sent' ? 'Wysłane — sprawdź skrzynkę'
                    : 'Wyślij link ponownie'}
                </button>
                {resendState === 'error' && (
                  <p className="text-sm text-neon-red">{resendError}</p>
                )}

                <Link href="/login" className="block text-neon-purple hover:text-neon-cyan transition-colors font-medium text-sm">
                  {t('backToLogin')}
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-neon-cyan/10 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-neon-cyan" />
                  </div>
                  <h1 className="text-2xl font-display font-bold text-text-primary">{t('registerTab')}</h1>
                  <p className="text-sm text-text-muted">{t('joinCommunity')}</p>
                </div>

                <SocialLoginButtons label="register" />
            <AuthDivider label={t('or')} />

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="text-sm text-neon-red text-center bg-neon-red/5 border border-neon-red/20 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}
                  <Input
                    label={t('email')}
                    type="email"
                    placeholder="jan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    label={t('username')}
                    type="text"
                    placeholder="twoja_nazwa"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <Input
                    label={t('password')}
                    type="password"
                    placeholder={t('minChars')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    size="lg"
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading ? t('registering') : t('register')}
                  </Button>
                </form>

                <p className="text-center text-sm text-text-muted">
                  {t('hasAccount')}{' '}
                  <Link href="/login" className="text-neon-purple hover:text-neon-cyan transition-colors font-medium">
                    {t('login')}
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
