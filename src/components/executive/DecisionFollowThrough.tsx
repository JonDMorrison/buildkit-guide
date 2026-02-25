/**
 * DecisionFollowThrough
 *
 * Compares a saved decision note's top-3 projects against the current
 * attention feed to show whether each flagged project is still requiring
 * attention or has cleared.
 *
 * No new queries — all data is passed in from already-loaded hooks.
 * Deterministic: preserves noteTop3Projects order as rendered.
 */

import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────

export type FollowThroughStatus = 'still_attention' | 'cleared';

export interface FollowThroughItem {
  projectName: string;
  status: FollowThroughStatus;
}

export interface DecisionFollowThroughProps {
  noteAsOf: string;
  noteTop3Projects: string[];
  currentAsOf: string;
  currentAttentionByName: Set<string>;
  onScrollToProject?: (projectName: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateCompact(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Derive follow-through items from note's top3 and current attention set.
 * Exported for testing.
 */
export function deriveFollowThroughItems(
  noteTop3Projects: string[],
  currentAttentionByName: Set<string>,
): FollowThroughItem[] {
  return noteTop3Projects.map((projectName) => ({
    projectName,
    status: currentAttentionByName.has(projectName) ? 'still_attention' : 'cleared',
  }));
}

// ── Component ──────────────────────────────────────────────────────────────

export function DecisionFollowThrough({
  noteAsOf,
  noteTop3Projects,
  currentAsOf,
  currentAttentionByName,
  onScrollToProject,
}: DecisionFollowThroughProps) {
  if (noteTop3Projects.length === 0) return null;

  const items = deriveFollowThroughItems(noteTop3Projects, currentAttentionByName);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
      <div>
        <h4 className="text-xs font-semibold text-foreground">Follow-through</h4>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Note as of {formatDateCompact(noteAsOf)} • Current as of {formatDateCompact(currentAsOf)}
        </p>
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.projectName}
            className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs bg-card border border-border/30"
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.status === 'still_attention' ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="font-medium text-foreground truncate">{item.projectName}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  item.status === 'still_attention'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {item.status === 'still_attention' ? 'Still Attention' : 'Cleared'}
              </span>
              {item.status === 'still_attention' && onScrollToProject && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-primary"
                  onClick={() => onScrollToProject(item.projectName)}
                >
                  View in Inbox
                  <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
