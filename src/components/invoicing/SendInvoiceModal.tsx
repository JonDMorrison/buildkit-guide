import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceSettings, Client } from "@/types/invoicing";
import { FinancialIntegrityGate } from "@/components/FinancialIntegrityGate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (raw: string): string[] =>
  raw.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);

const validateEmails = (raw: string): { valid: string[]; invalid: string[] } => {
  const all = parseEmails(raw);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const e of all) {
    (EMAIL_RE.test(e) ? valid : invalid).push(e);
  }
  return { valid, invalid };
};

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
  const [gateOpen, setGateOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoice) {
      const snapshotEmails = invoice.send_to_emails;
      const fallbackEmail = client?.ap_email || client?.email || "";
      setEmail(snapshotEmails || fallbackEmail);
      setRecipientName(client?.ap_contact_name || client?.contact_name || client?.name || "");
      setSubject(`Invoice ${invoice.invoice_number} from ${settings?.company_name || "us"}`);
      setMessage(`Please find attached Invoice ${invoice.invoice_number} for $${Number(invoice.total).toFixed(2)}.`);
    }
  }, [open, invoice, client, settings]);

  if (!invoice) return null;

  const { valid: validEmails, invalid: invalidEmails } = validateEmails(email);

  const executeSend = async () => {
    setLoading(true);
    try {
      const primaryEmail = validEmails[0];
      const res = await supabase.functions.invoke("send-invoice-email", {
        body: {
          invoiceId: invoice.id,
          recipientEmail: primaryEmail,
          recipientName,
          subject,
          message,
          ccEmails: validEmails.slice(1),
        },
      });
      if (res.error) throw res.error;

      const { error: rpcError } = await supabase.rpc('rpc_send_invoice', {
        p_invoice_id: invoice.id,
      });
      if (rpcError) throw rpcError;

      await supabase
        .from('invoices')
        .update({ send_to_emails: validEmails.join(", ") })
        .eq('id', invoice.id);

      toast({ title: "Invoice sent successfully!" });
      onSent?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Failed to send", description: msg, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSend = () => {
    if (!validEmails.length) {
      toast({ title: "At least one valid email address is required", variant: "destructive" });
      return;
    }
    if (invalidEmails.length) {
      toast({ title: "Fix invalid email addresses before sending", description: invalidEmails.join(", "), variant: "destructive" });
      return;
    }
    // Trigger integrity gate
    setGateOpen(true);
  };

  // Derive projectId from invoice
  const projectId = invoice.project_id;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice {invoice.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Email(s) *</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ap@client.com, billing@client.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas
              </p>
              {invalidEmails.length > 0 && (
                <Alert variant="destructive" className="py-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    Invalid: {invalidEmails.join(", ")}
                  </AlertDescription>
                </Alert>
              )}
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
              <Button onClick={handleSend} className="flex-1" disabled={loading || !validEmails.length}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Invoice</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {projectId && gateOpen && (
        <FinancialIntegrityGate
          projectId={projectId}
          checkpoint="invoice_send"
          open={gateOpen}
          onProceed={() => {
            setGateOpen(false);
            executeSend();
          }}
          onCancel={() => setGateOpen(false)}
        />
      )}
    </>
  );
};
