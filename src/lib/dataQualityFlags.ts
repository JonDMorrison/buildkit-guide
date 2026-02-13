export interface DataQualityFlag {
  key: string;
  label: string;
  severity: "warn" | "error";
}

export const getDataQualityFlags = (row: {
  has_budget: boolean;
  labor_hours_missing_cost_rate: number;
  labor_hours_missing_membership: number;
  actual_unclassified_cost: number;
}): DataQualityFlag[] => {
  const flags: DataQualityFlag[] = [];

  if (!row.has_budget) {
    flags.push({ key: "no_budget", label: "Missing budget", severity: "error" });
  }
  if (row.labor_hours_missing_cost_rate > 0) {
    flags.push({ key: "missing_rates", label: "Missing cost rates", severity: "warn" });
  }
  if (row.labor_hours_missing_membership > 0) {
    flags.push({ key: "missing_membership", label: "Unmatched workers", severity: "warn" });
  }
  if (row.actual_unclassified_cost > 0) {
    flags.push({ key: "unclassified", label: "Unclassified receipts", severity: "warn" });
  }

  return flags;
};

export const hasAnyQualityIssue = (row: Parameters<typeof getDataQualityFlags>[0]) =>
  getDataQualityFlags(row).length > 0;
