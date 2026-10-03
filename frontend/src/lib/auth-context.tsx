'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (loginStr: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

/*
 * Klucze sesji.
 *
 * Do niedawna nazywały się xdtv_token i xdtv_user — undernet stoi na
 * szkielecie xdtv i przyniósł je ze sobą. Nazwa magazynu jest widoczna
 * w narzędziach przeglądarki i w polityce prywatności, więc obca marka
 * w kluczu to nie kosmetyka.
 *
 * Sesje spod starych kluczy przenosimy raz przy starcie, żeby zmiana
 * nikogo nie wylogowała.
 */
export const TOKEN_KEY = 'undernet_token';
export const USER_KEY = 'undernet_user';

function migrateLegacyKeys() {
  if (typeof window === 'undefined') return;
  try {
    for (const [old, next] of [['xdtv_token', TOKEN_KEY], ['xdtv_user', USER_KEY]] as const) {
      const value = localStorage.getItem(old);
      if (value !== null && localStorage.getItem(next) === null) localStorage.setItem(next, value);
      if (value !== null) localStorage.removeItem(old);
    }
  } catch {
    // Tryb prywatny albo zablokowane dane witryny — sesja po prostu nie przetrwa.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    migrateLegacyKeys();
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Revalidate token and refresh user data from server
      api.get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
        .then(({ data }) => {
          setUser(data);
          localStorage.setItem(USER_KEY, JSON.stringify(data));
        })
        .catch(() => {
          // Token invalid/expired — log out
          setToken(null);
          setUser(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (loginStr: string, password: string) => {
    const { data } = await api.post('/auth/login', { login: loginStr, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  const register = async (email: string, username: string, password: string) => {
    const { data } = await api.post('/auth/register', { email, username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  };

  /**
   * Adopt a token issued by the OAuth callback.
   *
   * Stable identity via useCallback: the auth callback page runs this from an
   * effect that lists it as a dependency, and a fresh function each render
   * made that effect re-fire on every state change — re-requesting the profile
   * in a loop while the page was trying to settle.
   *
   * The profile is fetched before anything is committed, so a failure leaves
   * no half-signed-in state behind.
   */
  const loginWithToken = useCallback(async (oauthToken: string) => {
    const { data } = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
    localStorage.setItem(TOKEN_KEY, oauthToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data));
    setToken(oauthToken);
    setUser(data);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
