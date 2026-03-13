import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { formatCurrency } from "@/lib/formatters";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { useOrganization } from "@/hooks/useOrganization";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useEstimates } from "@/hooks/useEstimates";
import { useProposals } from "@/hooks/useProposals";
import { useQuotes } from "@/hooks/useQuotes";
import { useInvoices } from "@/hooks/useInvoices";
import { NoAccess } from "@/components/NoAccess";
import { CreateEstimateModal } from "@/components/estimates/CreateEstimateModal";
import { EstimateDetailModal } from "@/components/estimates/EstimateDetailModal";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import { ProposalDetailModal } from "@/components/proposals/ProposalDetailModal";
import { CreateQuoteModal } from "@/components/quotes/CreateQuoteModal";
import { QuoteDetailModal } from "@/components/quotes/QuoteDetailModal";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FileText, ChevronDown, ChevronRight, Plus, ArrowRight,
  ClipboardList, Send, CheckCircle2, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import type { Estimate } from "@/types/estimates";
import type { Proposal } from "@/types/proposals";
import type { Quote } from "@/types/quotes";

const fmtCurrency = (v: number, currency = "CAD") => formatCurrency(v, currency);

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "approved" || status === "paid") return "default";
  if (status === "rejected" || status === "void") return "destructive";
  if (status === "archived" || status === "overdue") return "outline";
  return "secondary";
};

