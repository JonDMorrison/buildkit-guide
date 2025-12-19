import { useMemo, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  HardHat, 
  ShieldCheck, 
  Eye, 
  Hand, 
  Footprints,
  Ear,
  Wind,
  Zap,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PPERequirement {
  id: string;
  trade_type: string;
  ppe_item: string;
  is_mandatory: boolean;
  description: string | null;
}

interface PPEChecklistSectionProps {
  ppeRequirements: PPERequirement[];
  tradesOnSite: string[];
  checkedItems: Record<string, boolean>;
  onToggleItem: (id: string) => void;
  onSelectAll: () => void;
  onSelectMandatory: () => void;
  loading?: boolean;
}

const getPPEIcon = (item: string) => {
  const lowerItem = item.toLowerCase();
  if (lowerItem.includes('hard hat') || lowerItem.includes('helmet')) return HardHat;
  if (lowerItem.includes('glasses') || lowerItem.includes('face') || lowerItem.includes('eye')) return Eye;
  if (lowerItem.includes('gloves') || lowerItem.includes('hand')) return Hand;
  if (lowerItem.includes('boots') || lowerItem.includes('foot') || lowerItem.includes('knee')) return Footprints;
  if (lowerItem.includes('hearing') || lowerItem.includes('ear')) return Ear;
  if (lowerItem.includes('respirator') || lowerItem.includes('mask') || lowerItem.includes('dust')) return Wind;
  if (lowerItem.includes('insulated') || lowerItem.includes('arc') || lowerItem.includes('voltage')) return Zap;
  if (lowerItem.includes('welding') || lowerItem.includes('leather') || lowerItem.includes('apron')) return Flame;
  if (lowerItem.includes('harness') || lowerItem.includes('lanyard') || lowerItem.includes('fall')) return AlertTriangle;
  return ShieldCheck;
};

export const PPEChecklistSection = ({
  ppeRequirements,
  tradesOnSite,
  checkedItems,
  onToggleItem,
  onSelectAll,
  onSelectMandatory,
  loading = false
}: PPEChecklistSectionProps) => {
  // Memoize derived lists
  const tradesKey = useMemo(
    () => tradesOnSite.map((t) => t.toLowerCase()).sort().join("|"),
    [tradesOnSite]
  );

  const { sortedPPE, mandatoryItems, optionalItems } = useMemo(() => {
    const relevantTrades = ["general", ...(tradesKey ? tradesKey.split("|") : [])];

    const relevantPPE = ppeRequirements.filter((ppe) =>
      relevantTrades.some((trade) => ppe.trade_type.toLowerCase().includes(trade))
    );

    // Deduplicate by ppe_item (keep mandatory if exists)
    const uniquePPE = relevantPPE.reduce((acc, ppe) => {
      const existing = acc.find((p) => p.ppe_item === ppe.ppe_item);
      if (!existing) {
        acc.push(ppe);
      } else if (ppe.is_mandatory && !existing.is_mandatory) {
        const idx = acc.indexOf(existing);
        acc[idx] = ppe;
      }
      return acc;
    }, [] as PPERequirement[]);

    // Sort: mandatory first, then alphabetical
    const sorted = [...uniquePPE].sort((a, b) => {
      if (a.is_mandatory !== b.is_mandatory) return a.is_mandatory ? -1 : 1;
      return a.ppe_item.localeCompare(b.ppe_item);
    });

    return {
      sortedPPE: sorted,
      mandatoryItems: sorted.filter((p) => p.is_mandatory),
      optionalItems: sorted.filter((p) => !p.is_mandatory),
    };
  }, [ppeRequirements, tradesKey]);

  const handleToggle = useCallback((id: string) => {
    onToggleItem(id);
  }, [onToggleItem]);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (sortedPPE.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
        No specific PPE requirements found for today's trades.
      </div>
    );
  }

  const mandatoryCheckedCount = mandatoryItems.filter(p => checkedItems[p.id]).length;
  const compliancePercentage = mandatoryItems.length > 0 
    ? Math.round((mandatoryCheckedCount / mandatoryItems.length) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Compliance Banner */}
      {compliancePercentage < 100 && mandatoryItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              {mandatoryItems.length - mandatoryCheckedCount} mandatory PPE item(s) unchecked
            </p>
            <p className="text-xs text-muted-foreground">
              All required PPE must be verified before proceeding
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectMandatory}
            className="flex-shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            Check All
          </Button>
        </div>
      )}

      {compliancePercentage === 100 && mandatoryItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            All mandatory PPE requirements confirmed
          </p>
        </div>
      )}

      {/* Header with compliance bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">PPE Compliance</span>
          </div>
          <span className={cn(
            "text-sm font-bold",
            compliancePercentage === 100 ? "text-green-500" : "text-destructive"
          )}>
            {compliancePercentage}%
          </span>
        </div>
        <Progress 
          value={compliancePercentage} 
          className={cn(
            "h-2",
            compliancePercentage === 100 ? "[&>div]:bg-green-500" : "[&>div]:bg-destructive"
          )}
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Badge 
          variant="outline" 
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={onSelectAll}
        >
          Select All
        </Badge>
        <Badge 
          variant="outline" 
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={onSelectMandatory}
        >
          Select Mandatory
        </Badge>
      </div>

      {/* Trades on site */}
      {tradesOnSite.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground">Trades on site:</span>
          {tradesOnSite.map(trade => (
            <Badge key={trade} variant="secondary" className="text-xs">
              {trade}
            </Badge>
          ))}
        </div>
      )}

      {/* Mandatory items */}
      {mandatoryItems.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-destructive font-semibold uppercase tracking-wide">
            Required ({mandatoryCheckedCount}/{mandatoryItems.length})
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mandatoryItems.map(ppe => {
              const Icon = getPPEIcon(ppe.ppe_item);
              const isChecked = checkedItems[ppe.id] || false;
              
              return (
                <div
                  key={ppe.id}
                  onClick={() => handleToggle(ppe.id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all",
                    isChecked 
                      ? "bg-green-500/10 border-green-500/50" 
                      : "bg-destructive/5 border-destructive/30 hover:border-destructive/50"
                  )}
                >
                  <Checkbox 
                    checked={isChecked}
                    className={cn(
                      isChecked ? "border-green-500 data-[state=checked]:bg-green-500" : "border-destructive"
                    )}
                  />
                  <Icon className={cn(
                    "h-4 w-4",
                    isChecked ? "text-green-500" : "text-destructive"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isChecked && "line-through text-muted-foreground"
                    )}>
                      {ppe.ppe_item}
                    </p>
                    {ppe.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {ppe.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional items */}
      {optionalItems.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
            Recommended
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {optionalItems.map(ppe => {
              const Icon = getPPEIcon(ppe.ppe_item);
              const isChecked = checkedItems[ppe.id] || false;
              
              return (
                <div
                  key={ppe.id}
                  onClick={() => handleToggle(ppe.id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all",
                    isChecked 
                      ? "bg-green-500/10 border-green-500/50" 
                      : "bg-muted/50 border-border hover:border-primary/50"
                  )}
                >
                  <Checkbox 
                    checked={isChecked}
                    className={isChecked ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                  />
                  <Icon className={cn(
                    "h-4 w-4",
                    isChecked ? "text-green-500" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      isChecked && "line-through text-muted-foreground"
                    )}>
                      {ppe.ppe_item}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to compute compliance from checked items - used by parent
export function computePPECompliance(
  ppeRequirements: PPERequirement[],
  tradesOnSite: string[],
  checkedItems: Record<string, boolean>
): { status: string; percentage: number } {
  const relevantTrades = ["general", ...tradesOnSite.map(t => t.toLowerCase())];
  
  const relevantPPE = ppeRequirements.filter((ppe) =>
    relevantTrades.some((trade) => ppe.trade_type.toLowerCase().includes(trade))
  );

  // Deduplicate
  const uniquePPE = relevantPPE.reduce((acc, ppe) => {
    const existing = acc.find((p) => p.ppe_item === ppe.ppe_item);
    if (!existing) {
      acc.push(ppe);
    } else if (ppe.is_mandatory && !existing.is_mandatory) {
      const idx = acc.indexOf(existing);
      acc[idx] = ppe;
    }
    return acc;
  }, [] as PPERequirement[]);

  const mandatoryItems = uniquePPE.filter(p => p.is_mandatory);
  
  if (mandatoryItems.length === 0) {
    return { status: 'full', percentage: 100 };
  }

  const mandatoryChecked = mandatoryItems.filter(p => checkedItems[p.id]).length;
  const percentage = Math.round((mandatoryChecked / mandatoryItems.length) * 100);
  
  const status = percentage === 100 ? 'full' : percentage >= 50 ? 'partial' : 'none';
  
  return { status, percentage };
}
