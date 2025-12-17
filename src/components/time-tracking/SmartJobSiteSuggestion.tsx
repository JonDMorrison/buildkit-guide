import { useMemo } from 'react';
import { Sparkles, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecentTimeEntries } from '@/hooks/useRecentTimeEntries';

interface JobSite {
  id: string;
  name: string;
}

interface SmartJobSiteSuggestionProps {
  jobSites: JobSite[];
  onSelect: (jobSiteId: string) => void;
}

export function SmartJobSiteSuggestion({ jobSites, onSelect }: SmartJobSiteSuggestionProps) {
  const { data: recentEntries = [] } = useRecentTimeEntries();

  const suggestedSite = useMemo(() => {
    if (jobSites.length <= 1) return null;
    if (recentEntries.length === 0) return null;

    // Count job site usage from recent entries
    const siteUsage = new Map<string, { count: number; lastUsed: Date }>();
    
    recentEntries.forEach(entry => {
      if (entry.job_site_id) {
        const existing = siteUsage.get(entry.job_site_id);
        const entryDate = new Date(entry.check_in_at);
        
        if (existing) {
          existing.count++;
          if (entryDate > existing.lastUsed) {
            existing.lastUsed = entryDate;
          }
        } else {
          siteUsage.set(entry.job_site_id, { count: 1, lastUsed: entryDate });
        }
      }
    });

    if (siteUsage.size === 0) return null;

    // Find most frequently used site in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let bestSiteId: string | null = null;
    let bestScore = 0;

    siteUsage.forEach((usage, siteId) => {
      // Score = frequency * recency bonus
      const recencyBonus = usage.lastUsed > weekAgo ? 2 : 1;
      const score = usage.count * recencyBonus;
      
      if (score > bestScore) {
        bestScore = score;
        bestSiteId = siteId;
      }
    });

    if (!bestSiteId) return null;

    const site = jobSites.find(s => s.id === bestSiteId);
    if (!site) return null;

    const usage = siteUsage.get(bestSiteId);
    const daysSinceLastUse = usage 
      ? Math.floor((Date.now() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...site,
      reason: daysSinceLastUse === 0 
        ? 'Used today' 
        : daysSinceLastUse === 1 
          ? 'Used yesterday'
          : `Used ${daysSinceLastUse} days ago`,
    };
  }, [jobSites, recentEntries]);

  if (!suggestedSite) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Suggested</span>
        <Badge variant="secondary" className="text-xs">
          {suggestedSite.reason}
        </Badge>
      </div>
      
      <Button
        variant="outline"
        className="w-full justify-start gap-2 border-primary/30 hover:bg-primary/10"
        onClick={() => onSelect(suggestedSite.id)}
      >
        <MapPin className="h-4 w-4 text-primary" />
        <span className="truncate">{suggestedSite.name}</span>
      </Button>
    </div>
  );
}
