import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/hooks/useOrganization';

/**
 * Ensures strict multi-tenant isolation by:
 * 1. Clearing query cache when org changes
 * 2. Clearing project context from URL when switching orgs
 * 3. Preventing cross-tenant data leaks during transition
 */
export function TenantIsolationGuardian() {
  const { activeOrganizationId, loading } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const lastOrgId = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    // Reset loop: Org changed
    if (activeOrganizationId && lastOrgId.current && activeOrganizationId !== lastOrgId.current) {
      console.log('Tenant switch detected, purging stale cache and context...');
      
      // 1. Purge all cached queries to ensure no cross-client data leak
      queryClient.removeQueries();
      
      // 2. Clear projectId from URL if present
      if (searchParams.has('projectId')) {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('projectId');
          return next;
        });
      }

      // 3. Force navigate to dashboard to start clean in new tenant
      // (This prevents users from being on a project-specific URL for wrong org)
      if (window.location.pathname.startsWith('/projects/')) {
        navigate('/dashboard', { replace: true });
      }
    }

    lastOrgId.current = activeOrganizationId;
  }, [activeOrganizationId, loading, queryClient, searchParams, setSearchParams, navigate]);

  return null;
}
