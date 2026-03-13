import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { Layout } from "@/components/Layout";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoicePayments } from "@/hooks/useInvoicePayments";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useInvoiceActivity } from "@/hooks/useInvoiceActivity";
import { ClientFormModal } from "@/components/invoicing/ClientFormModal";
import { CreateInvoiceModal } from "@/components/invoicing/CreateInvoiceModal";
import { InvoiceDetailModal } from "@/components/invoicing/InvoiceDetailModal";
import { RecordPaymentModal } from "@/components/invoicing/RecordPaymentModal";
import { SendInvoiceModal } from "@/components/invoicing/SendInvoiceModal";
import { RecurringTemplateModal } from "@/components/invoicing/RecurringTemplateModal";
import { AgingReport } from "@/components/invoicing/AgingReport";
import { LogoUpload } from "@/components/invoicing/LogoUpload";
import { InvoiceDashboardMetrics } from "@/components/invoicing/InvoiceDashboardMetrics";
import { InvoiceApprovalActions } from "@/components/invoicing/InvoiceApprovalActions";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Users, FileText, Settings, Send, CheckCircle2, Ban, Clock,
  Copy, DollarSign, BarChart3, RefreshCw, CreditCard, Mail,
  Trash2, Pencil, Search, Download, ShieldCheck, Activity,
  CheckSquare, XCircle, AlertTriangle, ChevronDown, ChevronRight, ArrowRightLeft, ArrowLeft,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, isPast, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceLineItem, Client, RecurringInvoiceTemplate, ApprovalStatus } from "@/types/invoicing";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const getDisplayStatus = (inv: Invoice): string => {
  if (inv.status === "sent" && inv.due_date && isPast(parseISO(inv.due_date))) return "overdue";
  return inv.status;
};

const invoiceTypeLabels: Record<string, string> = {
  standard: "Standard",
  progress: "Progress",
  deposit: "Deposit",
  retainage_release: "Holdback Release",
};

