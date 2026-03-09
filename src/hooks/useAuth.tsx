import { AuthError, Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { getDefaultHomeRoute, RoleContext } from '@/utils/getDefaultHomeRoute';

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

    // Fetch role context directly from DB (no hooks) for immediate routing
    const fetchRoleContext = async (userId: string): Promise<RoleContext> => {
      const [userRolesRes, projectRolesRes, orgMemberRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('project_members').select('role').eq('user_id', userId),
        supabase.from('organization_memberships').select('role').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
      ]);

      const globalRoles = (userRolesRes.data || []).map(r => r.role);
      const isAdmin = globalRoles.includes('admin');
      const projectRoles = (projectRolesRes.data || []).map(r => ({ role: r.role }));
      const orgRole = orgMemberRes.data?.role ?? null;

      return { isAdmin, orgRole, globalRoles, projectRoles };
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
          try {
            const roleCtx = await fetchRoleContext(session.user.id);
            const homeRoute = getDefaultHomeRoute(roleCtx);
            navigate(homeRoute);
          } catch (err) {
            console.error('Failed to resolve home route, falling back to /dashboard', err);
            navigate('/dashboard');
          }
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