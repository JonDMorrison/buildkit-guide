import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoicePayments } from "@/hooks/useInvoicePayments";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { ClientFormModal } from "@/components/invoicing/ClientFormModal";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";
import { InvoiceDetailModal } from "@/components/invoicing/InvoiceDetailModal";
import { RecordPaymentModal } from "@/components/invoicing/RecordPaymentModal";
import { SendInvoiceModal } from "@/components/invoicing/SendInvoiceModal";
import { RecurringTemplateModal } from "@/components/invoicing/RecurringTemplateModal";
import { AgingReport } from "@/components/invoicing/AgingReport";
import { LogoUpload } from "@/components/invoicing/LogoUpload";
import { generateInvoicePDF } from "@/components/invoicing/InvoicePDFExport";
import { NoAccess } from "@/components/NoAccess";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Users, FileText, Settings, Send, CheckCircle2, Ban,
  Copy, DollarSign, BarChart3, RefreshCw, CreditCard, Mail,
  Trash2, Pencil, Search, Download,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceLineItem, Client, RecurringInvoiceTemplate } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

/** Compute display status: if sent and past due, show as overdue */
const getDisplayStatus = (inv: Invoice): string => {
  if (inv.status === "sent" && inv.due_date && isPast(parseISO(inv.due_date))) {
    return "overdue";
  }
  return inv.status;
};

