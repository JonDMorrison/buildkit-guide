import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, Mail, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EscalationEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  blockerId: string;
  blockerReason: string;
  taskTitle: string;
}

export const EscalationEmailModal = ({
  open,
  onOpenChange,
  projectId,
  blockerId,
  blockerReason,
  taskTitle,
}: EscalationEmailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<{ subject: string; body: string; recipient: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateEmail = async () => {
    setLoading(true);
    setEmail(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-email', {
        body: {
          type: 'blocker_escalation',
          project_id: projectId,
          blocker_id: blockerId,
          recipient_type: 'gc',
        },
      });

      if (error) throw error;

      setEmail({
        subject: data.subject || 'Action Required: Blocked Work Item',
        body: data.body || 'Email generation failed.',
        recipient: data.recipient_suggestion || 'General Contractor',
      });
    } catch (error: any) {
      console.error('Error generating escalation email:', error);
      toast({
        title: 'Error generating email',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate when modal opens
  useEffect(() => {
    if (open && !email && !loading) {
      generateEmail();
    }
  }, [open]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setEmail(null);
    }
  }, [open]);

  const copyToClipboard = async () => {
    if (!email) return;
    
    const fullText = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'Email copied - paste into your email client',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const openInEmail = () => {
    if (!email) return;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(mailtoLink, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Escalation Email Draft
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Blocker: "{blockerReason}" on "{taskTitle}"
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Drafting escalation email...</p>
            </div>
          ) : email ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Suggested Recipient</p>
                  <p className="text-sm">{email.recipient}</p>
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Subject</p>
                <p className="font-medium">{email.subject}</p>
              </div>
              
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Email Body</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {email.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertTriangle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Failed to generate email</p>
              <Button onClick={generateEmail}>Try Again</Button>
            </div>
          )}
        </div>

        {email && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Button
              className="flex-1"
              onClick={openInEmail}
            >
              <Mail className="h-4 w-4 mr-2" />
              Open in Email
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
