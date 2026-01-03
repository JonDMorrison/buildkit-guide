import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import WelcomeWizard from '@/components/onboarding/WelcomeWizard';
import { Loader2 } from 'lucide-react';

export default function Welcome() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_onboarded')
        .eq('id', user!.id)
        .single();

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