const StagePill = ({
  count, label, icon: Icon, active,
}: { count: number; label: string; icon: React.ComponentType<{ className?: string }>; active?: boolean }) => (
  <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${active ? "border-primary bg-primary/10" : "border-border bg-muted/30"}`}>
    <Icon className={`h-4 w-4 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`} />
    <span className={`text-lg font-bold leading-none ${active ? "text-primary" : "text-foreground"}`}>{count}</span>
    <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
  </div>
);

const Financials = () => {
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const { currentProjectId } = useCurrentProject();

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganizationId) return;
    supabase
      .from("projects")
      .select("id,name")
      .eq("organization_id", activeOrganizationId)
      .eq("is_deleted", false)
      .order("name")
      .then(({ data }) => setProjects((data as any[]) || []));
  }, [activeOrganizationId]);

  // Sync project selector with global current project on mount
  useEffect(() => {
    if (currentProjectId && !selectedProjectId) setSelectedProjectId(currentProjectId);
  }, [currentProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { estimates, loading: estLoading, fetchEstimates, approveEstimate, duplicateEstimate } = useEstimates(selectedProjectId);
  const {
    proposals, loading: propLoading, fetchProposals, createProposal,
    updateProposal, submitProposal, approveProposal, rejectProposal, archiveProposal,
    fetchEvents, convertToQuote,
  } = useProposals();
  const { quotes, loading: quoteLoading, fetchQuotes, approveQuote, markSent, rejectQuote } = useQuotes();
  const { invoices, loading: invLoading } = useInvoices();

  const isAdmin = orgRole === "admin";
  const isPM = orgRole === "pm";
  const isForeman = orgRole === "foreman";
  const isAccounting = orgRole === "accounting";

  const canViewEstimates = isAdmin || isPM || isForeman || isAccounting;
  const canEditEstimates = isAdmin || isPM;
  const canViewProposals = isAdmin || isPM;
  const canEditProposals = isAdmin || isPM;
  const canApproveProposals = isAdmin || isPM;
  const canViewQuotes = isAdmin || isPM || isAccounting;
  const canEditQuotes = isAdmin || isPM || isAccounting;
  const canViewInvoices = isAdmin || isPM || isAccounting;

  const [sectEstOpen, setSectEstOpen] = useState(true);
  const [sectPropOpen, setSectPropOpen] = useState(true);
  const [sectQuoteOpen, setSectQuoteOpen] = useState(true);
  const [sectInvOpen, setSectInvOpen] = useState(true);

  // Modals
  const [createEstOpen, setCreateEstOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [createPropOpen, setCreatePropOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const filteredEstimates = useMemo(() =>
    selectedProjectId ? estimates.filter(e => e.project_id === selectedProjectId) : estimates,
    [estimates, selectedProjectId]
  );
  const filteredProposals = useMemo(() =>
    selectedProjectId ? proposals.filter(p => p.project_id === selectedProjectId) : proposals,
    [proposals, selectedProjectId]
  );
  const filteredQuotes = useMemo(() =>
    selectedProjectId ? quotes.filter(q => q.project_id === selectedProjectId) : quotes,
    [quotes, selectedProjectId]
  );
  const filteredInvoices = useMemo(() =>
    selectedProjectId ? invoices.filter(i => i.project_id === selectedProjectId) : invoices,
    [invoices, selectedProjectId]
  );

  const approvedEstimates = filteredEstimates.filter(e => e.status === "approved");
  const approvedProposals = filteredProposals.filter(p => p.status === "approved");
  const approvedQuotes = filteredQuotes.filter(q => q.status === "approved");

  const isLoading = orgRoleLoading || estLoading || propLoading || quoteLoading || invLoading;

  if (!orgRoleLoading && !canViewEstimates && !canViewProposals && !canViewQuotes && !canViewInvoices) {
    return <Layout><NoAccess /></Layout>;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionHeader
            title="Financials"
            subtitle="Estimates → Proposals → Quotes → Invoices"
          />
          <Select
            value={selectedProjectId || "all"}
            onValueChange={v => setSelectedProjectId(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pipeline status bar */}
        <div className="grid grid-cols-4 gap-2">
          <StagePill count={filteredEstimates.length} label="Estimates" icon={ClipboardList} active={filteredEstimates.length > 0} />
          <StagePill count={filteredProposals.length} label="Proposals" icon={Send} active={filteredProposals.length > 0} />
          <StagePill count={filteredQuotes.length} label="Quotes" icon={FileText} active={filteredQuotes.length > 0} />
          <StagePill count={filteredInvoices.length} label="Invoices" icon={Receipt} active={filteredInvoices.length > 0} />
        </div>

        {/* Pipeline advance hints */}
        {!isLoading && (approvedEstimates.length > 0 || approvedProposals.length > 0 || approvedQuotes.length > 0) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-3 space-y-1.5">
              {approvedEstimates.length > 0 && canEditProposals && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{approvedEstimates.length} approved estimate{approvedEstimates.length > 1 ? "s" : ""} ready</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setCreatePropOpen(true)}>
                    Create Proposal
                  </Button>
                </div>
              )}
              {approvedProposals.length > 0 && canEditQuotes && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{approvedProposals.length} approved proposal{approvedProposals.length > 1 ? "s" : ""} ready</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setSelectedProposal(approvedProposals[0])}>
                    Convert to Quote
                  </Button>
                </div>
              )}
              {approvedQuotes.length > 0 && canEditQuotes && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{approvedQuotes.length} approved quote{approvedQuotes.length > 1 ? "s" : ""} ready</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setSelectedQuote(approvedQuotes[0])}>
                    Convert to Invoice
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4">
            {/* ESTIMATES */}
            {canViewEstimates && (
              <Collapsible open={sectEstOpen} onOpenChange={setSectEstOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          Estimates
                          <Badge variant="outline" className="text-xs">{filteredEstimates.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {canEditEstimates && selectedProjectId && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setCreateEstOpen(true); }}>
                              <Plus className="h-3 w-3 mr-1" /> New
                            </Button>
                          )}
                          {sectEstOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {filteredEstimates.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No estimates yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredEstimates.map(est => (
                            <div
                              key={est.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setSelectedEstimate(est)}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{est.estimate_number}</p>
                                <p className="text-xs text-muted-foreground truncate">{est.project?.name ?? "—"} · {format(new Date(est.created_at), "MMM d, yyyy")}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-medium">{fmtCurrency(est.contract_value, est.currency)}</span>
                                <Badge variant={statusVariant(est.status)} className="text-xs">{est.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* PROPOSALS */}
            {canViewProposals && (
              <Collapsible open={sectPropOpen} onOpenChange={setSectPropOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Send className="h-4 w-4 text-muted-foreground" />
                          Proposals
                          <Badge variant="outline" className="text-xs">{filteredProposals.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {canEditProposals && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setCreatePropOpen(true); }}>
                              <Plus className="h-3 w-3 mr-1" /> New
                            </Button>
                          )}
                          {sectPropOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {filteredProposals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No proposals yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredProposals.map(prop => (
                            <div
                              key={prop.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setSelectedProposal(prop)}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{prop.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{prop.project?.name ?? "—"} · {format(new Date(prop.created_at), "MMM d, yyyy")}</p>
                              </div>
                              <Badge variant={statusVariant(prop.status)} className="text-xs flex-shrink-0">{prop.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* QUOTES */}
            {canViewQuotes && (
              <Collapsible open={sectQuoteOpen} onOpenChange={setSectQuoteOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Quotes
                          <Badge variant="outline" className="text-xs">{filteredQuotes.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {canEditQuotes && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setCreateQuoteOpen(true); }}>
                              <Plus className="h-3 w-3 mr-1" /> New
                            </Button>
                          )}
                          {sectQuoteOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {filteredQuotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No quotes yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredQuotes.map(q => (
                            <div
                              key={q.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setSelectedQuote(q)}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{q.quote_number}</p>
                                <p className="text-xs text-muted-foreground truncate">{q.project?.name ?? "—"} · {format(new Date(q.created_at), "MMM d, yyyy")}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-medium">{fmtCurrency(q.total_amount, q.currency)}</span>
                                <Badge variant={statusVariant(q.status)} className="text-xs">{q.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* INVOICES SUMMARY */}
            {canViewInvoices && (
              <Collapsible open={sectInvOpen} onOpenChange={setSectInvOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 rounded-t-lg py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          Invoices
                          <Badge variant="outline" className="text-xs">{filteredInvoices.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e => { e.stopPropagation(); navigate("/invoicing"); }}>
                            View all →
                          </Button>
                          {sectInvOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      {filteredInvoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No invoices yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {filteredInvoices.slice(0, 8).map(inv => (
                            <div
                              key={inv.id}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 cursor-pointer"
                              onClick={() => navigate("/invoicing")}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{inv.invoice_number}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(inv.issue_date), "MMM d, yyyy")}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-medium">{fmtCurrency(inv.total)}</span>
                                <Badge variant={statusVariant(inv.status)} className="text-xs">{inv.status}</Badge>
                              </div>
                            </div>
                          ))}
                          {filteredInvoices.length > 8 && (
                            <button
                              className="w-full px-4 py-2 text-xs text-muted-foreground hover:bg-muted/30 text-center"
                              onClick={() => navigate("/invoicing")}
                            >
                              +{filteredInvoices.length - 8} more · View all in Invoicing →
                            </button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        )}

        {/* MODALS */}
        {createEstOpen && selectedProjectId && (
          <CreateEstimateModal
            projectId={selectedProjectId}
            onClose={() => setCreateEstOpen(false)}
            onCreated={() => { setCreateEstOpen(false); fetchEstimates(); }}
          />
        )}

        {selectedEstimate && (
          <EstimateDetailModal
            estimate={selectedEstimate}
            canEdit={canEditEstimates}
            onClose={() => setSelectedEstimate(null)}
            onUpdated={() => { fetchEstimates(); setSelectedEstimate(null); }}
          />
        )}

        {createPropOpen && (
          <CreateProposalModal
            open={createPropOpen}
            onOpenChange={setCreatePropOpen}
            onSubmit={async (data) => {
              await createProposal(data as any);
              setCreatePropOpen(false);
              fetchProposals();
            }}
          />
        )}

        {selectedProposal && (
          <ProposalDetailModal
            proposal={selectedProposal}
            open={!!selectedProposal}
            onOpenChange={open => { if (!open) setSelectedProposal(null); }}
            canApprove={canApproveProposals}
            onSubmitForApproval={submitProposal}
            onApprove={approveProposal}
            onReject={rejectProposal}
            onArchive={archiveProposal}
            onUpdate={updateProposal}
            onConvertToQuote={async (id, includeLines) => {
              const quoteId = await convertToQuote(id, includeLines);
              fetchProposals();
              fetchQuotes();
              return quoteId;
            }}
            fetchEvents={fetchEvents}
          />
        )}

        {createQuoteOpen && (
          <CreateQuoteModal
            onClose={() => setCreateQuoteOpen(false)}
            onCreated={() => { setCreateQuoteOpen(false); fetchQuotes(); }}
          />
        )}

        {selectedQuote && (
          <QuoteDetailModal
            quote={selectedQuote}
            canEdit={canEditQuotes}
            onClose={() => setSelectedQuote(null)}
            onUpdated={() => { fetchQuotes(); setSelectedQuote(null); }}
          />
        )}
      </div>
    </Layout>
  );
};

export default Financials;
