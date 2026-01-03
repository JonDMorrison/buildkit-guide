import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from './ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setCheckingOnboarding(false);
      return;
    }

    // Skip onboarding check if already on welcome page
    if (location.pathname === '/welcome') {
      setCheckingOnboarding(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_onboarded')
          .eq('id', user.id)
          .single();

        if (profile && profile.has_onboarded === false) {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user, loading, location.pathname]);

  if (loading || checkingOnboarding) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};