const Invoicing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { clients, loading: clientsLoading, createClient, updateClient } = useClients();
  const {
    invoices, loading: invoicesLoading, settings,
    createInvoice, updateInvoice, updateSettings, fetchInvoices,
    fetchLineItems, saveLineItems, deleteInvoice,
  } = useInvoices();
  const { addPayment } = useInvoicePayments();
  const { templates, loading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useRecurringInvoices();
  const { logActivity } = useInvoiceActivity();
  const { toast } = useToast();

  const prefillData = location.state as { prefillLineItems?: InvoiceLineItem[]; prefillProjectId?: string } | null;

  const [projects, setProjects] = useState<{ id: string; name: string; client_id?: string | null; location?: string | null }[]>([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(!!prefillData?.prefillLineItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lineItemsCache, setLineItemsCache] = useState<Record<string, InvoiceLineItem[]>>({});
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

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

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{ type: string; invoice?: Invoice; templateId?: string } | null>(null);

  // Settings form + dirty tracking
  const [settingsForm, setSettingsForm] = useState({
    company_name: "", company_address: "", invoice_prefix: "INV-",
    tax_rate: "0", tax_label: "Tax", default_payment_terms: "Net 30",
    notes_template: "", logo_url: "" as string | null,
    payment_instructions: "", currency: "CAD", from_email: "",
    tax2_rate: "0", tax2_label: "",
    default_retainage_percent: "0",
    require_approval: false,
    reminder_enabled: false,
    reminder_days: "7,14,30",
  });
  const settingsSnapshot = useRef("");

  // Invoice send permissions (from organization_settings)
  const ALL_ROLES = ["admin", "pm", "hr", "foreman", "internal_worker", "external_trade"] as const;
  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin", pm: "Project Manager", hr: "Accounting/HR",
    foreman: "Foreman", internal_worker: "Internal Worker", external_trade: "External Trade",
  };
  const [invoiceSendSettings, setInvoiceSendSettings] = useState({
    invoice_send_roles: ["admin"] as string[],
    invoice_send_requires_approval: true,
    invoice_send_approver_roles: ["admin"] as string[],
    invoice_send_blocked_message: "Invoice requires approval before sending.",
  });
  const [sendSettingsLoaded, setSendSettingsLoaded] = useState(false);

  // Also check global admin from useUserRole via useAuthRole
  const { isAdmin: isGlobalAdmin } = useAuthRole();
  const canAccess = isGlobalAdmin || orgRole === "admin" || orgRole === "pm";
  const isAdmin = isGlobalAdmin || orgRole === "admin";
  const canSendInvoice = isGlobalAdmin || (orgRole && invoiceSendSettings.invoice_send_roles.includes(orgRole));
  const canApproveInvoice = isGlobalAdmin || (orgRole && invoiceSendSettings.invoice_send_approver_roles.includes(orgRole));
  const sendRequiresApproval = invoiceSendSettings.invoice_send_requires_approval;

  useEffect(() => {
    if (prefillData?.prefillLineItems) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  useEffect(() => {
    if (!activeOrganizationId) return;
    const fetchProjects = async () => {
      const { data } = await supabase
        .from("projects").select("id,name,client_id,location")
        .eq("is_deleted", false)
        .eq("organization_id", activeOrganizationId)
        .order("name");
      setProjects((data as { id: string; name: string; client_id?: string | null; location?: string | null }[]) || []);
    };
    const fetchSendSettings = async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("invoice_send_roles,invoice_send_requires_approval,invoice_send_approver_roles,invoice_send_blocked_message")
        .eq("organization_id", activeOrganizationId)
        .single();
      if (data) {
        setInvoiceSendSettings({
          invoice_send_roles: (data.invoice_send_roles as string[]) || ["admin"],
          invoice_send_requires_approval: data.invoice_send_requires_approval ?? true,
          invoice_send_approver_roles: (data.invoice_send_approver_roles as string[]) || ["admin"],
          invoice_send_blocked_message: data.invoice_send_blocked_message || "Invoice requires approval before sending.",
        });
      }
      setSendSettingsLoaded(true);
    };
    fetchProjects();
    fetchSendSettings();
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
        currency: settings.currency || "CAD",
        from_email: settings.from_email || "",
        tax2_rate: String(settings.tax2_rate || 0),
        tax2_label: settings.tax2_label || "",
        default_retainage_percent: String(settings.default_retainage_percent || 0),
        require_approval: !!settings.require_approval,
        reminder_enabled: !!settings.reminder_enabled,
        reminder_days: (settings.reminder_days || [7, 14, 30]).join(","),
      };
      setSettingsForm(form);
      settingsSnapshot.current = JSON.stringify(form);
    }
  }, [settings]);

  const settingsDirty = JSON.stringify(settingsForm) !== settingsSnapshot.current;
  const currencySymbol = "$";
  
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const displayStatus = getDisplayStatus(inv);
      if (statusFilter !== "all" && displayStatus !== statusFilter) return false;
      if (approvalFilter !== "all") {
        const as = (inv.approval_status || "none") as string;
        if (approvalFilter !== as) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = inv.invoice_number?.toLowerCase().includes(q);
        const matchClient = inv.client?.name?.toLowerCase().includes(q);
        const matchProject = inv.project?.name?.toLowerCase().includes(q);
        const matchPO = inv.po_number?.toLowerCase().includes(q);
        if (!matchNum && !matchClient && !matchProject && !matchPO) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, approvalFilter, searchQuery]);

  const handleStatusChange = async (invoice: Invoice, newStatus: string) => {
    const updates: Partial<Invoice> = { status: newStatus as InvoiceStatus };
    if (newStatus === "sent") updates.sent_at = new Date().toISOString();
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    await updateInvoice(invoice.id, updates);
    await logActivity(invoice.id, "status_changed", `Status changed to ${newStatus}`);
    toast({ title: `Invoice marked as ${newStatus}` });
  };

  const handleSaveSettings = async () => {
    const reminderDays = settingsForm.reminder_days.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d));
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
      tax2_rate: parseFloat(settingsForm.tax2_rate) || 0,
      tax2_label: settingsForm.tax2_label || null,
      default_retainage_percent: parseFloat(settingsForm.default_retainage_percent) || 0,
      require_approval: settingsForm.require_approval,
      reminder_enabled: settingsForm.reminder_enabled,
      reminder_days: reminderDays,
    });
    settingsSnapshot.current = JSON.stringify(settingsForm);
    toast({ title: "Settings saved" });
  };

  const handleSaveSendSettings = async () => {
    if (!activeOrganizationId) return;
    const { error } = await supabase
      .from("organization_settings")
      .update({
        invoice_send_roles: invoiceSendSettings.invoice_send_roles,
        invoice_send_requires_approval: invoiceSendSettings.invoice_send_requires_approval,
        invoice_send_approver_roles: invoiceSendSettings.invoice_send_approver_roles,
        invoice_send_blocked_message: invoiceSendSettings.invoice_send_blocked_message,
      })
      .eq("organization_id", activeOrganizationId);
    if (error) {
      toast({ title: "Failed to save permissions", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invoice sending permissions saved" });
    }
  };

  const handleRequestApproval = async (invoice: Invoice) => {
    const { error } = await supabase.rpc("rpc_request_invoice_approval", { p_invoice_id: invoice.id });
    if (error) {
      toast({ title: "Failed to request approval", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Approval requested", description: `Approvers have been notified for ${invoice.invoice_number}.` });
      await fetchInvoices();
    }
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
    await logActivity(invoiceId, "line_items_updated", "Line items modified");
    setLineItemsCache((c) => { const n = { ...c }; delete n[invoiceId]; return n; });
  };

  const handleDetailSaved = async () => {
    await fetchInvoices();
    if (detailInvoice) {
      const freshItems = await fetchLineItems(detailInvoice.id);
      setLineItemsCache((c) => ({ ...c, [detailInvoice.id]: freshItems }));
      setDetailLineItems(freshItems);
      const fresh = invoices.find(i => i.id === detailInvoice.id);
      if (fresh) setDetailInvoice(fresh);
    }
  };

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
        po_number: invoice.po_number,
        invoice_type: invoice.invoice_type,
        retainage_percent: invoice.retainage_percent,
      },
      items.map((li) => ({ description: li.description, quantity: li.quantity, unit_price: li.unit_price, category: li.category }))
    );
    if (cloned) {
      await logActivity(cloned.id, "cloned", `Cloned from ${invoice.invoice_number}`);
      toast({ title: "Invoice cloned as new draft" });
    }
  };

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
      items.map((li) => ({ description: `[CREDIT] ${li.description}`, quantity: li.quantity, unit_price: -Math.abs(Number(li.unit_price)), category: li.category }))
    );
    if (cn) {
      await logActivity(invoice.id, "credit_note_created", `Credit note created`);
      toast({ title: "Credit note created" });
    }
  };

  const handleRecordPayment = async (invoiceId: string, payment: any) => {
    const result = await addPayment(invoiceId, payment);
    if (result) {
      await logActivity(invoiceId, "payment_recorded", `Payment of ${currencySymbol}${Number(payment.amount).toFixed(2)} recorded`);
      await fetchInvoices();
      toast({ title: "Payment recorded" });
    }
  };

  // Approval workflow
  const handleSubmitForApproval = async (invoiceId: string) => {
    await updateInvoice(invoiceId, { approval_status: "pending" });
    await logActivity(invoiceId, "submitted_for_approval", "Submitted for approval");
    toast({ title: "Invoice submitted for approval" });
  };

  const handleApprove = async (invoiceId: string) => {
    await updateInvoice(invoiceId, {
      approval_status: "approved",
      approved_at: new Date().toISOString(),
    });
    await logActivity(invoiceId, "approved", "Invoice approved");
    toast({ title: "Invoice approved" });
  };

  const handleReject = async (invoiceId: string, reason: string) => {
    await updateInvoice(invoiceId, {
      approval_status: "rejected",
      rejection_reason: reason,
    });
    await logActivity(invoiceId, "rejected", `Rejected: ${reason}`);
    toast({ title: "Invoice rejected" });
  };

  // Bulk actions
  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleBulkSend = async () => {
    if (!canSendInvoice) {
      toast({ title: "Not authorized", description: invoiceSendSettings.invoice_send_blocked_message, variant: "destructive" });
      return;
    }
    const toSend = filteredInvoices.filter(i => selectedInvoices.has(i.id) && (getDisplayStatus(i) === "draft" || getDisplayStatus(i) === "sent"));
    for (const inv of toSend) {
      const { error } = await supabase.rpc('rpc_send_invoice', { p_invoice_id: inv.id });
      if (error) {
        toast({ title: `Failed to send ${inv.invoice_number}`, description: error.message, variant: "destructive" });
      }
    }
    await fetchInvoices();
    setSelectedInvoices(new Set());
    toast({ title: `${toSend.length} invoices processed` });
  };

  const handleBulkExportPDF = async () => {
    for (const inv of filteredInvoices.filter(i => selectedInvoices.has(i.id))) {
      await triggerPDF(inv);
    }
    setSelectedInvoices(new Set());
  };

  const handleBulkVoid = () => {
    setConfirmAction({ type: "bulk_void" });
  };

  const executeBulkVoid = async () => {
    const toVoid = filteredInvoices.filter(i => selectedInvoices.has(i.id) && getDisplayStatus(i) !== "void" && getDisplayStatus(i) !== "paid");
    for (const inv of toVoid) {
      await handleStatusChange(inv, "void");
    }
    setSelectedInvoices(new Set());
    toast({ title: `${toVoid.length} invoices voided` });
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
    if (type === "bulk_void") await executeBulkVoid();
    setConfirmAction(null);
  };

  // Retainage release
  const handleReleaseRetainage = async (invoice: Invoice) => {
    const retainageItems = [{
      description: `Holdback release for ${invoice.invoice_number}`,
      quantity: 1,
      unit_price: Number(invoice.retainage_amount),
      category: "other",
    }];
    const release = await createInvoice(
      {
        client_id: invoice.client_id,
        project_id: invoice.project_id,
        issue_date: format(new Date(), "yyyy-MM-dd"),
        subtotal: Number(invoice.retainage_amount),
        tax_amount: 0,
        total: Number(invoice.retainage_amount),
        notes: `Holdback release for ${invoice.invoice_number}`,
        invoice_type: "retainage_release",
      },
      retainageItems
    );
    if (release) {
      await updateInvoice(invoice.id, {
        retainage_released: true,
        retainage_released_at: new Date().toISOString(),
      });
      await logActivity(invoice.id, "retainage_released", `Holdback of ${currencySymbol}${Number(invoice.retainage_amount).toFixed(2)} released`);
      toast({ title: "Holdback released as new invoice" });
    }
  };

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

  if (orgRoleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!canAccess) {
    return <Layout><NoAccess /></Layout>;
  }

  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="px-4 pt-3 pb-1">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => navigate("/financials")}
        >
          <ArrowLeft className="h-3 w-3" /> View Pipeline
        </button>
      </div>
      <DashboardHeader title="Invoicing" subtitle="Create and manage invoices" />

        <Tabs defaultValue="invoices" className="space-y-4">
          <TooltipProvider>
            <TabsList className="flex-wrap">
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="invoices"><FileText className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Invoices</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Invoices</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <TabsTrigger value="dashboard"><Activity className="h-4 w-4 mr-1 md:mr-1" /><span className="hidden md:inline">Dashboard</span></TabsTrigger>
              </TooltipTrigger><TooltipContent className="md:hidden">Dashboard</TooltipContent></Tooltip>
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

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-4">
            <InvoiceDashboardMetrics invoices={invoices} currencySymbol={currencySymbol} />
          </TabsContent>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div className="flex gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search invoices or PO#..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
                <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Approvals</SelectItem>
                    <SelectItem value="none">No Approval</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                {selectedInvoices.size > 0 && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={handleBulkExportPDF}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF ({selectedInvoices.size})
                    </Button>
                    {canSendInvoice ? (
                      <Button variant="outline" size="sm" onClick={handleBulkSend}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Send ({selectedInvoices.size})
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled>
                                <Send className="h-3.5 w-3.5 mr-1" /> Send ({selectedInvoices.size})
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{invoiceSendSettings.invoice_send_blocked_message}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button variant="outline" size="sm" onClick={handleBulkVoid}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Void
                    </Button>
                  </div>
                )}
                <Button onClick={() => setShowCreateInvoice(true)}>
                  <Plus className="h-4 w-4 mr-1" /> New Invoice
                </Button>
              </div>
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
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Approval</TableHead>
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
                          const invType = inv.invoice_type || "standard";
                          const approvalStatus = (inv.approval_status || "none") as ApprovalStatus;
                          return (
                            <TableRow key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={selectedInvoices.has(inv.id)} onCheckedChange={() => toggleSelectInvoice(inv.id)} />
                              </TableCell>
                              <TableCell className="font-medium">
                                {inv.invoice_number}
                                {isCreditNote && <Badge variant="outline" className="ml-1 text-xs">CN</Badge>}
                                {inv.po_number && <span className="text-xs text-muted-foreground ml-1">PO: {inv.po_number}</span>}
                              </TableCell>
                              <TableCell>{inv.client?.name || "—"}</TableCell>
                              <TableCell>
                                {invType !== "standard" && (
                                  <Badge variant="outline" className="text-xs">{invoiceTypeLabels[invType] || invType}</Badge>
                                )}
                              </TableCell>
                              <TableCell>{format(new Date(inv.issue_date), "MMM d, yyyy")}</TableCell>
                              <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                              <TableCell>
                                {approvalStatus === "none" && <span className="text-xs text-muted-foreground">—</span>}
                                {approvalStatus === "pending" && <Badge variant="warning" className="text-xs gap-1"><Clock className="h-3 w-3" />Pending</Badge>}
                                {approvalStatus === "approved" && <Badge variant="success" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>}
                                {approvalStatus === "rejected" && <Badge variant="error" className="text-xs gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>}
                              </TableCell>
                              <TableCell className="text-right font-medium">{fmt(Number(inv.total))}</TableCell>
                              <TableCell className="text-right">{balance > 0 ? fmt(balance) : "—"}</TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end flex-wrap">
                                  {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && canSendInvoice && (!sendRequiresApproval || inv.approval_status === "approved" || displayStatus !== "draft") && (
                                    <Button variant="ghost" size="sm" onClick={() => { setSendInvoice(inv); setShowSend(true); }} title="Send via email"><Mail className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && !canSendInvoice && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span><Button variant="ghost" size="sm" disabled><Mail className="h-3.5 w-3.5 text-muted-foreground/40" /></Button></span>
                                        </TooltipTrigger>
                                        <TooltipContent>{invoiceSendSettings.invoice_send_blocked_message}</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {displayStatus === "draft" && sendRequiresApproval && inv.approval_status !== "approved" && inv.approval_status !== "pending" && (
                                    <Button variant="ghost" size="sm" onClick={() => handleRequestApproval(inv)} title="Request approval"><ShieldCheck className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {(displayStatus === "sent" || displayStatus === "overdue") && (
                                    <Button variant="ghost" size="sm" onClick={() => { setPaymentInvoice(inv); setShowPayment(true); }} title="Record payment"><DollarSign className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {displayStatus !== "void" && displayStatus !== "paid" && !isCreditNote && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "void", invoice: inv })} title="Void"><Ban className="h-3.5 w-3.5" /></Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => handleClone(inv)} title="Clone"><Copy className="h-3.5 w-3.5" /></Button>
                                  {(displayStatus === "paid" || displayStatus === "sent") && !isCreditNote && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "credit_note", invoice: inv })} title="Credit note"><CreditCard className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {/* Retainage release */}
                                  {Number(inv.retainage_amount) > 0 && !inv.retainage_released && displayStatus === "paid" && (
                                    <Button variant="ghost" size="sm" onClick={() => handleReleaseRetainage(inv)} title="Release holdback"><CheckSquare className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {inv.status === "draft" && (
                                    <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "delete_invoice", invoice: inv })} title="Delete draft"><Trash2 className="h-3.5 w-3.5" /></Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => triggerPDF(inv)} title="PDF"><FileText className="h-3.5 w-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Mobile card layout */}
                <div className="md:hidden space-y-2">
                  {filteredInvoices.map((inv) => {
                    const displayStatus = getDisplayStatus(inv);
                    const sc = statusConfig[displayStatus] || statusConfig.draft;
                    const balance = Number(inv.total) - Number(inv.amount_paid || 0);
                    const isCreditNote = !!inv.credit_note_for;
                    const invType = (inv as any).invoice_type || "standard";
                    return (
                      <Card key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                {inv.invoice_number}{isCreditNote ? " (CN)" : ""}
                                {invType !== "standard" && <Badge variant="outline" className="ml-1 text-xs">{invoiceTypeLabels[invType]}</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground">{inv.client?.name || "No client"}</p>
                              {inv.po_number && <p className="text-xs text-muted-foreground">PO: {inv.po_number}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={sc.variant} className="text-xs">{sc.label}</Badge>
                              {((inv.approval_status || "none") === "pending") && <Badge variant="warning" className="text-xs">Pending</Badge>}
                              {((inv.approval_status || "none") === "approved") && <Badge variant="success" className="text-xs">Approved</Badge>}
                              {((inv.approval_status || "none") === "rejected") && <Badge variant="error" className="text-xs">Rejected</Badge>}
                            </div>
                          </div>
                          <div className="flex justify-between items-end">
                            <span className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), "MMM d, yyyy")}</span>
                            <div className="text-right">
                              <p className="font-bold text-sm">{fmt(Number(inv.total))}</p>
                              {balance > 0 && balance < Number(inv.total) && <p className="text-xs text-muted-foreground">Due: {fmt(balance)}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1 mt-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && canSendInvoice && (!sendRequiresApproval || inv.approval_status === "approved" || displayStatus !== "draft") && (
                              <Button variant="ghost" size="sm" onClick={() => { setSendInvoice(inv); setShowSend(true); }}><Mail className="h-3.5 w-3.5" /></Button>
                            )}
                            {(displayStatus === "draft" || displayStatus === "sent" || displayStatus === "overdue") && !canSendInvoice && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span><Button variant="ghost" size="sm" disabled><Mail className="h-3.5 w-3.5 text-muted-foreground/40" /></Button></span>
                                  </TooltipTrigger>
                                  <TooltipContent>{invoiceSendSettings.invoice_send_blocked_message}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {displayStatus === "draft" && sendRequiresApproval && inv.approval_status !== "approved" && inv.approval_status !== "pending" && (
                              <Button variant="ghost" size="sm" onClick={() => handleRequestApproval(inv)} title="Request approval"><ShieldCheck className="h-3.5 w-3.5" /></Button>
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

          {/* CLIENTS TAB */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingClient(null); setShowClientModal(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Client
              </Button>
            </div>
            {clientsLoading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : clients.filter(c => c.is_active).length === 0 ? (
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
                        <TableHead className="hidden md:table-cell">Parent</TableHead>
                        <TableHead className="hidden md:table-cell">A/P Email</TableHead>
                        <TableHead className="hidden md:table-cell">GST #</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Outstanding</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.filter(c => c.is_active).map((c) => {
                        const summary = clientSummaries.get(c.id);
                        const parent = c.parent_client_id ? clients.find(p => p.id === c.parent_client_id) : null;
                        const parentArchived = parent && !parent.is_active;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {c.name}
                                {c.parent_client_id && (
                                  <Badge variant="outline" className="text-xs">Child</Badge>
                                )}
                                {parentArchived && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>Billing customer "{parent?.name}" is archived</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {parent ? (
                                <span className={parentArchived ? "text-amber-500 line-through" : ""}>
                                  {parent.name}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{c.ap_email || c.email || "—"}</TableCell>
                            <TableCell className="hidden md:table-cell">{c.gst_number || "—"}</TableCell>
                            <TableCell className="text-right">{summary?.count || 0}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">{summary?.outstanding ? fmt(summary.outstanding) : "—"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {parentArchived && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingClient(c); setShowClientModal(true); }}>
                                          <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reassign parent</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => { setEditingClient(c); setShowClientModal(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  await updateClient(c.id, { is_active: false } as any);
                                  toast({ title: "Client archived" });
                                }}>
                                  <Ban className="h-3.5 w-3.5" />
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

            {/* Archived clients - collapsible */}
            {clients.some(c => !c.is_active) && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer flex flex-row items-center gap-2 py-3">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                      <CardTitle className="text-sm">Archived Clients ({clients.filter(c => !c.is_active).length})</CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      <Table>
                        <TableBody>
                          {clients.filter(c => !c.is_active).map((c) => {
                            const hasActiveChildren = clients.some(ch => ch.parent_client_id === c.id && ch.is_active);
                            return (
                              <TableRow key={c.id}>
                                <TableCell className="text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    {c.name}
                                    {hasActiveChildren && (
                                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                                        Has active children
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={async () => {
                                    await updateClient(c.id, { is_active: true } as any);
                                    toast({ title: "Client reactivated" });
                                  }}>
                                    Reactivate
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
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
                              <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(t); setShowRecurringModal(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ type: "delete_template", templateId: t.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
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
                <LogoUpload currentUrl={settingsForm.logo_url} onUploaded={(url) => setSettingsForm((f) => ({ ...f, logo_url: url }))} />
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

                {/* Tax settings - multi-tax */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tax 1 Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={settingsForm.tax_rate} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax 1 Label</Label>
                    <Input value={settingsForm.tax_label} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_label: e.target.value }))} placeholder="GST" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={settingsForm.currency} onValueChange={(v) => setSettingsForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax 2 Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={settingsForm.tax2_rate} onChange={(e) => setSettingsForm((f) => ({ ...f, tax2_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax 2 Label</Label>
                    <Input value={settingsForm.tax2_label} onChange={(e) => setSettingsForm((f) => ({ ...f, tax2_label: e.target.value }))} placeholder="PST (leave blank to disable)" />
                  </div>
                </div>

                {/* Retainage / Holdback */}
                <div className="space-y-2">
                  <Label>Default Holdback / Retainage (%)</Label>
                  <p className="text-xs text-muted-foreground">Applied automatically to progress invoices. Set to 0 to disable.</p>
                  <Input type="number" step="0.5" min="0" max="100" value={settingsForm.default_retainage_percent} onChange={(e) => setSettingsForm((f) => ({ ...f, default_retainage_percent: e.target.value }))} />
                </div>

                {/* Invoice Sending Permissions */}
                {isAdmin && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Invoice Sending Permissions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Who can send invoices?</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {ALL_ROLES.map(role => (
                            <label key={role} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={invoiceSendSettings.invoice_send_roles.includes(role)}
                                onCheckedChange={(checked) => {
                                  setInvoiceSendSettings(prev => ({
                                    ...prev,
                                    invoice_send_roles: checked
                                      ? [...prev.invoice_send_roles, role]
                                      : prev.invoice_send_roles.filter(r => r !== role),
                                  }));
                                }}
                              />
                              {ROLE_LABELS[role]}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          checked={invoiceSendSettings.invoice_send_requires_approval}
                          onCheckedChange={(v) => setInvoiceSendSettings(prev => ({ ...prev, invoice_send_requires_approval: v }))}
                        />
                        <div>
                          <Label>Require approval before sending</Label>
                          <p className="text-xs text-muted-foreground">When enabled, invoices must be approved before they can be sent.</p>
                        </div>
                      </div>

                      {invoiceSendSettings.invoice_send_requires_approval && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Who can approve invoices?</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_ROLES.map(role => (
                              <label key={role} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={invoiceSendSettings.invoice_send_approver_roles.includes(role)}
                                  onCheckedChange={(checked) => {
                                    setInvoiceSendSettings(prev => ({
                                      ...prev,
                                      invoice_send_approver_roles: checked
                                        ? [...prev.invoice_send_approver_roles, role]
                                        : prev.invoice_send_approver_roles.filter(r => r !== role),
                                    }));
                                  }}
                                />
                                {ROLE_LABELS[role]}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Blocked message</Label>
                        <Input
                          value={invoiceSendSettings.invoice_send_blocked_message}
                          onChange={(e) => setInvoiceSendSettings(prev => ({ ...prev, invoice_send_blocked_message: e.target.value }))}
                          placeholder="Invoice requires approval before sending."
                        />
                        <p className="text-xs text-muted-foreground">Shown to users who cannot send an invoice.</p>
                      </div>

                      <Button variant="outline" onClick={handleSaveSendSettings}>
                        Save Permissions
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Late payment reminders */}
                <div className="flex items-center gap-3">
                  <Switch checked={settingsForm.reminder_enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, reminder_enabled: v }))} />
                  <div>
                    <Label>Automated Late Payment Reminders</Label>
                    <p className="text-xs text-muted-foreground">Send email reminders to clients with overdue invoices.</p>
                  </div>
                </div>
                {settingsForm.reminder_enabled && (
                  <div className="space-y-2">
                    <Label>Reminder Days (comma-separated)</Label>
                    <Input value={settingsForm.reminder_days} onChange={(e) => setSettingsForm((f) => ({ ...f, reminder_days: e.target.value }))} placeholder="7,14,30" />
                    <p className="text-xs text-muted-foreground">Reminders are sent when an invoice is exactly this many days overdue.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Default Invoice Notes</Label>
                  <Textarea value={settingsForm.notes_template} onChange={(e) => setSettingsForm((f) => ({ ...f, notes_template: e.target.value }))} rows={2} placeholder="Thank you for your business!" />
                </div>
                <div className="space-y-2">
                  <Label>Payment Instructions</Label>
                  <p className="text-xs text-muted-foreground">These instructions appear on every invoice.</p>
                  <Textarea value={settingsForm.payment_instructions} onChange={(e) => setSettingsForm((f) => ({ ...f, payment_instructions: e.target.value }))} rows={4}
                    placeholder={"Payment Methods:\n• Cheque: Payable to [Company Name]\n• E-Transfer: payments@company.com\n• Wire: Bank Name, Account #, Transit #"} />
                </div>
                <div className="space-y-2">
                  <Label>From Email Address</Label>
                  <p className="text-xs text-muted-foreground">Requires a verified sending domain. Leave blank for default.</p>
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

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "void" && "Void this invoice?"}
                {confirmAction?.type === "credit_note" && "Create a credit note?"}
                {confirmAction?.type === "delete_template" && "Delete this template?"}
                {confirmAction?.type === "delete_invoice" && "Delete this draft?"}
                {confirmAction?.type === "bulk_void" && `Void ${selectedInvoices.size} invoices?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "void" && `This will permanently void invoice ${confirmAction.invoice?.invoice_number}. This action cannot be undone.`}
                {confirmAction?.type === "credit_note" && `A credit note will be created to offset invoice ${confirmAction.invoice?.invoice_number}.`}
                {confirmAction?.type === "delete_template" && "This recurring template will be permanently deleted."}
                {confirmAction?.type === "delete_invoice" && `Draft invoice ${confirmAction.invoice?.invoice_number} will be permanently deleted.`}
                {confirmAction?.type === "bulk_void" && `This will void ${selectedInvoices.size} selected invoices. This cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeConfirmAction}>
                {confirmAction?.type === "void" || confirmAction?.type === "bulk_void" ? "Void" : confirmAction?.type === "delete_template" || confirmAction?.type === "delete_invoice" ? "Delete" : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modals */}
        <ClientFormModal open={showClientModal} onOpenChange={setShowClientModal} initialData={editingClient}
          allClients={clients}
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
          onSubmit={async (inv, lines) => {
            const created = await createInvoice(inv, lines);
            if (created) {
              await logActivity((created as any).id, "created", "Invoice created");
              toast({ title: "Invoice created" });
            }
          }}
        />
        <InvoiceDetailModal open={showDetail} onOpenChange={setShowDetail}
          invoice={detailInvoice} lineItems={detailLineItems}
          settings={settings} client={detailInvoice ? clients.find((c) => c.id === detailInvoice.client_id) || null : null}
          clients={clients} projects={projects}
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
    </DashboardLayout>
  );
};

export default Invoicing;
