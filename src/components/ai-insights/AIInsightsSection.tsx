import { DashboardSection } from '@/components/dashboard/shared/DashboardSection';
import { DashboardGrid } from '@/components/dashboard/shared/DashboardGrid';
import { AIChangeFeedCard } from './AIChangeFeedCard';
import { AIProjectRiskCard } from './AIProjectRiskCard';
import { AIMarginSignalCard } from './AIMarginSignalCard';

interface Props {
  /** Show org-level change feed (executive / dashboard) */
  showChangeFeed?: boolean;
  /** Show project-level risk + margin (dashboard / project pages) */
  projectId?: string | null;
}

/**
 * Reusable AI Insights section.
 * - Executive page: showChangeFeed only (no project context)
 * - Dashboard: showChangeFeed + project cards
 * - Project page: project cards only
 */
export function AIInsightsSection({ showChangeFeed, projectId }: Props) {
  const hasProjectCards = !!projectId;
  const columns = showChangeFeed && hasProjectCards ? 3 : showChangeFeed ? 1 : 2;

  return (
    <DashboardSection title="Insights" helpText="AI-generated analysis comparing your latest economic snapshots. Shows which projects changed, risk levels, and margin trends." lazy skeletonHeight="h-48" skeletonCount={columns}>
      <DashboardGrid columns={columns} className={columns === 1 ? 'grid-cols-1' : undefined}>
        {showChangeFeed && <AIChangeFeedCard />}
        {hasProjectCards && <AIProjectRiskCard projectId={projectId} />}
        {hasProjectCards && <AIMarginSignalCard projectId={projectId} />}
      </DashboardGrid>
    </DashboardSection>
  );
}
