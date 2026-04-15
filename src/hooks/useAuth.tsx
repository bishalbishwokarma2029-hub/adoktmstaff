import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'admin' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  createStaffAccount: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await (supabase as any).from('user_roles').select('role').eq('user_id', userId).single();
    if (data) setRole(data.role as AppRole);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        return;
      }
      if (sess?.user) {
        setUser(sess.user);
        setSession(sess);
        // Defer role fetch to avoid deadlock
        setTimeout(() => fetchRole(sess.user.id), 0);
      }
      setLoading(false);
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (sess?.user) {
        setUser(sess.user);
        setSession(sess);
        fetchRole(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const createStaffAccount = async (email: string, password: string, displayName: string) => {
    // Admin creates staff via edge function
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: { email, password, display_name: displayName },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{
      user, session, role,
      isAdmin: role === 'admin',
      loading,
      signIn, signOut, createStaffAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
