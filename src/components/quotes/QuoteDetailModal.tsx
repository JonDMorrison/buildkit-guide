import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuotes } from "@/hooks/useQuotes";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Send, XCircle, Lock, ArrowRightLeft, Mail, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Quote, QuoteLineItem, QuoteConversion } from "@/types/quotes";

interface Props {
  quote: Quote;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);

export const QuoteDetailModal = ({ quote, canEdit, onClose, onUpdated }: Props) => {
  const {
    fetchLineItems, approveQuote, markSent, rejectQuote,
    convertToInvoice, getConversion,
  } = useQuotes();
  const navigate = useNavigate();

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversion, setConversion] = useState<QuoteConversion | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [items, conv] = await Promise.all([
        fetchLineItems(quote.id),
        getConversion(quote.id),
      ]);
      setLineItems(items);
      setConversion(conv);
      setLoading(false);
    };
    load();
  }, [quote.id]);

  const isDraft = quote.status === "draft";
  const isSent = quote.status === "sent";
  const isApproved = quote.status === "approved";
  const isConverted = !!conversion;

  const handleConvert = async () => {
    setConverting(true);
    const invoiceId = await convertToInvoice(quote.id);
    setConverting(false);
    if (invoiceId) {
      onUpdated();
      navigate("/invoicing");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>{quote.quote_number}</DialogTitle>
              <Badge variant={
                quote.status === "approved" ? "default" :
                quote.status === "rejected" ? "destructive" : "secondary"
              }>
                {quote.status === "approved" && <Lock className="h-3 w-3 mr-1" />}
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Badge>
              {isConverted && (
                <Badge variant="outline" className="text-primary border-primary">
                  <ArrowRightLeft className="h-3 w-3 mr-1" /> Converted
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Customer</p>
                <p className="font-semibold">{quote.client?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Project</p>
                <p className="font-semibold">{quote.project?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Total</p>
                <p className="font-semibold">{fmt(quote.total)}</p>
              </div>
              {quote.customer_po_number && (
                <div>
                  <p className="text-muted-foreground text-xs">PO #</p>
                  <p>{quote.customer_po_number}</p>
                </div>
              )}
              {quote.customer_pm_name && (
                <div>
                  <p className="text-muted-foreground text-xs">Customer PM</p>
                  <p>{quote.customer_pm_name}</p>
                </div>
              )}
              {quote.customer_pm_email && (
                <div>
                  <p className="text-muted-foreground text-xs">PM Email (quote recipient)</p>
                  <p className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {quote.customer_pm_email}
                  </p>
                </div>
              )}
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                <p>{quote.bill_to_name || "—"}</p>
                <p className="text-muted-foreground">{quote.bill_to_address || ""}</p>
                {quote.bill_to_ap_email && (
                  <p className="text-muted-foreground text-xs mt-1">
                    AP Email (invoice recipient): {quote.bill_to_ap_email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ship To</p>
                <p>{quote.ship_to_name || "—"}</p>
                <p className="text-muted-foreground">{quote.ship_to_address || ""}</p>
              </div>
            </div>

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
                        <TableHead>Product / Service</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map(li => (
                        <TableRow key={li.id}>
                          <TableCell className="font-medium">{li.product_or_service}</TableCell>
                          <TableCell>{li.description || "—"}</TableCell>
                          <TableCell className="text-right">{li.quantity}</TableCell>
                          <TableCell className="text-right">{fmt(li.rate)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(li.amount)}</TableCell>
                          <TableCell className="text-right">{fmt(li.sales_tax_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex justify-end mt-2 space-x-6 text-sm">
                <span>Subtotal: <strong>{fmt(quote.subtotal)}</strong></span>
                <span>GST: <strong>{fmt(quote.gst)}</strong></span>
                <span>PST: <strong>{fmt(quote.pst)}</strong></span>
                <span>Total: <strong>{fmt(quote.total)}</strong></span>
              </div>
            </div>

            {/* Notes */}
            {(quote.note_for_customer || quote.internal_notes || quote.memo_on_statement) && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                {quote.note_for_customer && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Note for Customer</p>
                    <p className="whitespace-pre-wrap">{quote.note_for_customer}</p>
                  </div>
                )}
                {quote.memo_on_statement && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Memo on Statement</p>
                    <p className="whitespace-pre-wrap">{quote.memo_on_statement}</p>
                  </div>
                )}
                {quote.internal_notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Internal Notes</p>
                    <p className="whitespace-pre-wrap">{quote.internal_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Conversion info */}
            {isConverted && conversion && (
              <Alert>
                <ArrowRightLeft className="h-4 w-4" />
                <AlertTitle>Converted to Invoice</AlertTitle>
                <AlertDescription>
                  Converted on {format(new Date(conversion.converted_at), "MMM d, yyyy")}.{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => { onClose(); navigate("/invoicing"); }}>
                    View Invoice →
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {isDraft && canEdit && (
                <Button variant="outline" onClick={async () => { await markSent(quote.id); onUpdated(); }}>
                  <Send className="h-4 w-4 mr-2" /> Mark Sent
                </Button>
              )}
              {(isDraft || isSent) && canEdit && (
                <Button onClick={async () => { await approveQuote(quote.id); onUpdated(); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
                </Button>
              )}
              {isSent && canEdit && (
                <Button variant="destructive" onClick={async () => { await rejectQuote(quote.id); onUpdated(); }}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              )}
              {isApproved && !isConverted && canEdit && (
                <Button onClick={() => setShowConvertDialog(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" /> Convert to Invoice
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversion Confirmation */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Quote to Invoice?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>This will create a new draft invoice from this quote.</p>
                <Alert variant="default" className="border-accent/30">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <AlertTitle className="text-sm">Email Recipient Changes</AlertTitle>
                  <AlertDescription className="text-xs space-y-1">
                    <p><strong>Quote was sent to:</strong> {quote.customer_pm_email || "No PM email"} (Project Manager)</p>
                    <p><strong>Invoice will be sent to:</strong> {quote.bill_to_ap_email || "No AP email"} (Accounts Payable)</p>
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase">Bill To</p>
                    <p>{quote.bill_to_name}</p>
                    <p>{quote.bill_to_address}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase">Ship To</p>
                    <p>{quote.ship_to_name}</p>
                    <p>{quote.ship_to_address}</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert} disabled={converting}>
              {converting ? "Converting…" : "Convert to Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
