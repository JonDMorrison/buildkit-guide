import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Track if this is the initial session check
    let isInitialLoad = true;
    
    // Helper to process pending invitations for a session
    const processPendingInvites = async (session: Session) => {
      try {
        const { data, error } = await supabase.functions.invoke('process-pending-invites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (error) {
          console.error('Failed to process pending invites:', error);
        } else if (data?.processed > 0) {
          console.log(`Processed ${data.processed} pending invitation(s)`);
        }
      } catch (err) {
        console.error('Error processing pending invites:', err);
      }
    };
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Process pending invitations on sign-in or sign-up
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
          // Use setTimeout to avoid blocking the auth flow
          setTimeout(() => processPendingInvites(session), 0);
        }
        
        // Only redirect on actual sign-in events (not session refresh/token refresh)
        // and only if not during initial load (to preserve current route)
        if (event === 'SIGNED_IN' && session && !isInitialLoad) {
          // Role-based home route is resolved after mount via useDefaultHomeRoute.
          // Navigate to /dashboard as a safe default; ProtectedRoute + the
          // consuming component will redirect to the correct role home.
          navigate('/dashboard');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // After initial load, allow future sign-in redirects
      isInitialLoad = false;
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    // If signup succeeded, send trial notification email (fire and forget)
    if (!error) {
      supabase.functions.invoke('notify-trial-signup', {
        body: { 
          fullName, 
          email,
          company: undefined // Company not collected during signup currently
        }
      }).catch(err => console.error('Failed to send trial notification:', err));
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};