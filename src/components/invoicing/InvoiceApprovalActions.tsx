import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, XCircle, Clock, ShieldCheck, LucideIcon } from "lucide-react";
import type { Invoice, ApprovalStatus } from "@/types/invoicing";

const approvalConfig: Record<ApprovalStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon | null }> = {
  none: { label: "No Approval Required", variant: "outline", icon: null },
  pending: { label: "Pending Approval", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

interface Props {
  invoice: Invoice;
  canApprove: boolean;
  onSubmitForApproval: (invoiceId: string) => Promise<void>;
  onApprove: (invoiceId: string) => Promise<void>;
  onReject: (invoiceId: string, reason: string) => Promise<void>;
}

export const InvoiceApprovalActions = ({ invoice, canApprove, onSubmitForApproval, onApprove, onReject }: Props) => {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const status = (invoice.approval_status || "none") as ApprovalStatus;
  const config = approvalConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant={config.variant} className="gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>

      {status === "none" && invoice.status === "draft" && (
        <Button variant="outline" size="sm" onClick={() => onSubmitForApproval(invoice.id)}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Submit for Approval
        </Button>
      )}

      {status === "pending" && canApprove && (
        <>
          <Button size="sm" onClick={() => onApprove(invoice.id)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowReject(true)}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
        </>
      )}

      {status === "rejected" && invoice.rejection_reason && (
        <span className="text-xs text-destructive">Reason: {invoice.rejection_reason}</span>
      )}

      <AlertDialog open={showReject} onOpenChange={setShowReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for rejecting invoice {invoice.invoice_number}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onReject(invoice.id, rejectReason); setShowReject(false); setRejectReason(""); }}
              disabled={!rejectReason.trim()}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
