import type { ProjectSnapshot } from "@/hooks/useProjectSnapshots";
import type { VarianceData } from "@/hooks/useEstimateAccuracy";
import type { PortfolioRow } from "@/hooks/usePortfolioInsights";
import { formatCurrency, formatNumber } from "@/lib/formatters";

export type RecommendationSeverity = "info" | "warn" | "critical";
export type RecommendationCategory =
  | "labor"
  | "material"
  | "machine"
  | "invoicing"
  | "data_quality";

export interface Recommendation {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  message: string;
  evidence: string;
  suggested_action: string;
  category: RecommendationCategory;
  /** Route to navigate to for fixing */
  link?: string;
  /** For portfolio-level: the project name/id causing the issue */
  projectName?: string;
  projectId?: string;
}

// ─── Project-Level Rules ────────────────────────────────────────

export const getProjectRecommendations = (
  snapshots: ProjectSnapshot[],
  variance: VarianceData | null,
  hasBudget: boolean,
  projectId: string
): Recommendation[] => {
  const recs: Recommendation[] = [];
  if (!variance) return recs;

  const recent = snapshots.slice(-8);
  const last4 = recent.slice(-4);

  // 1) Persistent labor overrun
  if (hasBudget && last4.length >= 3) {
    const overrunWeeks = last4.filter(
      (s) =>
        s.has_budget &&
        s.planned_labor_hours > 0 &&
        ((s.actual_labor_hours - s.planned_labor_hours) / s.planned_labor_hours) * 100 > 15
    ).length;
    if (overrunWeeks >= 3) {
      recs.push({
        id: "persistent_labor_overrun",
        severity: "warn",
        title: "Persistent Labor Overrun",
        message:
          "Labor hours have exceeded the budget by more than 15% in at least 3 of the last 4 weeks. Review crew sizing and task estimates.",
        evidence: `${overrunWeeks} of last ${last4.length} weeks over 15% threshold`,
        suggested_action: "Review task estimates and adjust crew allocation",
        category: "labor",
        link: `/project-overview?projectId=${projectId}&tab=budget`,
      });
    }
  }

  // 2) Material under-estimate (repeated)
  if (hasBudget && last4.length >= 2) {
    const materialOverWeeks = last4.filter(
      (s) =>
        s.has_budget &&
        s.actual_material_cost - s.planned_material_cost > 500
    ).length;
    if (materialOverWeeks >= 2) {
      const delta = variance.actual_material_cost - variance.planned_material_cost;
      recs.push({
        id: "material_underestimate",
        severity: "warn",
        title: "Material Costs Exceed Estimates",
        message:
          "Material spending has consistently exceeded the budget. Consider updating material estimates or reviewing procurement.",
        evidence: `Current overrun: ${formatCurrency(delta)}. Over budget in ${materialOverWeeks} of last ${last4.length} weeks.`,
        suggested_action: "Update material budget or review procurement process",
        category: "material",
        link: `/project-overview?projectId=${projectId}&tab=budget`,
      });
    }
  }

  // 3) Unclassified receipts
  if (variance.actual_unclassified_cost > 500) {
    recs.push({
      id: "unclassified_receipts",
      severity: "warn",
      title: "Unclassified Receipts",
      message:
        "Significant receipts lack a cost category. This skews material/machine/other breakdown accuracy.",
      evidence: `${formatCurrency(variance.actual_unclassified_cost)} unclassified`,
      suggested_action: "Categorize receipts in the Receipts module",
      category: "data_quality",
      link: "/data-health",
    });
  }

  // 4) Margin at risk — trending down 3 weeks
  if (recent.length >= 3) {
    const last3 = recent.slice(-3);
    const marginTrendDown =
      last3[0].actual_margin_pct > last3[1].actual_margin_pct &&
      last3[1].actual_margin_pct > last3[2].actual_margin_pct;
    if (marginTrendDown) {
      const drop = last3[0].actual_margin_pct - last3[2].actual_margin_pct;
      recs.push({
        id: "margin_at_risk",
        severity: "critical",
        title: "Margin Declining",
        message:
          "Project margin has dropped for 3 consecutive weeks. Immediate review recommended.",
        evidence: `Dropped ${drop.toFixed(1)} percentage points (${last3[0].actual_margin_pct.toFixed(1)}% → ${last3[2].actual_margin_pct.toFixed(1)}%)`,
        suggested_action:
          "Review cost drivers and consider scope/change-order adjustments",
        category: "invoicing",
        link: `/insights/project?projectId=${projectId}`,
      });
    }
  }

  // 5) Missing cost rates
  if (variance.labor_hours_missing_cost_rate > 5) {
    recs.push({
      id: "missing_cost_rates",
      severity: "warn",
      title: "Missing Cost Rates",
      message:
        "Multiple labor hours have $0 cost rate, understating labor costs.",
      evidence: `${formatNumber(variance.labor_hours_missing_cost_rate)} hours at $0 rate`,
      suggested_action: "Set cost rates for workers in project settings",
      category: "data_quality",
      link: "/data-health",
    });
  }

  // 6) No budget
  if (!hasBudget) {
    recs.push({
      id: "no_budget",
      severity: "critical",
      title: "No Budget Defined",
      message:
        "Without a budget, variance tracking and margin calculations are unavailable.",
      evidence: "No budget row exists for this project",
      suggested_action: "Create a project budget",
      category: "data_quality",
      link: `/project-overview?projectId=${projectId}&tab=budget`,
    });
  }

  // 7) Machine cost overrun
  if (
    hasBudget &&
    variance.planned_machine_cost > 0 &&
    variance.machine_cost_delta < 0 &&
    Math.abs(variance.machine_cost_delta) / variance.planned_machine_cost > 0.2
  ) {
    recs.push({
      id: "machine_overrun",
      severity: "warn",
      title: "Machine Costs Over Budget",
      message:
        "Machine/equipment costs have exceeded the budget by more than 20%.",
      evidence: `${formatCurrency(Math.abs(variance.machine_cost_delta))} over budget (${((Math.abs(variance.machine_cost_delta) / variance.planned_machine_cost) * 100).toFixed(0)}%)`,
      suggested_action: "Review equipment utilization and rental agreements",
      category: "machine",
      link: `/project-overview?projectId=${projectId}&tab=budget`,
    });
  }

  return recs.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
};

