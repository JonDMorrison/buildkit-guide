import { useLocation, useNavigate } from 'react-router-dom';
import { parseHealthContext, stripHealthContext } from '@/lib/healthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, Activity } from 'lucide-react';

/**
 * Compact, dismissible banner shown on destination pages
 * when the user arrived via Health Check (?from=health).
 * No backend calls. Pure URL-driven.
 */
export function HealthContextBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = parseHealthContext(location.search);

  if (!ctx.active) return null;

  const handleDismiss = () => {
    const cleaned = stripHealthContext(location.search);
    navigate(`${location.pathname}${cleaned}`, { replace: true });
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 mb-4">
      <Activity className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">From Health Check</p>
        {ctx.label && (
          <p className="text-xs text-muted-foreground truncate">Fixing: {ctx.label}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate('/health')}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Health
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
