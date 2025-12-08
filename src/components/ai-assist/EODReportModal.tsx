import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, FileText, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EODReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  jobNumber?: string | null;
}

export const EODReportModal = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  jobNumber,
}: EODReportModalProps) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-email', {
        body: {
          type: 'eod_report',
          project_id: projectId,
        },
      });

      if (error) throw error;

      setReport({
        subject: data.subject || 'Daily Field Report',
        body: data.body || 'Report generation failed.',
      });
    } catch (error: any) {
      console.error('Error generating EOD report:', error);
      toast({
        title: 'Error generating report',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!report) return;
    
    const fullText = `Subject: ${report.subject}\n\n${report.body}`;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'Report copied - paste into your email client',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const openInEmail = () => {
    if (!report) return;
    
    const mailtoLink = `mailto:?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.body)}`;
    window.open(mailtoLink, '_blank');
  };

  // Generate report when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !report && !loading) {
      generateReport();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            End of Day Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {projectName}{jobNumber ? ` (${jobNumber})` : ''} • {new Date().toLocaleDateString()}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating report from today's data...</p>
            </div>
          ) : report ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Subject</p>
                <p className="font-medium">{report.subject}</p>
              </div>
              
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Email Body</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {report.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click Generate to create your EOD report</p>
              <Button onClick={generateReport}>Generate Report</Button>
            </div>
          )}
        </div>

        {report && (
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
