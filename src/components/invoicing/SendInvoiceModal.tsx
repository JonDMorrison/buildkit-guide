import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceSettings, Client } from "@/types/invoicing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  settings: InvoiceSettings | null;
  client: Client | null;
  onSent?: () => void;
}

export const SendInvoiceModal = ({ open, onOpenChange, invoice, settings, client, onSent }: Props) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoice) {
      setEmail(client?.email || "");
      setRecipientName(client?.contact_name || client?.name || "");
      setSubject(`Invoice ${invoice.invoice_number} from ${settings?.company_name || "us"}`);
      setMessage(`Please find attached Invoice ${invoice.invoice_number} for $${Number(invoice.total).toFixed(2)}.`);
    }
  }, [open, invoice, client, settings]);

  if (!invoice) return null;

  const handleSend = async () => {
    if (!email) {
      toast({ title: "Email address is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoiceId: invoice.id,
          recipientEmail: email,
          recipientName,
          subject,
          message,
        },
      });
      if (res.error) throw res.error;
      toast({ title: "Invoice sent successfully!" });
      onSent?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Invoice {invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" required />
          </div>
          <div className="space-y-2">
            <Label>Recipient Name</Label>
            <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>Cancel</Button>
            <Button onClick={handleSend} className="flex-1" disabled={loading || !email}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Invoice</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
