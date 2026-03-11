import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const queryPromise = supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Role query timeout')), 5000);
  });

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const { data, error } = result as Awaited<typeof queryPromise>;
    if (error) {
      console.error('Erro ao carregar papel do usuário:', error.message);
      return false;
    }
    return data?.some(r => r.role === 'admin') ?? false;
  } catch (err) {
    console.error('Erro/timeout ao carregar papel do usuário:', err);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const admin = await fetchIsAdmin(nextUser.id);
      if (!mounted) return;

      setIsAdmin(admin);
      setLoading(false);
    };

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);
      } catch (err) {
        console.error('Erro ao inicializar autenticação:', err);
        if (mounted) {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setLoading(true);
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
