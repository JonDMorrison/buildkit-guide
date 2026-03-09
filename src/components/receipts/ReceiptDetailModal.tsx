import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt as ReceiptIcon, Download, Trash2, Loader2, Calendar, User, Tag, FileText, CheckCircle2, Send } from 'lucide-react';
import { Receipt, RECEIPT_CATEGORIES } from '@/hooks/useReceipts';
import { format } from 'date-fns';
import { useAuthRole } from '@/hooks/useAuthRole';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ReceiptDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: Receipt | null;
  projectId: string;
  getSignedUrl: (filePath: string) => Promise<string | null>;
  onDelete?: (receiptId: string, filePath: string) => void;
}

export const ReceiptDetailModal = ({
  open,
  onOpenChange,
  receipt,
  projectId,
  getSignedUrl,
  onDelete,
}: ReceiptDetailModalProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isPM } = useAuthRole(projectId);
  const canDelete = isAdmin || isPM();

  useEffect(() => {
    const loadImage = async () => {
      if (!receipt) return;
      setLoading(true);
      const url = await getSignedUrl(receipt.file_path);
      setImageUrl(url);
      setLoading(false);
    };

    if (open && receipt) {
      loadImage();
    }
  }, [open, receipt]);

  if (!receipt) return null;

  const categoryLabel = RECEIPT_CATEGORIES.find((c) => c.value === receipt.category)?.label || receipt.category;

  const handleDownload = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleDelete = () => {
    onDelete?.(receipt.id, receipt.file_path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5" />
            Receipt Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Receipt"
                className="w-full max-h-80 object-contain"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Unable to load image
              </div>
            )}
          </div>

          {/* Sent to Accounting Status */}
          {receipt.notified_accounting_at && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Sent to Accounting</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Notified on {format(new Date(receipt.notified_accounting_at), 'MMM d, yyyy · h:mm a')}
                </p>
              </div>
              <Send className="h-4 w-4 text-emerald-500" />
            </div>
          )}

          {/* Amount & Category */}
          <div className="flex items-center justify-between">
            <div>
              {receipt.amount ? (
                <span className="text-2xl font-bold">
                  {receipt.currency} ${receipt.amount.toFixed(2)}
                </span>
              ) : (
                <span className="text-muted-foreground">No amount specified</span>
              )}
            </div>
            <Badge variant="secondary">{categoryLabel}</Badge>
          </div>

          {/* Vendor */}
          {receipt.vendor && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{receipt.vendor}</span>
            </div>
          )}

          <Separator />

          {/* Metadata */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(receipt.uploaded_at), 'PPP p')}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{receipt.uploader?.full_name || receipt.uploader?.email || 'Unknown'}</span>
            </div>
            {receipt.task && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Task: {receipt.task.title}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {receipt.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{receipt.notes}</p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDownload}
              disabled={!imageUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {canDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this receipt. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