// ─── Portfolio-Level Rules ──────────────────────────────────────

export const getPortfolioRecommendations = (
  rows: PortfolioRow[],
  limit = 5
): Recommendation[] => {
  const recs: Recommendation[] = [];

  for (const r of rows) {
    // No budget
    if (!r.has_budget) {
      recs.push({
        id: `no_budget_${r.project_id}`,
        severity: "critical",
        title: "Missing Budget",
        message: `"${r.project_name}" has no budget. Variance and margin cannot be tracked.`,
        evidence: "No budget defined",
        suggested_action: "Create a budget for this project",
        category: "data_quality",
        projectName: r.project_name,
        projectId: r.project_id,
        link: `/project-overview?projectId=${r.project_id}&tab=budget`,
      });
    }

    // Large cost overrun (>20%)
    if (
      r.has_budget &&
      r.planned_total_cost > 0 &&
      r.total_cost_delta < 0 &&
      Math.abs(r.total_cost_delta) / r.planned_total_cost > 0.2
    ) {
      recs.push({
        id: `cost_overrun_${r.project_id}`,
        severity: "critical",
        title: "Significant Cost Overrun",
        message: `"${r.project_name}" is ${((Math.abs(r.total_cost_delta) / r.planned_total_cost) * 100).toFixed(0)}% over budget.`,
        evidence: `${formatCurrency(Math.abs(r.total_cost_delta))} over planned cost`,
        suggested_action: "Review cost drivers and adjust budget or scope",
        category: "labor",
        projectName: r.project_name,
        projectId: r.project_id,
        link: `/insights/project?projectId=${r.project_id}`,
      });
    }

    // Unclassified receipts
    if (r.actual_unclassified_cost > 500) {
      recs.push({
        id: `unclassified_${r.project_id}`,
        severity: "warn",
        title: "Unclassified Receipts",
        message: `"${r.project_name}" has ${formatCurrency(r.actual_unclassified_cost)} in unclassified receipts.`,
        evidence: `${formatCurrency(r.actual_unclassified_cost)} without category`,
        suggested_action: "Categorize receipts to improve cost breakdown accuracy",
        category: "data_quality",
        projectName: r.project_name,
        projectId: r.project_id,
        link: "/data-health",
      });
    }

    // Missing cost rates
    if (r.labor_hours_missing_cost_rate > 5) {
      recs.push({
        id: `missing_rates_${r.project_id}`,
        severity: "warn",
        title: "Missing Cost Rates",
        message: `"${r.project_name}" has ${formatNumber(r.labor_hours_missing_cost_rate)} labor hours with $0 rate.`,
        evidence: `${formatNumber(r.labor_hours_missing_cost_rate)} hours understated`,
        suggested_action: "Set cost rates for project workers",
        category: "data_quality",
        projectName: r.project_name,
        projectId: r.project_id,
        link: "/data-health",
      });
    }

    // Negative margin
    if (r.has_budget && r.contract_value > 0 && r.actual_margin_percent < 0) {
      recs.push({
        id: `negative_margin_${r.project_id}`,
        severity: "critical",
        title: "Negative Margin",
        message: `"${r.project_name}" is currently at ${r.actual_margin_percent.toFixed(1)}% margin — operating at a loss.`,
        evidence: `Margin: ${r.actual_margin_percent.toFixed(1)}%`,
        suggested_action: "Review costs and consider change orders",
        category: "invoicing",
        projectName: r.project_name,
        projectId: r.project_id,
        link: `/insights/project?projectId=${r.project_id}`,
      });
    }

    // Billing lag — billed < 50% but actual cost > 70% of planned
    if (
      r.has_budget &&
      r.contract_value > 0 &&
      r.billed_percentage < 50 &&
      r.planned_total_cost > 0 &&
      r.actual_total_cost / r.planned_total_cost > 0.7
    ) {
      recs.push({
        id: `billing_lag_${r.project_id}`,
        severity: "info",
        title: "Billing May Be Behind",
        message: `"${r.project_name}" is ${((r.actual_total_cost / r.planned_total_cost) * 100).toFixed(0)}% spent but only ${r.billed_percentage.toFixed(0)}% billed.`,
        evidence: `Billed: ${r.billed_percentage.toFixed(0)}% | Cost progress: ${((r.actual_total_cost / r.planned_total_cost) * 100).toFixed(0)}%`,
        suggested_action: "Create or send outstanding invoices",
        category: "invoicing",
        projectName: r.project_name,
        projectId: r.project_id,
        link: "/invoicing",
      });
    }
  }

  // Sort by severity, take top N
  return recs
    .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
    .slice(0, limit);
};

function severityOrder(s: RecommendationSeverity): number {
  return s === "critical" ? 3 : s === "warn" ? 2 : 1;
}
