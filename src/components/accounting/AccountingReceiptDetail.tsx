import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, Download, CheckCircle2, Clock, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { RECEIPT_CATEGORIES, ReceiptCategory, ReceiptReviewStatus } from '@/hooks/useReceipts';
import { format } from 'date-fns';

interface Receipt {
  id: string;
  project_id: string;
  task_id: string | null;
  uploaded_by: string;
  file_path: string;
  amount: number | null;
  currency: string;
  vendor: string | null;
  category: ReceiptCategory;
  notes: string | null;
  uploaded_at: string;
  processed_data_json: {
    total_amount?: number;
    tax_amount?: number | null;
    vendor_name?: string;
    purchase_date?: string;
    category?: string;
    confidence?: number;
  } | null;
  review_status: ReceiptReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  project?: { name: string } | null;
  uploader?: { full_name: string | null; email: string } | null;
  reviewer?: { full_name: string | null; email: string } | null;
}

interface AccountingReceiptDetailProps {
  receipt: Receipt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const REVIEW_STATUSES: { value: ReceiptReviewStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'pending', label: 'Pending', icon: <CircleDot className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'reviewed', label: 'Reviewed', icon: <Clock className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'processed', label: 'Processed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

export const AccountingReceiptDetail = ({
  receipt,
  open,
  onOpenChange,
  onUpdate,
}: AccountingReceiptDetailProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Editable fields
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ReceiptCategory>('other');
  const [reviewStatus, setReviewStatus] = useState<ReceiptReviewStatus>('pending');

  // Load image
  useEffect(() => {
    if (!receipt) return;
    
    setLoading(true);
    const loadImage = async () => {
      const { data } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.file_path, 3600);
      setImageUrl(data?.signedUrl || null);
      setLoading(false);
    };
    loadImage();

    // Set initial form values
    setVendor(receipt.vendor || '');
    setAmount(receipt.amount?.toString() || '');
    setCategory(receipt.category);
    setReviewStatus(receipt.review_status || 'pending');
  }, [receipt]);

  const handleSave = async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({
          vendor: vendor || null,
          amount: amount ? parseFloat(amount) : null,
          category,
        })
        .eq('id', receipt.id);

      if (error) throw error;

      toast({
        title: 'Receipt updated',
        description: 'Changes saved successfully.',
      });

      onUpdate?.();
    } catch (error: unknown) {
      console.error('Error updating receipt:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error saving changes',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: ReceiptReviewStatus) => {
    if (!receipt || !user) return;

    setUpdatingStatus(true);
    try {
      const updateData: {
        review_status: ReceiptReviewStatus;
        reviewed_by?: string;
        reviewed_at?: string;
      } = {
        review_status: newStatus,
      };

      // Set reviewed_by and reviewed_at when status changes from pending
      if (receipt.review_status === 'pending' && newStatus !== 'pending') {
        updateData.reviewed_by = user.id;
        updateData.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receipt.id);

      if (error) throw error;

      setReviewStatus(newStatus);
      toast({
        title: 'Status updated',
        description: `Receipt marked as ${newStatus}.`,
      });

      onUpdate?.();
    } catch (error: unknown) {
      console.error('Error updating status:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error updating status',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDownload = () => {
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  };

  if (!receipt) return null;

  const parsedData = receipt.processed_data_json;
  const currentStatusConfig = REVIEW_STATUSES.find(s => s.value === reviewStatus) || REVIEW_STATUSES[0];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-[#1C3B23]">Receipt Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Image Preview */}
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-[4/3]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Receipt"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                Image not available
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!imageUrl}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Image
          </Button>

          <Separator />

          {/* Review Status Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[#1C3B23]">Review Status</h3>
            <div className="flex gap-2">
              {REVIEW_STATUSES.map((status) => (
                <Button
                  key={status.value}
                  variant={reviewStatus === status.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusChange(status.value)}
                  disabled={updatingStatus}
                  className={reviewStatus === status.value 
                    ? 'bg-[#1C3B23] hover:bg-[#3D7237]' 
                    : ''
                  }
                >
                  {updatingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </>
                  )}
                </Button>
              ))}
            </div>
            {receipt.reviewed_at && receipt.reviewer && (
              <p className="text-xs text-[#A0ADA3]">
                Last reviewed by {receipt.reviewer.full_name || receipt.reviewer.email} on{' '}
                {format(new Date(receipt.reviewed_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </div>

          <Separator />

          {/* Editable Fields */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#1C3B23]">Edit Details</h3>

            <div className="space-y-2">
              <Label>Vendor</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Enter vendor name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={receipt.currency} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReceiptCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIPT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#1C3B23] hover:bg-[#3D7237]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Read-only Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[#1C3B23]">Receipt Info</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#A0ADA3]">Project</p>
                <p className="font-medium text-[#1C3B23]">{receipt.project?.name || '-'}</p>
              </div>
              <div>
                <p className="text-[#A0ADA3]">Uploaded By</p>
                <p className="font-medium text-[#1C3B23]">
                  {receipt.uploader?.full_name || receipt.uploader?.email || '-'}
                </p>
              </div>
              <div>
                <p className="text-[#A0ADA3]">Uploaded At</p>
                <p className="font-medium text-[#1C3B23]">
                  {format(new Date(receipt.uploaded_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <p className="text-[#A0ADA3]">Task</p>
                <p className="font-medium text-[#1C3B23]">{receipt.task_id ? 'Linked' : '-'}</p>
              </div>
            </div>

            {receipt.notes && (
              <div>
                <p className="text-[#A0ADA3] text-sm">Notes</p>
                <p className="text-sm text-[#1C3B23] mt-1">{receipt.notes}</p>
              </div>
            )}
          </div>

          {/* AI Parsed Data */}
          {parsedData && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1C3B23]">AI Parsed Data</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  {parsedData.total_amount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Total Amount</span>
                      <span className="font-medium">${parsedData.total_amount}</span>
                    </div>
                  )}
                  {parsedData.tax_amount !== undefined && parsedData.tax_amount !== null && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Tax Amount</span>
                      <span className="font-medium">${parsedData.tax_amount}</span>
                    </div>
                  )}
                  {parsedData.vendor_name && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Vendor</span>
                      <span className="font-medium">{parsedData.vendor_name}</span>
                    </div>
                  )}
                  {parsedData.purchase_date && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Purchase Date</span>
                      <span className="font-medium">{parsedData.purchase_date}</span>
                    </div>
                  )}
                  {parsedData.category && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Category</span>
                      <Badge className="bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30">
                        {parsedData.category}
                      </Badge>
                    </div>
                  )}
                  {parsedData.confidence !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-[#A0ADA3]">Confidence</span>
                      <span className="font-medium">{(parsedData.confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};