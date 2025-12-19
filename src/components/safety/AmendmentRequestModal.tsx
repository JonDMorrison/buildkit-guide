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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AmendmentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  currentEntries: Array<{ field_name: string; field_value: string | null }>;
  onSuccess?: () => void;
}

export const AmendmentRequestModal = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  currentEntries,
  onSuccess,
}: AmendmentRequestModalProps) => {
  const [reason, setReason] = useState("");
  const [proposedChanges, setProposedChanges] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Create the original snapshot from current entries
      const originalSnapshot = currentEntries.reduce((acc, entry) => {
        acc[entry.field_name] = entry.field_value;
        return acc;
      }, {} as Record<string, string | null>);

      // Parse proposed changes - expecting field:value format or free text
      let parsedChanges: Record<string, string> = {};
      if (proposedChanges.trim()) {
        // Try to parse as structured changes
        const lines = proposedChanges.split("\n").filter((l) => l.trim());
        lines.forEach((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const field = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            parsedChanges[field] = value;
          }
        });
        // If no structured changes found, store as description
        if (Object.keys(parsedChanges).length === 0) {
          parsedChanges = { description: proposedChanges.trim() };
        }
      }

      const { error } = await supabase.from("safety_form_amendments").insert({
        safety_form_id: formId,
        requested_by: user.user.id,
        reason: reason.trim(),
        proposed_changes: parsedChanges,
        original_snapshot: originalSnapshot,
        status: "pending",
      });

      if (error) throw error;

      toast({ title: "Amendment request submitted", description: "Awaiting PM review" });
      setReason("");
      setProposedChanges("");
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Amendment request error:", error);
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Amendment</DialogTitle>
          <DialogDescription>
            Request a change to "{formTitle}". All amendments are logged for compliance.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            WorkSafeBC requires all safety record amendments to be documented with the original values preserved.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Amendment *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this form needs to be corrected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changes">Proposed Changes (optional)</Label>
            <Textarea
              id="changes"
              placeholder="Describe the changes needed, or use format:
field_name: new_value"
              value={proposedChanges}
              onChange={(e) => setProposedChanges(e.target.value)}
              className="min-h-[100px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if you need PM to determine the correct values
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
