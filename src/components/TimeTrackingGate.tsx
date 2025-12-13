import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTimeTrackingEnabled } from '@/hooks/useTimeTrackingEnabled';
import { Loader2 } from 'lucide-react';

interface TimeTrackingGateProps {
  children: ReactNode;
}

/**
 * Route guard component that only renders children if time tracking is enabled
 * Redirects to a "not enabled" page otherwise
 */
export const TimeTrackingGate = ({ children }: TimeTrackingGateProps) => {
  const { enabled, loading } = useTimeTrackingEnabled();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enabled) {
    return <Navigate to="/time-tracking-not-enabled" replace />;
  }

  return <>{children}</>;
};
