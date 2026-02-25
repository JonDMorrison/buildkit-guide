import { useSearchParams, Link, useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { ArrowLeft, ArrowRight, FileSearch, X } from 'lucide-react';

// ── Classification label mapping (matches AttentionInbox) ────────────────

const ISSUE_LABEL: Record<string, string> = {
  new_risks: 'New Risk Detected',
  worsening: 'Worsening Trend',
  burn_increase: 'Labor Burn Increase',
  resolved_risks: 'Risk Resolved',
  improving: 'Improving Trend',
};

function issueLabel(issue: string): string {
  return ISSUE_LABEL[issue] ?? issue.replace(/_/g, ' ');
}

function issueSeverity(issue: string): 'destructive' | 'warning' | 'success' | 'secondary' {
  switch (issue) {
    case 'new_risks':
    case 'worsening':     return 'destructive';
    case 'burn_increase': return 'warning';
    case 'resolved_risks':
    case 'improving':     return 'success';
    default:              return 'secondary';
  }
}

// ── Issue → section anchor mapping ──────────────────────────────────────

const ISSUE_ANCHOR: Record<string, string> = {
  new_risks:      'economic-control',
  worsening:      'economic-control',
  burn_increase:  'economic-control',
  resolved_risks: 'section-stats',
  improving:      'section-stats',
  blockers:       'section-blockers',
  blocked:        'section-blockers',
  deadline:       'section-deadlines',
  data_quality:   'economic-control',
  volatility:     'economic-control',
  labor:          'economic-control',
};

const FALLBACK_ANCHOR = 'economic-control';

// ── Component ───────────────────────────────────────────────────────────

export function ProjectContextBanner() {
  const [searchParams] = useSearchParams();
  const { projectId } = useParams<{ projectId: string }>();
  const { canViewExecutive } = useRouteAccess();
  const [dismissed, setDismissed] = useState(false);
  const scrolledRef = useRef(false);

  const from = searchParams.get('from');
  const issue = searchParams.get('issue');

  // Deterministic one-time scroll to relevant section
  useEffect(() => {
    if (from !== 'attention' || !issue || scrolledRef.current) return;

    const targetId = ISSUE_ANCHOR[issue] ?? FALLBACK_ANCHOR;

    // Wait for DOM to settle after data loads
    const timer = setTimeout(() => {
      if (scrolledRef.current) return;
      // Try the mapped anchor first, fall back to economic-control
      let el = document.getElementById(targetId);
      if (!el && targetId !== FALLBACK_ANCHOR) {
        el = document.getElementById(FALLBACK_ANCHOR);
      }
      if (el) {
        scrolledRef.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-primary/40', 'rounded-lg', 'transition-all');
        setTimeout(() => {
          el!.classList.remove('ring-2', 'ring-primary/40', 'rounded-lg', 'transition-all');
        }, 4000);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [from, issue]);

  // Only render when navigated from attention inbox
  if (from !== 'attention' || !issue || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 mb-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge variant={issueSeverity(issue)} className="text-[11px] shrink-0">
          {issueLabel(issue)}
        </Badge>
        <span className="text-sm text-muted-foreground truncate">
          Opened from Attention Inbox
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const targetId = issue ? (ISSUE_ANCHOR[issue] ?? FALLBACK_ANCHOR) : FALLBACK_ANCHOR;
            const el = document.getElementById(targetId) || document.getElementById(FALLBACK_ANCHOR);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              el.classList.add('ring-2', 'ring-primary/40', 'rounded-lg');
              setTimeout(() => el.classList.remove('ring-2', 'ring-primary/40', 'rounded-lg'), 4000);
            }
          }}
        >
          <FileSearch className="h-3.5 w-3.5 mr-1" />
          Jump to Evidence
        </Button>

        {canViewExecutive && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
            <Link to="/executive">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Executive
            </Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