const Invoicing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole } = useOrganizationRole();
  const { clients, loading: clientsLoading, createClient, updateClient } = useClients();
  const {
    invoices, loading: invoicesLoading, settings,
    createInvoice, updateInvoice, updateSettings, fetchInvoices,
    fetchLineItems, saveLineItems, deleteInvoice,
  } = useInvoices();
  const { addPayment } = useInvoicePayments();
  const { templates, loading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useRecurringInvoices();
  const { toast } = useToast();

  const prefillData = location.state as { prefillLineItems?: any[]; prefillProjectId?: string } | null;

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(!!prefillData?.prefillLineItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lineItemsCache, setLineItemsCache] = useState<Record<string, InvoiceLineItem[]>>({});

  // Detail modal
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailLineItems, setDetailLineItems] = useState<InvoiceLineItem[]>([]);
  const [showDetail, setShowDetail] = useState(false);

  // Payment modal
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Send email modal
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);
  const [showSend, setShowSend] = useState(false);

  // Recurring template modal
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringInvoiceTemplate | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: string; invoice?: Invoice; templateId?: string } | null>(null);

  // Settings form + dirty tracking
  const [settingsForm, setSettingsForm] = useState({
    company_name: "", company_address: "", invoice_prefix: "INV-",
    tax_rate: "0", tax_label: "Tax", default_payment_terms: "Net 30",
    notes_template: "", logo_url: "" as string | null,
    payment_instructions: "", currency: "CAD", from_email: "",
  });
  const settingsSnapshot = useRef("");

  // Role gating — only admin and pm can access invoicing
  const canAccess = orgRole === "admin" || orgRole === "pm";

  // Clear navigation state
  useEffect(() => {
    if (prefillData?.prefillLineItems) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  // Org-scoped projects query (fix 4B)
  useEffect(() => {
    if (!activeOrganizationId) return;
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects").select("id, name")
        .eq("is_deleted", false)
        .eq("organization_id", activeOrganizationId)
        .order("name");
      setProjects(data || []);
    };
    fetchProjects();
  }, [activeOrganizationId]);

  useEffect(() => {
    if (settings) {
      const form = {
        company_name: settings.company_name || "",
        company_address: settings.company_address || "",
        invoice_prefix: settings.invoice_prefix || "INV-",
        tax_rate: String(settings.tax_rate || 0),
        tax_label: settings.tax_label || "Tax",
        default_payment_terms: settings.default_payment_terms || "Net 30",
        notes_template: settings.notes_template || "",
        logo_url: settings.logo_url || null,
        payment_instructions: settings.payment_instructions || "",
        currency: (settings as any).currency || "CAD",
        from_email: (settings as any).from_email || "",
      };
      setSettingsForm(form);
      settingsSnapshot.current = JSON.stringify(form);
    }
  }, [settings]);

  const settingsDirty = JSON.stringify(settingsForm) !== settingsSnapshot.current;

  // Currency symbol helper
  const currencySymbol = settingsForm.currency === "USD" ? "$" : settingsForm.currency === "EUR" ? "€" : settingsForm.currency === "GBP" ? "£" : "$";

  // Search + status filter with overdue auto-detection
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const displayStatus = getDisplayStatus(inv);
      if (statusFilter !== "all" && displayStatus !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = inv.invoice_number?.toLowerCase().includes(q);
        const matchClient = inv.client?.name?.toLowerCase().includes(q);
        const matchProject = inv.project?.name?.toLowerCase().includes(q);
        if (!matchNum && !matchClient && !matchProject) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  const handleStatusChange = async (invoice: Invoice, newStatus: string) => {
    const updates: Partial<Invoice> = { status: newStatus as any };
    if (newStatus === "sent") updates.sent_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    await updateInvoice(invoice.id, updates);
    toast({ title: `Invoice marked as ${newStatus}` });
  };

  const handleSaveSettings = async () => {
    await updateSettings({
      company_name: settingsForm.company_name || null,
      company_address: settingsForm.company_address || null,
      invoice_prefix: settingsForm.invoice_prefix,
      tax_rate: parseFloat(settingsForm.tax_rate) || 0,
      tax_label: settingsForm.tax_label,
      default_payment_terms: settingsForm.default_payment_terms,
      notes_template: settingsForm.notes_template || null,
      logo_url: settingsForm.logo_url || null,
      payment_instructions: settingsForm.payment_instructions || null,
      currency: settingsForm.currency,
      from_email: settingsForm.from_email || null,
    } as any);
    settingsSnapshot.current = JSON.stringify(settingsForm);
    toast({ title: "Settings saved" });
  };

  const loadLineItems = async (invoiceId: string) => {
    if (lineItemsCache[invoiceId]) return lineItemsCache[invoiceId];
    const items = await fetchLineItems(invoiceId);
    setLineItemsCache((c) => ({ ...c, [invoiceId]: items }));
    return items;
  };

  const triggerPDF = async (invoice: Invoice) => {
    const items = await loadLineItems(invoice.id);
    const client = clients.find((c) => c.id === invoice.client_id) || null;
    generateInvoicePDF(invoice, items, settings, client);
  };

  const openDetail = async (invoice: Invoice) => {
    const items = await loadLineItems(invoice.id);
    setDetailInvoice(invoice);
    setDetailLineItems(items);
    setShowDetail(true);
  };

  const handleDetailSaveLineItems = async (invoiceId: string, items: Partial<InvoiceLineItem>[]) => {
    await saveLineItems(invoiceId, items);
    setLineItemsCache((c) => { const n = { ...c }; delete n[invoiceId]; return n; });
  };

  const handleDetailSaved = async () => {
    await fetchInvoices();
    if (detailInvoice) {
      const freshItems = await fetchLineItems(detailInvoice.id);
      setLineItemsCache((c) => ({ ...c, [detailInvoice.id]: freshItems }));
      setDetailLineItems(freshItems);
      // Re-fetch the invoice data
      const fresh = invoices.find(i => i.id === detailInvoice.id);
      if (fresh) setDetailInvoice(fresh);
    }
  };

  // Clone invoice
  const handleClone = async (invoice: Invoice) => {
    const items = await loadLineItems(invoice.id);
    const cloned = await createInvoice(
      {
        client_id: invoice.client_id,
        project_id: invoice.project_id,
        issue_date: format(new Date(), "yyyy-MM-dd"),
        subtotal: invoice.subtotal,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        notes: invoice.notes,
      },
      items.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        category: li.category,
      }))
    );
    if (cloned) toast({ title: "Invoice cloned as new draft" });
  };

  // Create credit note (with confirmation)
  const handleCreditNote = async (invoice: Invoice) => {
    const items = await loadLineItems(invoice.id);
    const cn = await createInvoice(
      {
        client_id: invoice.client_id,
        project_id: invoice.project_id,
        issue_date: format(new Date(), "yyyy-MM-dd"),
        subtotal: -Math.abs(Number(invoice.subtotal)),
        tax_amount: -Math.abs(Number(invoice.tax_amount)),
        total: -Math.abs(Number(invoice.total)),
        notes: `Credit note for ${invoice.invoice_number}`,
        credit_note_for: invoice.id,
      },
      items.map((li) => ({
        description: `[CREDIT] ${li.description}`,
        quantity: li.quantity,
        unit_price: -Math.abs(Number(li.unit_price)),
        category: li.category,
      }))
    );
    if (cn) toast({ title: "Credit note created" });
  };

  const handleRecordPayment = async (invoiceId: string, payment: any) => {
    const result = await addPayment(invoiceId, payment);
    if (result) {
      await fetchInvoices();
      toast({ title: "Payment recorded" });
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, invoice, templateId } = confirmAction;
    if (type === "void" && invoice) await handleStatusChange(invoice, "void");
    if (type === "credit_note" && invoice) await handleCreditNote(invoice);
    if (type === "delete_template" && templateId) await deleteTemplate(templateId);
    if (type === "delete_invoice" && invoice) {
      await deleteInvoice(invoice.id);
      toast({ title: "Draft invoice deleted" });
    }
    setConfirmAction(null);
  };

  // Client invoice summaries (2F)
  const clientSummaries = useMemo(() => {
    const map = new Map<string, { count: number; totalBilled: number; outstanding: number }>();
    for (const inv of invoices) {
      if (!inv.client_id) continue;
      const entry = map.get(inv.client_id) || { count: 0, totalBilled: 0, outstanding: 0 };
      entry.count++;
      entry.totalBilled += Number(inv.total);
      const ds = getDisplayStatus(inv);
      if (ds === "sent" || ds === "overdue") {
        entry.outstanding += Number(inv.total) - Number(inv.amount_paid || 0);
      }
      map.set(inv.client_id, entry);
    }
    return map;
  }, [invoices]);

  if (!canAccess) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Invoicing" />

        <Tabs defaultValue="invoices" className="space-y-4">
          <TooltipProvider>
            <TabsList className="flex-wrap">
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Invoices</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Invoices</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Clients</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Clients</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="aging"><BarChart3 className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">AR Aging</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">AR Aging</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="recurring"><RefreshCw className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Recurring</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Recurring</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Settings</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Settings</TooltipContent></Tooltip>
            </TabsList>
          </TooltipProvider>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div className="flex gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setShowCreateInvoice(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            </div>

            {invoicesLoading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No invoices match your search." : "No invoices yet. Create your first invoice to get started."}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop table */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((inv) => {
                          const displayStatus = getDisplayStatus(inv);
                          const sc = statusConfig[displayStatus] || statusConfig.draft;
                          const balance = Number(inv.total) - Number(inv.amount_paid || 0);
                          const isCreditNote = !!inv.credit_note_for;
                          return (
                            <TableRow key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                              <TableCell className="font-medium">
                                {inv.invoice_number}
                                {isCreditNote && <Badge variant="outline" className="ml-1 text-xs">CN</Badge>}
                              </TableCell>
                              <TableCell>{inv.client?.name || "—"}</TableCell>
                              <TableCell>{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                              <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                              <TableCell className="text-right font-medium">{fmt(Number(inv.total))}</TableCell>
                              <TableCell className="text-right">
                                {balance > 0 ? fmt(balance) : "—"}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end flex-wrap">
                                  {/* Send — allowed for draft, sent, overdue (1B fix) */}
                                  {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && (
                                    <Button variant="ghost" size="sm" onClick={() => { setSendInvoice(inv); setShowSend(true); }} title="Send via email">
                                      <Mail className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {(displayStatus === "sent" || displayStatus === "overdue") && (
                                    <Button variant="ghost" size="sm" onClick={() => { setPaymentInvoice(inv); setShowPayment(true); }} title="Record payment">
                                      <DollarSign className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {/* Void — with confirmation (1A) */}
                                  {displayStatus !== "void" && displayStatus !== "paid" && !isCreditNote && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "void", invoice: inv })} title="Void">
                                      <Ban className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => handleClone(inv)} title="Clone">
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  {/* Credit note — with confirmation (1A) */}
                                  {(displayStatus === "paid" || displayStatus === "sent") && !isCreditNote && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "credit_note", invoice: inv })} title="Credit note">
                                      <CreditCard className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {/* Delete draft (2C) */}
                                  {inv.status === "draft" && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "delete_invoice", invoice: inv })} title="Delete draft">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => triggerPDF(inv)} title="PDF">
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Mobile card layout (3A) */}
                <div className="md:hidden space-y-2">
                  {filteredInvoices.map((inv) => {
                    const displayStatus = getDisplayStatus(inv);
                    const sc = statusConfig[displayStatus] || statusConfig.draft;
                    const balance = Number(inv.total) - Number(inv.amount_paid || 0);
                    const isCreditNote = !!inv.credit_note_for;
                    return (
                      <Card key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">{inv.invoice_number}{isCreditNote ? " (CN)" : ""}</p>
                              <p className="text-xs text-muted-foreground">{inv.client?.name || "No client"}</p>
                            </div>
                            <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), "MMM d, yyyy")}</span>
                            <div className="text-right">
                              <p className="font-bold text-sm">{fmt(Number(inv.total))}</p>
                              {balance > 0 && balance < Number(inv.total) && (
                                <p className="text-xs text-muted-foreground">Due: {fmt(balance)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 mt-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && (
                              <Button variant="ghost" size="sm" onClick={() => { setSendInvoice(inv); setShowSend(true); }}><Mail className="h-3.5 w-3.5" /></Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => triggerPDF(inv)}><FileText className="h-3.5 w-3.5" /></Button>
                            {(displayStatus === "sent" || displayStatus === "overdue") && (
                              <Button variant="ghost" size="sm" onClick={() => { setPaymentInvoice(inv); setShowPayment(true); }}><DollarSign className="h-3.5 w-3.5" /></Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Draft", filter: "draft" },
                { label: "Sent", filter: "sent" },
                { label: "Paid", filter: "paid" },
                { label: "Overdue", filter: "overdue" },
              ].map(({ label, filter }) => {
                const group = invoices.filter((i) => getDisplayStatus(i) === filter);
                const count = group.length;
                const sum = group.reduce((s, i) => s + Number(i.total), 0);
                return (
                  <Card key={filter}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{fmt(sum)}</div>
                      <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* CLIENTS TAB — with invoice summary columns (2F) */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingClient(null); setShowClientModal(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Client
              </Button>
            </div>
            {clientsLoading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : clients.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No clients yet. Add your first client to start invoicing.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Contact</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Billed</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Outstanding</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((c) => {
                        const summary = clientSummaries.get(c.id);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="hidden md:table-cell">{c.contact_name || "—"}</TableCell>
                            <TableCell className="hidden md:table-cell">{c.email || "—"}</TableCell>
                            <TableCell className="text-right">{summary?.count || 0}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">{summary ? fmt(summary.totalBilled) : "—"}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">{summary?.outstanding ? fmt(summary.outstanding) : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingClient(c); setShowClientModal(true); }}>Edit</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AR AGING TAB */}
          <TabsContent value="aging">
            <AgingReport invoices={invoices} clients={clients} currencySymbol={currencySymbol} />
          </TabsContent>

          {/* RECURRING TAB */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Recurring invoice templates for automated billing cycles.</p>
              <Button onClick={() => { setEditingTemplate(null); setShowRecurringModal(true); }}>
                <Plus className="h-4 w-4 mr-1" /> New Template
              </Button>
            </div>
            {templatesLoading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No recurring templates. Create one to automate your billing.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next Issue</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.client?.name || "—"}</TableCell>
                          <TableCell className="capitalize">{t.frequency}</TableCell>
                          <TableCell>{format(new Date(t.next_issue_date), "MMM d, yyyy")}</TableCell>
                          <TableCell>{(t.line_items || []).length} items</TableCell>
                          <TableCell>
                            <Switch checked={t.is_active} onCheckedChange={(checked) => updateTemplate(t.id, { is_active: checked })} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(t); setShowRecurringModal(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "delete_template", templateId: t.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <LogoUpload
                  currentUrl={settingsForm.logo_url}
                  onUploaded={(url) => setSettingsForm((f) => ({ ...f, logo_url: url }))}
                />
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={settingsForm.company_name} onChange={(e) => setSettingsForm((f) => ({ ...f, company_name: e.target.value }))} placeholder="Your Company Inc." />
                </div>
                <div className="space-y-2">
                  <Label>Company Address</Label>
                  <Input value={settingsForm.company_address} onChange={(e) => setSettingsForm((f) => ({ ...f, company_address: e.target.value }))} placeholder="123 Main St, City, Province" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Prefix</Label>
                    <Input value={settingsForm.invoice_prefix} onChange={(e) => setSettingsForm((f) => ({ ...f, invoice_prefix: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Payment Terms</Label>
                    <Input value={settingsForm.default_payment_terms} onChange={(e) => setSettingsForm((f) => ({ ...f, default_payment_terms: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={settingsForm.tax_rate} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Label</Label>
                    <Input value={settingsForm.tax_label} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_label: e.target.value }))} placeholder="GST" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={settingsForm.currency} onValueChange={(v) => setSettingsForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default Invoice Notes</Label>
                  <Textarea value={settingsForm.notes_template} onChange={(e) => setSettingsForm((f) => ({ ...f, notes_template: e.target.value }))} rows={2} placeholder="Thank you for your business!" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Instructions</Label>
                  <p className="text-xs text-muted-foreground">These instructions appear on every invoice. Include how to pay by cheque, e-transfer, wire, etc.</p>
                  <Textarea
                    value={settingsForm.payment_instructions}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, payment_instructions: e.target.value }))}
                    rows={4}
                    placeholder={"Payment Methods:\n• Cheque: Payable to [Company Name]\n• E-Transfer: payments@company.com\n• Wire: Bank Name, Account #, Transit #\n\nPlease include invoice number with payment."}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email Address</Label>
                  <p className="text-xs text-muted-foreground">Requires a verified sending domain. Leave blank to use the default.</p>
                  <Input value={settingsForm.from_email} onChange={(e) => setSettingsForm((f) => ({ ...f, from_email: e.target.value }))} placeholder="invoices@yourdomain.com" />
                </div>
                <Button onClick={handleSaveSettings} className={settingsDirty ? "ring-2 ring-primary" : ""}>
                  {settingsDirty ? "Save Settings *" : "Save Settings"}
                </Button>
                {settingsDirty && <p className="text-xs text-amber-600">You have unsaved changes.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog (1A) */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "void" && "Void this invoice?"}
                {confirmAction?.type === "credit_note" && "Create a credit note?"}
                {confirmAction?.type === "delete_template" && "Delete this template?"}
                {confirmAction?.type === "delete_invoice" && "Delete this draft?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "void" && `This will permanently void invoice ${confirmAction.invoice?.invoice_number}. This action cannot be undone.`}
                {confirmAction?.type === "credit_note" && `A credit note will be created to offset invoice ${confirmAction.invoice?.invoice_number}.`}
                {confirmAction?.type === "delete_template" && "This recurring template will be permanently deleted."}
                {confirmAction?.type === "delete_invoice" && `Draft invoice ${confirmAction.invoice?.invoice_number} will be permanently deleted.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeConfirmAction}>
                {confirmAction?.type === "void" ? "Void Invoice" : confirmAction?.type === "delete_template" || confirmAction?.type === "delete_invoice" ? "Delete" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modals */}
        <ClientFormModal open={showClientModal} onOpenChange={setShowClientModal} initialData={editingClient}
          onSubmit={async (data) => {
            if (editingClient) { await updateClient(editingClient.id, data); }
            else { await createClient(data); }
            toast({ title: editingClient ? "Client updated" : "Client created" });
          }}
        />
        <CreateInvoiceModal open={showCreateInvoice} onOpenChange={setShowCreateInvoice}
          clients={clients} projects={projects}
          taxRate={settings?.tax_rate || 0} taxLabel={settings?.tax_label || "Tax"}
          defaultPaymentTerms={settings?.default_payment_terms || "Net 30"}
          notesTemplate={settings?.notes_template || ""}
          paymentInstructions={settings?.payment_instructions || ""}
          initialLineItems={prefillData?.prefillLineItems} initialProjectId={prefillData?.prefillProjectId}
          onAddClient={() => { setEditingClient(null); setShowClientModal(true); }}
          onSubmit={async (inv, lines) => { await createInvoice(inv, lines); toast({ title: "Invoice created" }); }}
        />
        <InvoiceDetailModal open={showDetail} onOpenChange={setShowDetail}
          invoice={detailInvoice} lineItems={detailLineItems}
          settings={settings} client={detailInvoice ? clients.find((c) => c.id === detailInvoice.client_id) || null : null}
          onSaveLineItems={handleDetailSaveLineItems} onUpdateInvoice={updateInvoice} onExportPDF={triggerPDF}
          onSaved={handleDetailSaved}
          currencySymbol={currencySymbol}
        />
        <RecordPaymentModal open={showPayment} onOpenChange={setShowPayment}
          invoice={paymentInvoice} onSubmit={handleRecordPayment}
          currencySymbol={currencySymbol}
        />
        <SendInvoiceModal open={showSend} onOpenChange={setShowSend}
          invoice={sendInvoice} settings={settings}
          client={sendInvoice ? clients.find((c) => c.id === sendInvoice.client_id) || null : null}
          onSent={() => fetchInvoices()}
        />
        <RecurringTemplateModal open={showRecurringModal} onOpenChange={setShowRecurringModal}
          clients={clients} projects={projects} initialData={editingTemplate}
          onSubmit={async (data) => {
            if (editingTemplate) { await updateTemplate(editingTemplate.id, data); toast({ title: "Template updated" }); }
            else { await createTemplate(data); toast({ title: "Recurring template created" }); }
          }}
        />
      </div>
    </Layout>
  );
};

export default Invoicing;
