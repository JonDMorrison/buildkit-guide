import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import WelcomeWizard from '@/components/onboarding/WelcomeWizard';
import { Loader2 } from 'lucide-react';

// Matches the localStorage key used by ProtectedRoute
const ONBOARDING_CACHE_KEY = 'pp_onboarded';

export default function Welcome() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    checkOnboardingStatus();
  }, [user, authLoading]);

  const checkOnboardingStatus = async () => {
    // 1. Check React Query cache first — ProtectedRoute may have already fetched
    //    this when the user hit a protected route (e.g. /executive) before being
    //    redirected here. Avoids a redundant network round-trip.
    const cached = queryClient.getQueryData<{ has_onboarded: boolean }>(
      ['profile-onboarding', user!.id]
    );
    if (cached !== undefined) {
      if (cached.has_onboarded) {
        navigate('/dashboard');
      } else {
        setChecking(false);
      }
      return;
    }

    // 2. No cache — fall back to a fresh fetch
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('has_onboarded')
        .eq('id', user!.id)
        .single();

      if (error) {
        console.error('Error checking onboarding status:', error);
        setChecking(false);
        return;
      }

      if (profile?.has_onboarded) {
        navigate('/dashboard');
        return;
      }

      setChecking(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setChecking(false);
    }
  };

  const handleComplete = async () => {
    try {
      await supabase
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', user!.id);

      // Update both caches so ProtectedRoute sees the new state immediately
      // and doesn't redirect back to /welcome when landing on /dashboard.
      localStorage.setItem(`${ONBOARDING_CACHE_KEY}_${user!.id}`, 'true');
      queryClient.setQueryData(['profile-onboarding', user!.id], { has_onboarded: true });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      navigate('/dashboard');
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return <WelcomeWizard onComplete={handleComplete} />;
}
