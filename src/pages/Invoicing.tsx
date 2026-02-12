import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoicePayments } from "@/hooks/useInvoicePayments";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { ClientFormModal } from "@/components/invoicing/ClientFormModal";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";
import { InvoiceDetailModal } from "@/components/invoicing/InvoiceDetailModal";
import { RecordPaymentModal } from "@/components/invoicing/RecordPaymentModal";
import { SendInvoiceModal } from "@/components/invoicing/SendInvoiceModal";
import { RecurringTemplateModal } from "@/components/invoicing/RecurringTemplateModal";
import { AgingReport } from "@/components/invoicing/AgingReport";
import { LogoUpload } from "@/components/invoicing/LogoUpload";
import { generateInvoicePDF } from "@/components/invoicing/InvoicePDFExport";

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
  Plus, Users, FileText, Settings, Send, CheckCircle2, Ban,
  Copy, DollarSign, BarChart3, RefreshCw, CreditCard, Mail,
  Trash2, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectRole } from "@/hooks/useProjectRole";
import type { Invoice, InvoiceLineItem, Client, RecurringInvoiceTemplate } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const Invoicing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isGlobalAdmin } = useProjectRole();
  const { clients, loading: clientsLoading, createClient, updateClient } = useClients();
  const {
    invoices, loading: invoicesLoading, settings,
    createInvoice, updateInvoice, updateSettings, fetchInvoices,
    fetchLineItems, saveLineItems,
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

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    company_name: "", company_address: "", invoice_prefix: "INV-",
    tax_rate: "0", tax_label: "Tax", default_payment_terms: "Net 30",
    notes_template: "", logo_url: "" as string | null,
    payment_instructions: "",
  });

  // Clear navigation state
  useEffect(() => {
    if (prefillData?.prefillLineItems) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects").select("id, name").eq("is_deleted", false).order("name");
      setProjects(data || []);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        company_name: settings.company_name || "",
        company_address: settings.company_address || "",
        invoice_prefix: settings.invoice_prefix || "INV-",
        tax_rate: String(settings.tax_rate || 0),
        tax_label: settings.tax_label || "Tax",
        default_payment_terms: settings.default_payment_terms || "Net 30",
        notes_template: settings.notes_template || "",
        logo_url: settings.logo_url || null,
        payment_instructions: settings.payment_instructions || "",
      });
    }
  }, [settings]);

  const filteredInvoices = invoices.filter(
    (inv) => statusFilter === "all" || inv.status === statusFilter
  );

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
    } as any);
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

  // Create credit note
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

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader title="Invoicing" />

        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-1" />Invoices</TabsTrigger>
            <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" />Clients</TabsTrigger>
            <TabsTrigger value="aging"><BarChart3 className="h-4 w-4 mr-1" />AR Aging</TabsTrigger>
            <TabsTrigger value="recurring"><RefreshCw className="h-4 w-4 mr-1" />Recurring</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
          </TabsList>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
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
                  <p>No invoices yet. Create your first invoice to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
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
                        const sc = statusConfig[inv.status] || statusConfig.draft;
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
                            <TableCell className="text-right font-medium">
                              ${Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {balance > 0 ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end flex-wrap">
                                {inv.status === "draft" && (
                                  <Button variant="ghost" size="sm" onClick={() => { setSendInvoice(inv); setShowSend(true); }} title="Send via email">
                                    <Mail className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {(inv.status === "sent" || inv.status === "overdue") && (
                                  <Button variant="ghost" size="sm" onClick={() => { setPaymentInvoice(inv); setShowPayment(true); }} title="Record payment">
                                    <DollarSign className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {inv.status !== "void" && inv.status !== "paid" && !isCreditNote && (
                                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(inv, "void")} title="Void">
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => handleClone(inv)} title="Clone">
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                {(inv.status === "paid" || inv.status === "sent") && !isCreditNote && (
                                  <Button variant="ghost" size="sm" onClick={() => handleCreditNote(inv)} title="Credit note">
                                    <CreditCard className="h-3.5 w-3.5" />
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
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Draft", filter: "draft" },
                { label: "Sent", filter: "sent" },
                { label: "Paid", filter: "paid" },
                { label: "Overdue", filter: "overdue" },
              ].map(({ label, filter }) => {
                const group = invoices.filter((i) => i.status === filter);
                const count = group.length;
                const sum = group.reduce((s, i) => s + Number(i.total), 0);
                return (
                  <Card key={filter}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">${sum.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                      <p className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? "s" : ""}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* CLIENTS TAB */}
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
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.contact_name || "—"}</TableCell>
                          <TableCell>{c.email || "—"}</TableCell>
                          <TableCell>{c.phone || "—"}</TableCell>
                          <TableCell>{c.city || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingClient(c); setShowClientModal(true); }}>Edit</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* AR AGING TAB */}
          <TabsContent value="aging">
            <AgingReport invoices={invoices} clients={clients} />
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
                              <Button variant="ghost" size="sm" onClick={() => deleteTemplate(t.id)}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={settingsForm.tax_rate} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Label</Label>
                    <Input value={settingsForm.tax_label} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_label: e.target.value }))} placeholder="GST" />
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
                <Button onClick={handleSaveSettings}>Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
        />
        <RecordPaymentModal open={showPayment} onOpenChange={setShowPayment}
          invoice={paymentInvoice} onSubmit={handleRecordPayment}
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
