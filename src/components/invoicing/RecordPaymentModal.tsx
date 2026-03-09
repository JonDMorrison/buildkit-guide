import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Invoice, InvoicePayment } from "@/types/invoicing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSubmit: (invoiceId: string, payment: Partial<InvoicePayment>) => Promise<void>;
  currencySymbol?: string;
}

export const RecordPaymentModal = ({ open, onOpenChange, invoice, onSubmit, currencySymbol = "$" }: Props) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cheque");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && invoice) {
      const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);
      setAmount(balance > 0 ? balance.toFixed(2) : "0");
      setPaymentDate(format(new Date(), "yyyy-MM-dd"));
      setPaymentMethod("cheque");
      setReferenceNumber("");
      setNotes("");
    }
  }, [open, invoice]);

  if (!invoice) return null;

  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);
  const parsedAmount = parseFloat(amount) || 0;
  const isOverpayment = parsedAmount > balance && balance > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(invoice.id, {
      amount: parsedAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod || null,
      reference_number: referenceNumber || null,
      notes: notes || null,
    });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Invoice total: <span className="font-medium text-foreground">{currencySymbol}{Number(invoice.total).toFixed(2)}</span>
            {" · "}Balance: <span className="font-medium text-foreground">{currencySymbol}{balance.toFixed(2)}</span>
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {isOverpayment && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Amount exceeds outstanding balance of {currencySymbol}{balance.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="e-transfer">E-Transfer</SelectItem>
                <SelectItem value="wire">Wire Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Cheque #, transaction ID, etc." />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading || !amount}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
