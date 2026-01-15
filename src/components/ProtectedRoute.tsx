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
    queryFn: async (): Promise<OnboardingProfile | null> => {
      if (!user) return null;
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("has_onboarded")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error checking onboarding status:", error);
          return null;
        }

        return { has_onboarded: !!profile?.has_onboarded };
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        return null;
      }
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0,
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
  if (!isWelcomeRoute && onboardingQuery.isLoading && !onboardingQuery.data) {
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

  const needsOnboarding = onboardingQuery.data?.has_onboarded === false;

  if (!isWelcomeRoute && needsOnboarding) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
};
