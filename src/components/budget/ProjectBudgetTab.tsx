import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/EmptyState';
import { useProjectBudget, ProjectBudget } from '@/hooks/useProjectBudget';
import { useAuthRole } from '@/hooks/useAuthRole';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import {
  DollarSign, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Plus, ArrowDownToLine, Save, FileText, AlertCircle, Package, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectBudgetTabProps {
  projectId: string;
}

export const ProjectBudgetTab = ({ projectId }: ProjectBudgetTabProps) => {
  const { isAdmin, isPM, loading: roleLoading } = useAuthRole(projectId);
  const canEdit = isAdmin || isPM();
  const {
    budget, scopeRollup, actuals, variance,
    loading, saving, hasBudget,
    createBudget, updateBudget, applyRollup,
  } = useProjectBudget(projectId);

  if (loading || roleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!hasBudget) {
    return (
      <EmptyState
        icon={<DollarSign className="h-10 w-10" />}
        title="No budget defined"
        description="Create a budget to track planned vs actual costs for this project."
        action={
          canEdit ? { label: 'Create Budget', onClick: createBudget } : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Guardrail warnings */}
      <BudgetWarnings budget={budget!} actuals={actuals} />

      {/* Budget form */}
      <BudgetEditor budget={budget!} canEdit={canEdit} saving={saving} onUpdate={updateBudget} />

      {/* Scope rollup */}
      <ScopeRollupPanel
        scopeRollup={scopeRollup}
        budget={budget!}
        canEdit={canEdit}
        onApply={applyRollup}
        saving={saving}
      />

      {/* Actuals + Variance */}
      {variance && <VariancePanel variance={variance} />}
    </div>
  );
};

/* ---------- Budget Editor ---------- */

function BudgetEditor({
  budget, canEdit, saving, onUpdate,
}: {
  budget: ProjectBudget;
  canEdit: boolean;
  saving: boolean;
  onUpdate: (updates: Partial<ProjectBudget>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    contract_value: budget.contract_value,
    planned_labor_hours: budget.planned_labor_hours,
    planned_labor_cost: budget.planned_labor_cost,
    planned_material_cost: budget.planned_material_cost,
    planned_machine_cost: budget.planned_machine_cost,
    planned_other_cost: budget.planned_other_cost,
  });

  const isDirty = Object.keys(draft).some(
    (k) => draft[k as keyof typeof draft] !== budget[k as keyof typeof budget]
  );

  const totalPlanned = draft.planned_labor_cost + draft.planned_material_cost +
    draft.planned_machine_cost + draft.planned_other_cost;
  const plannedProfit = draft.contract_value - totalPlanned;

  const handleSave = () => {
    onUpdate(draft);
  };

  const field = (label: string, key: keyof typeof draft, icon: React.ReactNode, prefix = '$') => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      {canEdit ? (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {prefix}
            </span>
          )}
          <Input
            type="number"
            step="0.01"
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) || 0 })}
            className={cn("h-11 tabular-nums", prefix && "pl-7")}
          />
        </div>
      ) : (
        <p className="text-sm font-semibold tabular-nums py-2">
          {prefix === '$' ? formatCurrency(draft[key]) : formatNumber(draft[key]) + (key.includes('hours') ? 'h' : '')}
        </p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budget Plan
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono uppercase">{budget.currency}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {field('Contract Value', 'contract_value', <FileText className="h-3.5 w-3.5" />)}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          {field('Labor Hours', 'planned_labor_hours', <Clock className="h-3.5 w-3.5" />, '')}
          {field('Labor Cost', 'planned_labor_cost', <DollarSign className="h-3.5 w-3.5" />)}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {field('Material Cost', 'planned_material_cost', <Package className="h-3.5 w-3.5" />)}
          {field('Machine Cost', 'planned_machine_cost', <Wrench className="h-3.5 w-3.5" />)}
        </div>

        {field('Other Cost', 'planned_other_cost', <DollarSign className="h-3.5 w-3.5" />)}

        <Separator />

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Planned Cost</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPlanned)}</p>
          </div>
          <div className={cn(
            "rounded-lg p-3",
            plannedProfit >= 0 ? "bg-status-complete/10" : "bg-destructive/10"
          )}>
            <p className="text-xs text-muted-foreground mb-1">Planned Profit</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              plannedProfit >= 0 ? "text-status-complete" : "text-destructive"
            )}>
              {formatCurrency(plannedProfit)}
            </p>
          </div>
        </div>

        {canEdit && isDirty && (
          <Button onClick={handleSave} loading={saving} className="w-full">
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Scope Rollup ---------- */

function ScopeRollupPanel({
  scopeRollup, budget, canEdit, onApply, saving,
}: {
  scopeRollup: ReturnType<typeof useProjectBudget>['scopeRollup'];
  budget: ProjectBudget;
  canEdit: boolean;
  onApply: () => Promise<void>;
  saving: boolean;
}) {
  if (!scopeRollup || scopeRollup.itemCount === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No active scope items to roll up. Add scope items in the Scope tab.
        </CardContent>
      </Card>
    );
  }

  const hoursDiff = scopeRollup.totalPlannedHours - budget.planned_labor_hours;
  const materialDiff = scopeRollup.totalMaterialCost - budget.planned_material_cost;
  const machineDiff = scopeRollup.totalMachineCost - budget.planned_machine_cost;
  const hasDiff = Math.abs(hoursDiff) > 0.01 || Math.abs(materialDiff) > 0.01 || Math.abs(machineDiff) > 0.01;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4" />
          Scope Rollup
          <span className="text-xs text-muted-foreground font-normal ml-1">
            ({scopeRollup.itemCount} items)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <RollupStat label="Hours" value={`${formatNumber(scopeRollup.totalPlannedHours)}h`} diff={hoursDiff} suffix="h" />
          <RollupStat label="Material" value={formatCurrency(scopeRollup.totalMaterialCost)} diff={materialDiff} currency />
          <RollupStat label="Machine" value={formatCurrency(scopeRollup.totalMachineCost)} diff={machineDiff} currency />
        </div>

        {canEdit && hasDiff && (
          <Button variant="secondary" onClick={onApply} loading={saving} className="w-full" size="sm">
            <ArrowDownToLine className="h-4 w-4 mr-1" />
            Apply Rollup to Budget
          </Button>
        )}

        {!hasDiff && (
          <p className="text-xs text-muted-foreground text-center">Budget matches scope rollup ✓</p>
        )}
      </CardContent>
    </Card>
  );
}

