import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { FileEdit, User, Calendar, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Hash } from "lucide-react";
import { AmendmentReviewModal } from "./AmendmentReviewModal";
import { useProjectRole } from "@/hooks/useProjectRole";
import { formatHashForDisplay } from "@/lib/recordHash";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

interface Amendment {
  id: string;
  safety_form_id: string;
  requested_by: string;
  proposed_changes: Record<string, string>;
  reason: string;
  status: string;
  original_snapshot: Record<string, string | null>;
  approved_snapshot: Record<string, string | null> | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  previous_record_hash: string | null;
  approved_record_hash: string | null;
  requester?: { full_name: string | null; email: string };
  reviewer?: { full_name: string | null; email: string };
}

interface AmendmentHistoryProps {
  formId: string;
  projectId: string;
  onRefresh?: () => void;
}

export const AmendmentHistory = ({ formId, projectId, onRefresh }: AmendmentHistoryProps) => {
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(null);
  const { canManageProject } = useProjectRole(projectId);
  const canManage = canManageProject(projectId);

  useEffect(() => {
    fetchAmendments();
  }, [formId]);

  const fetchAmendments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("safety_form_amendments")
        .select(`
          *,
          requester:profiles!safety_form_amendments_requested_by_fkey(full_name, email),
          reviewer:profiles!safety_form_amendments_reviewed_by_fkey(full_name, email)
        `)
        .eq("safety_form_id", formId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Type cast the JSON fields
      const typedAmendments: Amendment[] = (data || []).map((item) => ({
        ...item,
        proposed_changes: (item.proposed_changes || {}) as Record<string, string>,
        original_snapshot: (item.original_snapshot || {}) as Record<string, string | null>,
        approved_snapshot: item.approved_snapshot as Record<string, string | null> | null,
        previous_record_hash: item.previous_record_hash as string | null,
        approved_record_hash: item.approved_record_hash as string | null,
      }));
      
      setAmendments(typedAmendments);
    } catch (error) {
      console.error("Error fetching amendments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3" />
            Denied
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleReviewSuccess = () => {
    fetchAmendments();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (amendments.length === 0) {
    return null;
  }

  const pendingCount = amendments.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Amendment History</h4>
          <Badge variant="secondary" className="text-xs">
            {amendments.length}
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3">
          {amendments.map((amendment) => (
            <Card
              key={amendment.id}
              className={cn(
                "p-4",
                amendment.status === "pending" && "border-amber-500/30 bg-amber-500/5"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(amendment.status)}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(amendment.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-sm">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Requested by:</span>
                    <span className="font-medium">
                      {amendment.requester?.full_name || amendment.requester?.email}
                    </span>
                  </div>

                  <p className="text-sm text-foreground">{amendment.reason}</p>

                  {amendment.reviewed_at && amendment.reviewer && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Reviewed {format(new Date(amendment.reviewed_at), "MMM d 'at' h:mm a")}
                        {" by "}
                        {amendment.reviewer.full_name || amendment.reviewer.email}
                      </div>
                      {amendment.review_note && (
                        <p className="text-sm italic text-muted-foreground">
                          "{amendment.review_note}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Record Hash Trail for approved amendments */}
                  {amendment.status === "approved" && (amendment.previous_record_hash || amendment.approved_record_hash) && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        <span className="font-medium">Tamper-Evidence Trail</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {amendment.previous_record_hash && (
                          <div>
                            <span className="text-muted-foreground">Previous hash:</span>
                            <div className="mt-0.5 font-mono text-destructive/80 bg-destructive/10 px-2 py-1 rounded">
                              {formatHashForDisplay(amendment.previous_record_hash)}
                            </div>
                          </div>
                        )}
                        {amendment.approved_record_hash && (
                          <div>
                            <span className="text-muted-foreground">New hash:</span>
                            <div className="mt-0.5 font-mono text-green-600 bg-green-500/10 px-2 py-1 rounded">
                              {formatHashForDisplay(amendment.approved_record_hash)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {amendment.status === "pending" && canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAmendment(amendment)}
                  >
                    Review
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AmendmentReviewModal
        isOpen={!!selectedAmendment}
        onClose={() => setSelectedAmendment(null)}
        amendment={selectedAmendment}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
};
