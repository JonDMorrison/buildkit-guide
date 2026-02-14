import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { useQuotes } from "@/hooks/useQuotes";
import { useOrganizationRole } from "@/hooks/useOrganizationRole";
import { NoAccess } from "@/components/NoAccess";
import { CreateQuoteModal } from "@/components/quotes/CreateQuoteModal";
import { QuoteDetailModal } from "@/components/quotes/QuoteDetailModal";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, FileText, Trash2, Send, CheckCircle2, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { Quote } from "@/types/quotes";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  archived: { label: "Archived", variant: "outline" },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(v);

const Quotes = () => {
  const { role: orgRole, isLoading: orgRoleLoading } = useOrganizationRole();
  const {
    quotes, loading, fetchQuotes,
    approveQuote, markSent, rejectQuote, deleteQuote,
  } = useQuotes();

  const canEdit = orgRole === 'admin' || orgRole === 'pm';
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    if (tab === "all") return quotes;
    return quotes.filter(q => q.status === tab);
  }, [quotes, tab]);

  if (orgRoleLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </Layout>
    );
  }

  if (!canEdit) {
    return <Layout><NoAccess /></Layout>;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteQuote(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <SectionHeader title="Quotes" subtitle="Customer-facing proposals" />
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({quotes.length})</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No quotes found.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((q) => {
                      const sc = statusConfig[q.status] || statusConfig.draft;
                      return (
                        <TableRow
                          key={q.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedQuote(q)}
                        >
                          <TableCell className="font-medium">{q.quote_number}</TableCell>
                          <TableCell>{q.client?.name || "—"}</TableCell>
                          <TableCell>{q.project?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={sc.variant}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(q.total)}</TableCell>
                          <TableCell>{format(new Date(q.updated_at), "MMM d, yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {q.status === 'draft' && canEdit && (
                                <>
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => markSent(q.id)}
                                    title="Mark Sent"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => setDeleteTarget(q)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive-foreground" />
                                  </Button>
                                </>
                              )}
                              {(q.status === 'draft' || q.status === 'sent') && canEdit && (
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => approveQuote(q.id)}
                                  title="Approve"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              {q.status === 'sent' && canEdit && (
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => rejectQuote(q.id)}
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {createOpen && (
        <CreateQuoteModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); fetchQuotes(); }}
        />
      )}

      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          canEdit={canEdit}
          onClose={() => setSelectedQuote(null)}
          onUpdated={() => { setSelectedQuote(null); fetchQuotes(); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.quote_number}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Quotes;
