import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

interface OrganizationContextType {
  organizations: Organization[];
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  setActiveOrganizationId: (id: string) => void;
  loading: boolean;
  isOrgAdmin: boolean;
  orgRole: string | null;
  requiresOrgSelection: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// Default organization ID for single-org installs
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setOrganizations([]);
      setActiveOrganizationIdState(null);
      setOrgRole(null);
      setLoading(false);
      return;
    }

    const fetchOrganizations = async () => {
      try {
        // Fetch memberships with organization data
        const { data: memberships, error } = await supabase
          .from('organization_memberships')
          .select(`
            organization_id,
            role,
            is_active,
            organizations (
              id,
              name,
              slug
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        const orgs = memberships
          ?.filter(m => m.organizations)
          .map(m => ({
            id: (m.organizations as any).id,
            name: (m.organizations as any).name,
            slug: (m.organizations as any).slug,
          })) || [];

        setOrganizations(orgs);

        // Auto-select organization
        if (orgs.length === 1) {
          setActiveOrganizationIdState(orgs[0].id);
          const membership = memberships?.find(m => (m.organizations as any)?.id === orgs[0].id);
          setOrgRole(membership?.role || null);
        } else if (orgs.length > 1) {
          // Check for stored preference
          const stored = localStorage.getItem('activeOrganizationId');
          if (stored && orgs.some(o => o.id === stored)) {
            setActiveOrganizationIdState(stored);
            const membership = memberships?.find(m => (m.organizations as any)?.id === stored);
            setOrgRole(membership?.role || null);
          } else {
            // Default to first org
            setActiveOrganizationIdState(orgs[0].id);
            const membership = memberships?.find(m => (m.organizations as any)?.id === orgs[0].id);
            setOrgRole(membership?.role || null);
          }
        } else {
          // Fallback to default org for users without memberships
          setActiveOrganizationIdState(DEFAULT_ORG_ID);
          setOrgRole(null);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
        // Fallback to default org
        setActiveOrganizationIdState(DEFAULT_ORG_ID);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [user]);

  const setActiveOrganizationId = useCallback((id: string) => {
    setActiveOrganizationIdState(id);
    localStorage.setItem('activeOrganizationId', id);
    
    // Update role for new org
    const fetchRole = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('organization_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', id)
        .eq('is_active', true)
        .single();
      setOrgRole(data?.role || null);
    };
    fetchRole();
  }, [user]);

  // Memoize derived values
  const activeOrganization = useMemo(
    () => organizations.find(o => o.id === activeOrganizationId) || null,
    [organizations, activeOrganizationId]
  );
  
  const isOrgAdmin = orgRole === 'admin';
  const requiresOrgSelection = !loading && organizations.length > 1 && !activeOrganizationId;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<OrganizationContextType>(
    () => ({
      organizations,
      activeOrganizationId,
      activeOrganization,
      setActiveOrganizationId,
      loading,
      isOrgAdmin,
      orgRole,
      requiresOrgSelection,
    }),
    [
      organizations,
      activeOrganizationId,
      activeOrganization,
      setActiveOrganizationId,
      loading,
      isOrgAdmin,
      orgRole,
      requiresOrgSelection,
    ]
  );

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
