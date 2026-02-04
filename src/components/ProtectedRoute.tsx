import { ReactNode } from "react";
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

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isWelcomeRoute = location.pathname === "/welcome";

  // Cache onboarding status so navigating between pages doesn't show a full-screen loader.
  const onboardingQuery = useQuery({
    queryKey: ["profile-onboarding", user?.id],
    enabled: !!user && !loading && !isWelcomeRoute,
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

      // Only return false if explicitly false in the database
      return { has_onboarded: profile?.has_onboarded ?? true };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1, // Allow one retry for transient errors
  });

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
  if (!isWelcomeRoute && onboardingQuery.isLoading) {
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
  // Default to NOT redirecting if data is missing/errored to prevent flash
  const needsOnboarding = onboardingQuery.isSuccess && onboardingQuery.data?.has_onboarded === false;

  if (!isWelcomeRoute && needsOnboarding) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};
