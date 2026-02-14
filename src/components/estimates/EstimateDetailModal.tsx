import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useEstimates } from "@/hooks/useEstimates";
import { CheckCircle2, Copy, Lock } from "lucide-react";
import { format } from "date-fns";
import type { Estimate, EstimateLineItem } from "@/types/estimates";

interface Props {
  estimate: Estimate;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);

export const EstimateDetailModal = ({ estimate, canEdit, onClose, onUpdated }: Props) => {
  const { fetchLineItems, approveEstimate, duplicateEstimate } = useEstimates(estimate.project_id);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const items = await fetchLineItems(estimate.id);
      setLineItems(items);
      setLoading(false);
    };
    load();
  }, [estimate.id]);

  const isDraft = estimate.status === "draft";
  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const totalTax = lineItems.reduce((s, li) => s + li.sales_tax_amount, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{estimate.estimate_number}</DialogTitle>
            <Badge variant={estimate.status === "approved" ? "default" : "secondary"}>
              {estimate.status === "approved" && <Lock className="h-3 w-3 mr-1" />}
              {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Contract Value</p>
              <p className="font-semibold">{formatCurrency(estimate.contract_value)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Planned Total Cost</p>
              <p className="font-semibold">{formatCurrency(estimate.planned_total_cost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Planned Margin</p>
              <p className="font-semibold">{estimate.planned_margin_percent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Labor Hours</p>
              <p className="font-semibold">{estimate.planned_labor_hours}h @ {formatCurrency(estimate.planned_labor_bill_rate)}/hr</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Material Cost</p>
              <p className="font-semibold">{formatCurrency(estimate.planned_material_cost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Machine Cost</p>
              <p className="font-semibold">{formatCurrency(estimate.planned_machine_cost)}</p>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
              <p>{estimate.bill_to_name || "—"}</p>
              <p className="text-muted-foreground">{estimate.bill_to_address || ""}</p>
              <p className="text-muted-foreground">{estimate.bill_to_ap_email || ""}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ship To</p>
              <p>{estimate.ship_to_name || "—"}</p>
              <p className="text-muted-foreground">{estimate.ship_to_address || ""}</p>
            </div>
          </div>

          {/* Customer PM info */}
          {(estimate.customer_pm_name || estimate.customer_po_number) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {estimate.customer_po_number && (
                <div>
                  <p className="text-muted-foreground text-xs">PO #</p>
                  <p>{estimate.customer_po_number}</p>
                </div>
              )}
              {estimate.customer_pm_name && (
                <div>
                  <p className="text-muted-foreground text-xs">Customer PM</p>
                  <p>{estimate.customer_pm_name}</p>
                </div>
              )}
              {estimate.customer_pm_email && (
                <div>
                  <p className="text-muted-foreground text-xs">PM Email</p>
                  <p>{estimate.customer_pm_email}</p>
                </div>
              )}
            </div>
          )}

          {/* Line Items */}
          <div>
            <p className="text-sm font-semibold mb-2">Line Items</p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map(li => (
                      <TableRow key={li.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{li.item_type}</Badge>
                        </TableCell>
                        <TableCell>{li.name}</TableCell>
                        <TableCell className="text-right">{li.quantity}</TableCell>
                        <TableCell>{li.unit || "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(li.rate)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(li.amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(li.sales_tax_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end mt-2 space-x-6 text-sm">
              <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
              <span>Tax: <strong>{formatCurrency(totalTax)}</strong></span>
              <span>Total: <strong>{formatCurrency(subtotal + totalTax)}</strong></span>
            </div>
          </div>

          {/* Notes */}
          {(estimate.note_for_customer || estimate.internal_notes) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {estimate.note_for_customer && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Note for Customer</p>
                  <p className="whitespace-pre-wrap">{estimate.note_for_customer}</p>
                </div>
              )}
              {estimate.internal_notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Internal Notes</p>
                  <p className="whitespace-pre-wrap">{estimate.internal_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isDraft && canEdit && (
              <Button
                variant="default"
                onClick={async () => {
                  await approveEstimate(estimate.id);
                  onUpdated();
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve & Lock
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                await duplicateEstimate(estimate.id);
                onUpdated();
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicate as Draft
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
