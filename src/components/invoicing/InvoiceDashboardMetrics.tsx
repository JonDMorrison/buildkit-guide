import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import type { Invoice } from "@/types/invoicing";

interface Props {
  invoices: Invoice[];
  currencySymbol?: string;
}

export const InvoiceDashboardMetrics = ({ invoices, currencySymbol = "$" }: Props) => {
  const metrics = useMemo(() => {
    const today = new Date();
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let paidDaysSum = 0;
    let paidCount = 0;
    const monthlyRevenue = new Map<string, number>();

    for (const inv of invoices) {
      const balance = Number(inv.total) - Number(inv.amount_paid || 0);
      const isOverdue = inv.status === "sent" && inv.due_date && new Date(inv.due_date) < today;

      if (inv.status === "sent" || isOverdue) {
        totalOutstanding += balance;
        if (isOverdue) totalOverdue += balance;
      }

      if (inv.status === "paid" && inv.paid_at && inv.sent_at) {
        const days = differenceInDays(new Date(inv.paid_at), new Date(inv.sent_at));
        if (days >= 0) { paidDaysSum += days; paidCount++; }
      }

      // Monthly revenue (from paid invoices)
      if (inv.status === "paid" && inv.paid_at) {
        const month = inv.paid_at.substring(0, 7);
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(inv.total));
      }
    }

    const avgDaysToPay = paidCount > 0 ? Math.round(paidDaysSum / paidCount) : 0;

    // Last 6 months chart data
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      chartData.push({ month: label, revenue: monthlyRevenue.get(key) || 0 });
    }

    return { totalOutstanding, totalOverdue, avgDaysToPay, chartData, paidCount };
  }, [invoices]);

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
            <p className="text-xl font-bold">{fmt(metrics.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
            <p className="text-xl font-bold text-destructive">{fmt(metrics.totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Avg Days to Pay</span>
            </div>
            <p className="text-xl font-bold">{metrics.avgDaysToPay} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Invoices Paid</span>
            </div>
            <p className="text-xl font-bold">{metrics.paidCount}</p>
          </CardContent>
        </Card>
      </div>

      {metrics.chartData.some(d => d.revenue > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: number) => [`${currencySymbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
