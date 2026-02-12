import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";
import type { Invoice, Client } from "@/types/invoicing";

interface Props {
  invoices: Invoice[];
  clients: Client[];
}

interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export const AgingReport = ({ invoices, clients }: Props) => {
  const outstandingInvoices = invoices.filter(
    (inv) => (inv.status === "sent" || inv.status === "overdue") && Number(inv.total) > Number(inv.amount_paid || 0)
  );

  const today = new Date();

  const getAgingBucket = (inv: Invoice): keyof Omit<AgingBucket, "total"> => {
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.issue_date);
    const daysOverdue = differenceInDays(today, dueDate);
    if (daysOverdue <= 0) return "current";
    if (daysOverdue <= 30) return "days30";
    if (daysOverdue <= 60) return "days60";
    if (daysOverdue <= 90) return "days90";
    return "over90";
  };

  // Group by client
  const byClient = new Map<string, { clientName: string; buckets: AgingBucket; invoices: Invoice[] }>();
  
  for (const inv of outstandingInvoices) {
    const clientId = inv.client_id || "no-client";
    const clientName = inv.client?.name || "No Client";
    if (!byClient.has(clientId)) {
      byClient.set(clientId, {
        clientName,
        buckets: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 },
        invoices: [],
      });
    }
    const entry = byClient.get(clientId)!;
    const balance = Number(inv.total) - Number(inv.amount_paid || 0);
    const bucket = getAgingBucket(inv);
    entry.buckets[bucket] += balance;
    entry.buckets.total += balance;
    entry.invoices.push(inv);
  }

  const totals: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
  byClient.forEach(({ buckets }) => {
    totals.current += buckets.current;
    totals.days30 += buckets.days30;
    totals.days60 += buckets.days60;
    totals.days90 += buckets.days90;
    totals.over90 += buckets.over90;
    totals.total += buckets.total;
  });

  const fmt = (n: number) => n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  const bucketLabels = [
    { key: "current" as const, label: "Current", color: "bg-green-500" },
    { key: "days30" as const, label: "1-30 Days", color: "bg-yellow-500" },
    { key: "days60" as const, label: "31-60 Days", color: "bg-orange-500" },
    { key: "days90" as const, label: "61-90 Days", color: "bg-red-400" },
    { key: "over90" as const, label: "90+ Days", color: "bg-red-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {bucketLabels.map(({ key, label, color }) => (
          <Card key={key}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-bold">{fmt(totals[key])}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <span className="text-xs text-muted-foreground">Total Outstanding</span>
            <p className="text-lg font-bold">{fmt(totals.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed table */}
      {byClient.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No outstanding invoices. All caught up! 🎉
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts Receivable Aging</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30</TableHead>
                  <TableHead className="text-right">31-60</TableHead>
                  <TableHead className="text-right">61-90</TableHead>
                  <TableHead className="text-right">90+</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(byClient.entries()).map(([clientId, { clientName, buckets }]) => (
                  <TableRow key={clientId}>
                    <TableCell className="font-medium">{clientName}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.current)}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.days30)}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.days60)}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.days90)}</TableCell>
                    <TableCell className="text-right">{fmt(buckets.over90)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(buckets.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(totals.current)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.days30)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.days60)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.days90)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.over90)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
