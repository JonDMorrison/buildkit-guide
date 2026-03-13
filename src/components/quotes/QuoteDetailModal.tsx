import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuotes } from "@/hooks/useQuotes";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Send, XCircle, Lock, ArrowRightLeft, Mail, AlertTriangle, ChevronDown, Bug, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Quote, QuoteLineItem } from "@/types/quotes";

interface Props {
  quote: Quote;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

interface QuoteEvent {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
  actor_user_id: string;
  metadata: Record<string, any>;
  actor_name?: string;
}

const fmt = (v: number, currency = "CAD") =>
  `${new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(v)} ${currency}`;

export const QuoteDetailModal = ({ quote, canEdit, onClose, onUpdated }: Props) => {
  const {
    fetchLineItems, approveQuote, markSent, rejectQuote,
    convertToInvoice, getConvertedInvoiceId,
  } = useQuotes();
  const { role: orgRole } = useOrganizationRole();
  const navigate = useNavigate();

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [converting, setConverting] = useState(false);
  const [events, setEvents] = useState<QuoteEvent[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);

  const showDebug = orgRole === 'admin' || orgRole === 'pm';

  // Canonical conversion check — uses quotes.converted_invoice_id
  const convertedInvoiceId = getConvertedInvoiceId(quote);
  const isConverted = !!convertedInvoiceId;

  useEffect(() => {
    const load = async () => {
      const items = await fetchLineItems(quote.id);
      setLineItems(items);

      // Load events with actor profiles
      const { data: evts } = await supabase
        .from('quote_events' as any)
        .select('*')
        .eq('quote_id', quote.id)
        .order('created_at', { ascending: false });

      const rawEvents = (evts as unknown as QuoteEvent[]) || [];

      // Fetch actor names
      const actorIds = [...new Set(rawEvents.map(e => e.actor_user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', actorIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Unknown']));
        }
      }

      setEvents(rawEvents.map(e => ({ ...e, actor_name: profileMap[e.actor_user_id] || 'System' })));

      setLoading(false);
    };
    load();
  }, [quote.id]);

  const isDraft = quote.status === "draft";
  const isSent = quote.status === "sent";
  const isApproved = quote.status === "approved";

  const handleConvert = async () => {
    setConverting(true);
    const invoiceId = await convertToInvoice(quote.id);
    setConverting(false);
    if (invoiceId) {
      onUpdated();
      navigate("/invoicing");
    }
  };

  // Debug: conversion readiness
  const conversionReadiness = {
    approved: quote.status === 'approved',
    hasLineItems: lineItems.length > 0,
    hasProject: !!quote.project_id,
    pmEmail: quote.customer_pm_email || null,
    apEmail: quote.bill_to_ap_email || null,
    billToName: quote.bill_to_name || null,
    billToAddress: quote.bill_to_address || null,
    shipToAddress: quote.ship_to_address || null,
    parentClientId: quote.parent_client_id || null,
    clientId: quote.client_id || null,
    convertedInvoiceId,
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

          {/* Pipeline breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span>Estimate</span>
            <ArrowRight className="h-3 w-3" />
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span>Proposal</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Quote</span>
            <ArrowRight className="h-3 w-3" />
            <span>Invoice</span>
          </div>

          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Customer</p>
                <p className="font-semibold">{quote.client?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Project</p>
                <p className="font-semibold">
                  {quote.project ? `${quote.project.job_number ? quote.project.job_number + " — " : ""}${quote.project.name}` : "—"}
                </p>
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
              <div>
                <p className="text-muted-foreground text-xs">Quote Recipient (PM)</p>
                <p className="flex items-center gap-1 text-sm">
                  <Mail className="h-3 w-3 text-primary" /> {quote.customer_pm_email || "—"}
                </p>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
                <p>{quote.bill_to_name || "—"}</p>
                <p className="text-muted-foreground">{quote.bill_to_address || ""}</p>
                {quote.bill_to_ap_email && (
                  <p className="text-xs mt-1 flex items-center gap-1">
                    <Mail className="h-3 w-3 text-amber-500" />
                    <span className="text-muted-foreground">Invoice Recipient (AP):</span> {quote.bill_to_ap_email}
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
            {isConverted && (
              <Alert>
                <ArrowRightLeft className="h-4 w-4" />
                <AlertTitle>Converted to Invoice</AlertTitle>
                <AlertDescription>
                  Invoice ID: {convertedInvoiceId}.{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => { onClose(); navigate("/invoicing"); }}>
                    View Invoice →
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Conversion Preview Panel (for approved, unconverted quotes) */}
            {isApproved && !isConverted && canEdit && (
              <Card className="border-dashed">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-semibold">Conversion Preview</p>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bill To (from parent client)</p>
                      <p>{quote.bill_to_name || "—"}</p>
                      <p className="text-muted-foreground">{quote.bill_to_address || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-1">Ship To (from project)</p>
                      <p>{quote.ship_to_name || "—"}</p>
                      <p className="text-muted-foreground">{quote.ship_to_address || "—"}</p>
                    </div>
                  </div>
                  <Alert variant="default" className="border-accent/30">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    <AlertTitle className="text-sm">Email Recipient Swap</AlertTitle>
                    <AlertDescription className="text-xs space-y-1">
                      <p><strong>Quote sent to:</strong> {quote.customer_pm_email || "No PM email"} <span className="text-muted-foreground">(Project Manager)</span></p>
                      <p><strong>Invoice will go to:</strong> {quote.bill_to_ap_email || "No AP email"} <span className="text-muted-foreground">(Accounts Payable)</span></p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Audit Trail */}
            {events.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Activity</p>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {events.map(evt => {
                    const hasMetadata = evt.metadata && Object.keys(evt.metadata).length > 0;
                    const eventColor =
                      evt.event_type === 'approved' ? 'text-emerald-600 dark:text-emerald-400' :
                      evt.event_type === 'rejected' ? 'text-destructive' :
                      evt.event_type === 'converted' ? 'text-primary' :
                      evt.event_type === 'line_item_added' || evt.event_type === 'line_item_updated' || evt.event_type === 'line_item_deleted' ? 'text-blue-600 dark:text-blue-400' :
                      'text-muted-foreground';

                    return (
                      <div key={evt.id} className="border-l-2 border-border pl-3 py-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">
                            {format(new Date(evt.created_at), "MMM d, yyyy · HH:mm")}
                          </span>
                          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", eventColor)}>
                            {evt.event_type}
                          </Badge>
                        </div>
                        <div className="mt-0.5 ml-5 text-xs">
                          <span className="font-medium text-foreground">{evt.actor_name}</span>
                          {evt.message && (
                            <span className="text-muted-foreground"> — {evt.message}</span>
                          )}
                        </div>
                        {hasMetadata && showDebug && (
                          <Collapsible>
                            <CollapsibleTrigger className="ml-5 mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <ChevronDown className="h-3 w-3" /> Raw metadata
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="ml-5 mt-1 text-[10px] bg-muted/50 rounded p-2 overflow-auto max-h-[100px] whitespace-pre-wrap break-all">
                                {JSON.stringify(evt.metadata, null, 2)}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Debug Panel */}
            {showDebug && (
              <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground gap-2">
                    <Bug className="h-4 w-4" />
                    Conversion Check
                    <ChevronDown className={cn('h-4 w-4 transition-transform', debugOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Card className="mt-2">
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status = approved?</span>
                          <span className={conversionReadiness.approved ? "text-emerald-500" : "text-destructive"}>
                            {conversionReadiness.approved ? "✓ Yes" : "✗ No"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Has line items?</span>
                          <span className={conversionReadiness.hasLineItems ? "text-emerald-500" : "text-destructive"}>
                            {conversionReadiness.hasLineItems ? `✓ ${lineItems.length}` : "✗ No"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Has project?</span>
                          <span className={conversionReadiness.hasProject ? "text-emerald-500" : "text-destructive"}>
                            {conversionReadiness.hasProject ? "✓ Yes" : "✗ No"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quote PM Email</span>
                          <span>{conversionReadiness.pmEmail || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoice AP Email</span>
                          <span>{conversionReadiness.apEmail || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bill-to client</span>
                          <span>{conversionReadiness.parentClientId ? "parent" : conversionReadiness.clientId ? "direct" : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ship-to source</span>
                          <span>{conversionReadiness.shipToAddress ? "project.location" : "—"}</span>
                        </div>
                      </div>
                      {conversionReadiness.convertedInvoiceId && (
                        <div className="text-xs pt-2 border-t">
                          <span className="text-muted-foreground">Converted Invoice ID: </span>
                          <Button variant="link" className="p-0 h-auto text-xs" onClick={() => { onClose(); navigate("/invoicing"); }}>
                            {conversionReadiness.convertedInvoiceId}
                          </Button>
                        </div>
                      )}
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(conversionReadiness, null, 2))}
                        >
                          Copy JSON
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
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
