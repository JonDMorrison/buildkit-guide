import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Sparkles, Copy, Check, Mail, FileText, AlertTriangle, TrendingUp, CheckCircle2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';

interface StructuredSummary {
  overview: string;
  blocked_by_trade: Array<{
    trade: string;
    tasks: Array<{
      task_id: string;
      task_title: string;
      reason: string;
    }>;
  }>;
  what_horizon_is_waiting_on: string[];
  upcoming_risks: Array<{
    risk: string;
    impact: string;
  }>;
  schedule_impacts?: string[];
  recommended_actions: string[];
  next_7_days_priorities?: string[];
}

interface CoordinationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: StructuredSummary | null;
  loading: boolean;
  onTaskClick?: (taskId: string) => void;
}

export const CoordinationSummaryDialog = ({
  open,
  onOpenChange,
  summary,
  loading,
  onTaskClick,
}: CoordinationSummaryDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (summary) {
      // Convert structured summary to readable text
      const text = formatSummaryAsText(summary);
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: 'Copied to clipboard',
        description: 'Summary copied successfully',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPDF = () => {
    if (!summary) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to check if we need a new page
      const checkPageBreak = (requiredSpace: number) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to add wrapped text
      const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 10, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(text, maxWidth);
        
        lines.forEach((line: string) => {
          checkPageBreak(7);
          doc.text(line, x, yPosition);
          yPosition += 6;
        });
      };

      // Header with branding
      doc.setFillColor(26, 26, 26); // #1A1A1A dark grey
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Project Pulse', margin, 20);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Coordination Summary', margin, 28);

      // Date in header
      const dateStr = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.setFontSize(10);
      const dateWidth = doc.getTextWidth(dateStr);
      doc.text(dateStr, pageWidth - margin - dateWidth, 20);

      yPosition = 50;
      doc.setTextColor(0, 0, 0);

      // Overview Section
      doc.setFillColor(59, 130, 246); // Blue accent
      doc.rect(margin, yPosition, 5, 10, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Overview', margin + 10, yPosition + 7);
      yPosition += 15;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addWrappedText(summary.overview, margin, contentWidth, 10);
      yPosition += 5;

      // Blocked Tasks by Trade
      if (summary.blocked_by_trade.length > 0) {
        checkPageBreak(20);
        yPosition += 10;
        
        doc.setFillColor(249, 115, 22); // Orange accent
        doc.rect(margin, yPosition, 5, 10, 'F');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Blocked Tasks by Trade', margin + 10, yPosition + 7);
        yPosition += 15;

        summary.blocked_by_trade.forEach((tradeItem) => {
          checkPageBreak(15);
          
          // Trade name with background
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, yPosition - 5, contentWidth, 10, 'F');
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(tradeItem.trade, margin + 5, yPosition + 2);
          yPosition += 12;

          // Tasks
          tradeItem.tasks.forEach((task) => {
            checkPageBreak(15);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('•', margin + 5, yPosition);
            addWrappedText(task.task_title, margin + 10, contentWidth - 15, 10, true);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            addWrappedText(task.reason, margin + 10, contentWidth - 15, 9);
            doc.setTextColor(0, 0, 0);
            yPosition += 3;
          });
          
          yPosition += 5;
        });
      }

      // What Horizon Needs
      if (summary.what_horizon_is_waiting_on.length > 0) {
        checkPageBreak(20);
        yPosition += 10;
        
        doc.setFillColor(59, 130, 246); // Blue accent
        doc.rect(margin, yPosition, 5, 10, 'F');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('What Horizon Needs', margin + 10, yPosition + 7);
        yPosition += 15;

        summary.what_horizon_is_waiting_on.forEach((item) => {
          checkPageBreak(10);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text('•', margin + 5, yPosition);
          addWrappedText(item, margin + 10, contentWidth - 15, 10);
          yPosition += 2;
        });
      }

      // Upcoming Risks
      if (summary.upcoming_risks.length > 0) {
        checkPageBreak(20);
        yPosition += 10;
        
        doc.setFillColor(234, 179, 8); // Yellow accent
        doc.rect(margin, yPosition, 5, 10, 'F');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Upcoming Risks', margin + 10, yPosition + 7);
        yPosition += 15;

        summary.upcoming_risks.forEach((riskItem) => {
          checkPageBreak(15);
          
          doc.setFillColor(254, 252, 232); // Light yellow background
          doc.rect(margin, yPosition - 3, contentWidth, 12, 'F');
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          addWrappedText(riskItem.risk, margin + 5, contentWidth - 10, 10, true);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text('Impact:', margin + 5, yPosition);
          yPosition += 6;
          addWrappedText(riskItem.impact, margin + 10, contentWidth - 15, 9);
          doc.setTextColor(0, 0, 0);
          yPosition += 5;
        });
      }

      // Recommended Actions
      if (summary.recommended_actions.length > 0) {
        checkPageBreak(20);
        yPosition += 10;
        
        doc.setFillColor(34, 197, 94); // Green accent
        doc.rect(margin, yPosition, 5, 10, 'F');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Recommended Actions', margin + 10, yPosition + 7);
        yPosition += 15;

        summary.recommended_actions.forEach((action, idx) => {
          checkPageBreak(15);
          
          doc.setFillColor(240, 253, 244); // Light green background
          doc.rect(margin, yPosition - 3, contentWidth, 10, 'F');
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(34, 197, 94);
          doc.text(`${idx + 1}.`, margin + 5, yPosition + 3);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          addWrappedText(action, margin + 15, contentWidth - 20, 10);
          yPosition += 5;
        });
      }

      // Footer on last page
      const footerY = pageHeight - 15;
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text('Generated by Project Pulse AI', margin, footerY);
      doc.text(`Page ${doc.internal.pages.length - 1}`, pageWidth - margin - 15, footerY);

      // Save the PDF
      const fileName = `Coordination_Summary_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: 'PDF exported',
        description: `${fileName} has been downloaded`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEmail = () => {
    if (summary) {
      const text = formatSummaryAsText(summary);
      const mailto = `mailto:?subject=Coordination Summary - ${new Date().toLocaleDateString()}&body=${encodeURIComponent(text)}`;
      window.location.href = mailto;
    }
  };

  const formatSummaryAsText = (summary: StructuredSummary): string => {
    let text = `COORDINATION SUMMARY - ${new Date().toLocaleDateString()}\n\n`;
    
    text += `OVERVIEW\n${summary.overview}\n\n`;
    
    if (summary.blocked_by_trade.length > 0) {
      text += `BLOCKED TASKS BY TRADE\n`;
      summary.blocked_by_trade.forEach(trade => {
        text += `\n${trade.trade}:\n`;
        trade.tasks.forEach(task => {
          text += `  • ${task.task_title} - ${task.reason}\n`;
        });
      });
      text += '\n';
    }
    
    if (summary.what_horizon_is_waiting_on.length > 0) {
      text += `WHAT HORIZON NEEDS\n`;
      summary.what_horizon_is_waiting_on.forEach(item => {
        text += `  • ${item}\n`;
      });
      text += '\n';
    }
    
    if (summary.upcoming_risks.length > 0) {
      text += `UPCOMING RISKS\n`;
      summary.upcoming_risks.forEach(risk => {
        text += `  • ${risk.risk}\n    Impact: ${risk.impact}\n`;
      });
      text += '\n';
    }
    
    if (summary.recommended_actions.length > 0) {
      text += `RECOMMENDED ACTIONS\n`;
      summary.recommended_actions.forEach((action, idx) => {
        text += `  ${idx + 1}. ${action}\n`;
      });
    }
    
    return text;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle className="text-xl">AI Coordination Summary</DialogTitle>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
          <DialogDescription>
            AI-generated insights for your 2-week lookahead
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : summary ? (
            <>
              {/* Overview */}
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Overview</h3>
                    <p className="text-sm text-foreground/90">{summary.overview}</p>
                  </div>
                </div>
              </Card>

              {/* Blocked Tasks by Trade */}
              {summary.blocked_by_trade.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Blocked Tasks by Trade
                  </h3>
                  <div className="space-y-3">
                    {summary.blocked_by_trade.map((tradeItem, idx) => (
                      <Card key={idx} className="p-4">
                        <h4 className="font-semibold text-foreground mb-2">{tradeItem.trade}</h4>
                        <ul className="space-y-2">
                          {tradeItem.tasks.map((task, taskIdx) => (
                            <li key={taskIdx} className="flex items-start gap-2 text-sm">
                              <span className="text-destructive mt-1">•</span>
                              <div>
                                <button
                                  onClick={() => onTaskClick?.(task.task_id)}
                                  className="font-medium text-primary hover:underline text-left"
                                >
                                  {task.task_title}
                                </button>
                                <p className="text-muted-foreground">{task.reason}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* What Horizon Needs */}
              {summary.what_horizon_is_waiting_on.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    What Horizon Needs
                  </h3>
                  <Card className="p-4">
                    <ul className="space-y-2">
                      {summary.what_horizon_is_waiting_on.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* Upcoming Risks */}
              {summary.upcoming_risks.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                    Upcoming Risks
                  </h3>
                  <div className="space-y-2">
                    {summary.upcoming_risks.map((riskItem, idx) => (
                      <Card key={idx} className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                        <p className="font-medium text-sm text-foreground">{riskItem.risk}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-semibold">Impact:</span> {riskItem.impact}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Impacts */}
              {summary.schedule_impacts && summary.schedule_impacts.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3">Schedule Impacts</h3>
                  <Card className="p-4">
                    <ul className="space-y-2">
                      {summary.schedule_impacts.map((impact, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-orange-600 mt-1">•</span>
                          <span>{impact}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* Recommended Actions */}
              {summary.recommended_actions.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Recommended Actions
                  </h3>
                  <div className="space-y-2">
                    {summary.recommended_actions.map((action, idx) => (
                      <Card key={idx} className="p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                        <p className="text-sm flex items-start gap-2">
                          <span className="font-bold text-green-600 dark:text-green-400 min-w-[1.5rem]">
                            {idx + 1}.
                          </span>
                          <span className="text-foreground">{action}</span>
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Next 7 Days Priorities */}
              {summary.next_7_days_priorities && summary.next_7_days_priorities.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3">Next 7 Days Priorities</h3>
                  <Card className="p-4">
                    <ul className="space-y-2">
                      {summary.next_7_days_priorities.map((priority, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{priority}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No summary available
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!summary || loading}
              size="sm"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={!summary || loading}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleEmail}
              disabled={!summary || loading}
              size="sm"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="ml-auto"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
