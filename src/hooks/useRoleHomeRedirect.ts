import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDefaultHomeRoute } from '@/hooks/useDefaultHomeRoute';

/**
 * Renders on /dashboard. If the user's role-appropriate home is NOT /dashboard,
 * silently redirects them to the correct route.
 * This handles the post-auth landing for workers/accounting/admin roles.
 */
export function useRoleHomeRedirect() {
  const { homeRoute, loading } = useDefaultHomeRoute();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (homeRoute !== '/dashboard') {
      navigate(homeRoute, { replace: true });
    }
  }, [loading, homeRoute, navigate]);
}
