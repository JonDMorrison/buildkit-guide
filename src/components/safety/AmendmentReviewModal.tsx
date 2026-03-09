import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateAndPersistRecordHash } from "@/lib/recordHash";
import { Loader2, Check, X, FileText, User, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Amendment {
  id: string;
  safety_form_id: string;
  requested_by: string;
  proposed_changes: Record<string, string>;
  reason: string;
  status: string;
  original_snapshot: Record<string, string | null>;
  created_at: string;
  requester?: { full_name: string | null; email: string };
}

interface AmendmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  amendment: Amendment | null;
  onSuccess?: () => void;
}

export const AmendmentReviewModal = ({
  isOpen,
  onClose,
  amendment,
  onSuccess,
}: AmendmentReviewModalProps) => {
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<"approve" | "deny" | null>(null);
  const { toast } = useToast();

  const handleReview = async (status: "approved" | "denied") => {
    if (!amendment) return;

    setSubmitting(true);
    setAction(status === "approved" ? "approve" : "deny");

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Fetch current form to get previous record_hash
      const { data: currentForm } = await supabase
        .from("safety_forms")
        .select("record_hash")
        .eq("id", amendment.safety_form_id)
        .single();

      const previousRecordHash = currentForm?.record_hash || null;

      // Build approved snapshot if approving
      let approvedSnapshot = null;
      if (status === "approved" && amendment.proposed_changes) {
        approvedSnapshot = {
          ...amendment.original_snapshot,
          ...amendment.proposed_changes,
        };
      }

      // Initial amendment update (without approved_record_hash yet)
      const { error } = await supabase
        .from("safety_form_amendments")
        .update({
          status,
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote.trim() || null,
          approved_snapshot: approvedSnapshot,
          previous_record_hash: previousRecordHash,
        })
        .eq("id", amendment.id);

      if (error) throw error;

      // If approved, update the actual safety entries and regenerate hash
      if (status === "approved" && amendment.proposed_changes) {
        // Update entries that were changed
        for (const [fieldName, newValue] of Object.entries(amendment.proposed_changes)) {
          if (fieldName !== "description") {
            await supabase
              .from("safety_entries")
              .update({ field_value: newValue })
              .eq("safety_form_id", amendment.safety_form_id)
              .eq("field_name", fieldName);
          }
        }

        // Regenerate record_hash for tamper-evidence chain
        console.log("[Amendment] Regenerating record_hash after approval...");
        const newRecordHash = await generateAndPersistRecordHash(amendment.safety_form_id);
        
        if (newRecordHash) {
          // Store the new hash in the amendment record
          await supabase
            .from("safety_form_amendments")
            .update({ approved_record_hash: newRecordHash })
            .eq("id", amendment.id);
          
          console.log("[Amendment] Record hash regenerated:", {
            previous: previousRecordHash,
            new: newRecordHash,
          });
        } else {
          console.error("[Amendment] Failed to regenerate record_hash");
        }
      }

      toast({
        title: status === "approved" ? "Amendment approved" : "Amendment denied",
        description: status === "approved" 
          ? "The safety record has been updated with new tamper-evidence hash" 
          : "The requester will be notified",
      });

      setReviewNote("");
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error("Review error:", error);
      toast({ 
        title: "Review failed", 
        description: error instanceof Error ? error.message : "An error occurred", 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
      setAction(null);
    }
  };

  if (!amendment) return null;

  const proposedChanges = amendment.proposed_changes || {};
  const hasStructuredChanges = Object.keys(proposedChanges).some(k => k !== "description");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Amendment Request</DialogTitle>
          <DialogDescription>
            Approve or deny this amendment. Your decision will be logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Info */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Requested by:</span>
              <span className="font-medium">
                {amendment.requester?.full_name || amendment.requester?.email || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Submitted:</span>
              <span>{format(new Date(amendment.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={amendment.status === "pending" ? "outline" : "secondary"}>
                {amendment.status}
              </Badge>
            </div>
          </Card>

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Reason for Amendment</Label>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              {amendment.reason}
            </div>
          </div>

          {/* Proposed Changes */}
          {hasStructuredChanges && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Proposed Changes</Label>
              <div className="space-y-2">
                {Object.entries(proposedChanges)
                  .filter(([key]) => key !== "description")
                  .map(([field, newValue]) => (
                    <Card key={field} className="p-3">
                      <div className="text-sm font-medium mb-2 capitalize">
                        {field.replace(/_/g, " ")}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Original:</span>
                          <div className="mt-1 p-2 bg-destructive/10 rounded text-destructive truncate">
                            {amendment.original_snapshot[field] || "(empty)"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">New:</span>
                          <div className="mt-1 p-2 bg-green-500/10 rounded text-green-600 truncate">
                            {newValue}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Description-only changes */}
          {proposedChanges.description && !hasStructuredChanges && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Proposed Changes</Label>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                {proposedChanges.description}
              </div>
            </div>
          )}

          {/* Review Note */}
          <div className="space-y-2">
            <Label htmlFor="review-note">Review Note (optional)</Label>
            <Textarea
              id="review-note"
              placeholder="Add a note about your decision..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleReview("denied")}
            disabled={submitting}
          >
            {submitting && action === "deny" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <X className="h-4 w-4 mr-1" />
            Deny
          </Button>
          <Button
            onClick={() => handleReview("approved")}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting && action === "approve" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
