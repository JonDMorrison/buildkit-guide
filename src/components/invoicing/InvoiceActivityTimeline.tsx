import { useEffect } from "react";
import { format } from "date-fns";
import { Clock, FileText, Send, DollarSign, Ban, CheckCircle2, XCircle, Copy, CreditCard, ShieldCheck, AlertTriangle } from "lucide-react";
import { useInvoiceActivity } from "@/hooks/useInvoiceActivity";

const actionIcons: Record<string, any> = {
  created: FileText,
  sent: Send,
  payment_recorded: DollarSign,
  voided: Ban,
  approved: CheckCircle2,
  rejected: XCircle,
  cloned: Copy,
  credit_note_created: CreditCard,
  submitted_for_approval: ShieldCheck,
  status_changed: AlertTriangle,
  line_items_updated: FileText,
  reminder_sent: Send,
};

interface Props {
  invoiceId: string;
}

export const InvoiceActivityTimeline = ({ invoiceId }: Props) => {
  const { activities, loading, fetchActivities } = useInvoiceActivity();

  useEffect(() => {
    fetchActivities(invoiceId);
  }, [invoiceId, fetchActivities]);

  if (loading) return <div className="text-xs text-muted-foreground">Loading activity...</div>;
  if (activities.length === 0) return <div className="text-xs text-muted-foreground">No activity recorded yet.</div>;

  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const Icon = actionIcons[a.action] || Clock;
        return (
          <div key={a.id} className="flex items-start gap-2 text-sm">
            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
              {a.details && <span className="text-muted-foreground ml-1">— {a.details}</span>}
              <div className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
