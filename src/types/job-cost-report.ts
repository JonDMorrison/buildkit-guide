export interface LaborRow {
  userId: string;
  userName: string;
  hoursWorked: number;
  billRate: number | null;
  totalCost: number;
}

export interface MaterialRow {
  id: string;
  date: string;
  vendor: string | null;
  category: string;
  amount: number;
  notes: string | null;
}

export interface JobCostReport {
  labor: {
    rows: LaborRow[];
    totalHours: number;
    totalCost: number;
  };
  materials: {
    rows: MaterialRow[];
    totalCost: number;
  };
  grandTotal: number;
}