function RollupStat({
  label, value, diff, suffix, currency,
}: {
  label: string; value: string; diff: number; suffix?: string; currency?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {Math.abs(diff) > 0.01 && (
        <p className={cn(
          "text-xs tabular-nums mt-0.5",
          diff > 0 ? "text-status-issue" : "text-status-complete"
        )}>
          {diff > 0 ? '+' : ''}{currency ? formatCurrency(diff) : `${diff.toFixed(1)}${suffix || ''}`} vs budget
        </p>
      )}
    </div>
  );
}

/* ---------- Variance Panel ---------- */

function VariancePanel({ variance }: { variance: NonNullable<ReturnType<typeof useProjectBudget>['variance']> }) {
  const rows = [
    { label: 'Labor Hours', planned: `${formatNumber(variance.planned_labor_hours)}h`, actual: `${formatNumber(variance.actual_labor_hours)}h`, delta: variance.labor_hours_delta, suffix: 'h' },
    { label: 'Labor Cost', planned: formatCurrency(variance.planned_labor_cost), actual: formatCurrency(variance.actual_labor_cost), delta: variance.labor_cost_delta, currency: true },
    { label: 'Material', planned: formatCurrency(variance.planned_material_cost), actual: formatCurrency(variance.actual_material_cost), delta: variance.material_cost_delta, currency: true },
    { label: 'Machine', planned: formatCurrency(variance.planned_machine_cost), actual: formatCurrency(variance.actual_machine_cost), delta: variance.machine_cost_delta, currency: true },
    { label: 'Other', planned: formatCurrency(variance.planned_other_cost), actual: formatCurrency(variance.actual_other_cost), delta: variance.other_cost_delta, currency: true },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Actuals & Variance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">
          <span>Category</span>
          <span className="text-right">Planned</span>
          <span className="text-right">Actual</span>
          <span className="text-right">Delta</span>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-4 gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
            <span className="font-medium">{row.label}</span>
            <span className="text-right tabular-nums text-muted-foreground">{row.planned}</span>
            <span className="text-right tabular-nums">{row.actual}</span>
            <span className={cn(
              "text-right tabular-nums font-medium flex items-center justify-end gap-1",
              row.delta > 0 ? "text-status-complete" : row.delta < 0 ? "text-destructive" : ""
            )}>
              {row.delta !== 0 && (row.delta > 0 ?
                <TrendingUp className="h-3 w-3" /> :
                <TrendingDown className="h-3 w-3" />
              )}
              {row.delta > 0 ? '+' : ''}
              {row.currency ? formatCurrency(row.delta) : `${row.delta.toFixed(1)}${row.suffix || ''}`}
            </span>
          </div>
        ))}

        <Separator className="my-2" />

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "rounded-lg p-3",
            variance.actual_profit >= 0 ? "bg-status-complete/10" : "bg-destructive/10"
          )}>
            <p className="text-xs text-muted-foreground mb-1">Actual Profit</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              variance.actual_profit >= 0 ? "text-status-complete" : "text-destructive"
            )}>
              {formatCurrency(variance.actual_profit)}
            </p>
            <p className="text-xs text-muted-foreground">
              {variance.actual_margin_percent.toFixed(1)}% margin
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Cost Delta</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              variance.total_cost_delta > 0 ? "text-status-complete" : variance.total_cost_delta < 0 ? "text-destructive" : ""
            )}>
              {variance.total_cost_delta > 0 ? '+' : ''}{formatCurrency(variance.total_cost_delta)}
            </p>
            <p className="text-xs text-muted-foreground">
              {variance.total_cost_delta >= 0 ? 'Under budget' : 'Over budget'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Budget Warnings ---------- */

function BudgetWarnings({
  budget, actuals,
}: {
  budget: ProjectBudget;
  actuals: ReturnType<typeof useProjectBudget>['actuals'];
}) {
  const warnings: { title: string; description: string; icon: React.ReactNode }[] = [];

  if (budget.planned_labor_hours > 0 && budget.planned_labor_cost === 0) {
    warnings.push({
      title: 'Missing labor cost',
      description: 'Labor hours are defined but labor cost is $0. Set a planned labor cost for accurate reporting.',
      icon: <AlertTriangle className="h-4 w-4" />,
    });
  }

  if (budget.planned_labor_cost > 0 && budget.planned_labor_hours === 0) {
    warnings.push({
      title: 'Missing labor hours',
      description: 'Labor cost is defined but labor hours is 0. Set planned hours for schedule tracking.',
      icon: <AlertTriangle className="h-4 w-4" />,
    });
  }

  if (actuals) {
    if (actuals.labor_hours_missing_cost_rate > 0) {
      warnings.push({
        title: `${actuals.labor_entry_count_missing_cost_rate} entries missing cost rate`,
        description: `${actuals.labor_hours_missing_cost_rate.toFixed(1)}h of labor has $0 cost rate. Update cost rates in project members.`,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }

    if (actuals.labor_hours_missing_membership > 0) {
      warnings.push({
        title: `${actuals.labor_entry_count_missing_membership} entries with no project membership`,
        description: `${actuals.labor_hours_missing_membership.toFixed(1)}h logged by users not in project members.`,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }

    if ((actuals as any).labor_hours_currency_mismatch > 0) {
      warnings.push({
        title: `${(actuals as any).labor_entry_count_currency_mismatch} entries with currency mismatch`,
        description: `${Number((actuals as any).labor_hours_currency_mismatch).toFixed(1)}h excluded from costing — member rate currency doesn't match org base currency.`,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }

    if (actuals.unclassified_receipt_count > 0) {
      warnings.push({
        title: `${actuals.unclassified_receipt_count} unclassified receipts`,
        description: `${formatCurrency(actuals.actual_unclassified_cost)} in receipts missing cost type classification.`,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <Alert key={i} variant="destructive" className="border-status-issue/30 bg-status-issue/5">
          {w.icon}
          <AlertTitle className="text-sm">{w.title}</AlertTitle>
          <AlertDescription className="text-xs">{w.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
