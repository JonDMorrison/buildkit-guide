import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "./ui/skeleton";

interface ProtectedRouteProps {
  children: ReactNode;
}

type OnboardingProfile = {
  has_onboarded: boolean;
};

const ONBOARDING_CACHE_KEY = "pp_onboarded";

// Get cached onboarding status from localStorage
const getCachedOnboarding = (userId: string): boolean | null => {
  try {
    const cached = localStorage.getItem(`${ONBOARDING_CACHE_KEY}_${userId}`);
    if (cached === "true") return true;
    if (cached === "false") return false;
    return null;
  } catch {
    return null;
  }
};

// Cache onboarding status to localStorage
const setCachedOnboarding = (userId: string, value: boolean) => {
  try {
    localStorage.setItem(`${ONBOARDING_CACHE_KEY}_${userId}`, String(value));
  } catch {
    // Ignore storage errors
  }
};

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isWelcomeRoute = location.pathname === "/welcome";
  
  // Check localStorage for cached onboarding status
  const cachedOnboarding = user ? getCachedOnboarding(user.id) : null;

  // Cache onboarding status so navigating between pages doesn't show a full-screen loader.
  const onboardingQuery = useQuery({
    queryKey: ["profile-onboarding", user?.id],
    enabled: !!user && !loading && !isWelcomeRoute && cachedOnboarding !== true,
    queryFn: async (): Promise<OnboardingProfile> => {
      if (!user) {
        // No user means we can't check, default to onboarded to prevent redirect loop
        return { has_onboarded: true };
      }
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("has_onboarded")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error checking onboarding status:", error);
        // On error, default to onboarded to prevent redirect loop
        return { has_onboarded: true };
      }

      const hasOnboarded = profile?.has_onboarded ?? true;
      
      // Cache the result
      setCachedOnboarding(user.id, hasOnboarded);
      
      return { has_onboarded: hasOnboarded };
    },
    staleTime: Infinity, // Never consider stale - we're caching in localStorage
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Update cache when query succeeds
  useEffect(() => {
    if (user && onboardingQuery.isSuccess && onboardingQuery.data) {
      setCachedOnboarding(user.id, onboardingQuery.data.has_onboarded);
    }
  }, [user, onboardingQuery.isSuccess, onboardingQuery.data]);

  if (loading) {
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

  // Skip onboarding check if already on welcome page
  // If we have a cached value showing onboarded, skip the loading state entirely
  if (cachedOnboarding === true) {
    // User is cached as onboarded, render immediately
    return <>{children}</>;
  }

  // Only show skeleton if we have no cached data AND query hasn't settled
  const isQuerySettled = onboardingQuery.isSuccess || onboardingQuery.isError;
  if (!isWelcomeRoute && !isQuerySettled && cachedOnboarding === null) {
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

  // Only redirect to welcome if we have confirmed data showing user hasn't onboarded
  // AND no cached value showing they're onboarded
  const needsOnboarding = 
    cachedOnboarding === false || 
    (onboardingQuery.isSuccess && onboardingQuery.data?.has_onboarded === false);

  if (!isWelcomeRoute && needsOnboarding) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};
