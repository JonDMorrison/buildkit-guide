import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, Receipt as ReceiptIcon, Loader2, Sparkles } from 'lucide-react';
import { useReceipts, Receipt, RECEIPT_CATEGORIES } from '@/hooks/useReceipts';
import { UploadReceiptModal } from './UploadReceiptModal';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import { format } from 'date-fns';

interface WorkerReceiptsViewProps {
  projectId: string;
  userId: string;
}

const ReceiptThumbnail = ({
  filePath,
  getSignedUrl,
}: {
  filePath: string;
  getSignedUrl: (filePath: string) => Promise<string | null>;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const signedUrl = await getSignedUrl(filePath);
      setUrl(signedUrl);
      setLoading(false);
    };
    load();
  }, [filePath, getSignedUrl]);

  if (loading) {
    return (
      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
        <ReceiptIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Receipt thumbnail"
      className="w-16 h-16 object-cover rounded-lg shrink-0"
    />
  );
};

export const WorkerReceiptsView = ({ projectId, userId }: WorkerReceiptsViewProps) => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Only fetch user's own receipts
  const { receipts, loading, refetch, getSignedUrl, deleteReceipt } = useReceipts({
    projectId,
    uploadedBy: userId,
  });

  const handleReceiptClick = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDetailModalOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1C3B23]">Receipts</h1>
        <p className="text-[#A0ADA3] mt-1">Snap a photo and attach it to this project.</p>
      </div>

      {/* Upload Button - Large and prominent for mobile */}
      <Button
        onClick={() => setUploadModalOpen(true)}
        className="w-full h-14 text-lg bg-[#1C3B23] hover:bg-[#3D7237] text-white"
        size="lg"
      >
        <Camera className="h-6 w-6 mr-3" />
        Upload Receipt
      </Button>

      {/* AI Auto-fill hint */}
      <Card className="p-4 bg-[#DC8644]/10 border-[#DC8644]/30">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[#DC8644]" />
          <div>
            <p className="text-sm font-medium text-[#1C3B23]">AI Auto-fill coming soon</p>
            <p className="text-xs text-[#A0ADA3]">Snap a photo and we'll extract the details automatically.</p>
          </div>
        </div>
      </Card>

      {/* My Receipts Section */}
      <div>
        <h2 className="text-lg font-semibold text-[#1C3B23] mb-4">My Receipts</h2>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <ReceiptIcon className="h-12 w-12 mx-auto text-[#A0ADA3] mb-4" />
            <h3 className="font-medium text-[#1C3B23] mb-1">No receipts yet</h3>
            <p className="text-sm text-[#A0ADA3]">
              Upload your first receipt to get started
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => {
              const categoryLabel = RECEIPT_CATEGORIES.find((c) => c.value === receipt.category)?.label || receipt.category;

              return (
                <Card
                  key={receipt.id}
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border border-[#A0ADA3]/20 shadow-sm"
                  onClick={() => handleReceiptClick(receipt)}
                >
                  <div className="flex gap-4">
                    <ReceiptThumbnail filePath={receipt.file_path} getSignedUrl={getSignedUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {receipt.vendor && (
                            <p className="font-medium text-[#1C3B23] truncate">{receipt.vendor}</p>
                          )}
                          {receipt.amount ? (
                            <span className="text-lg font-semibold text-[#1C3B23]">
                              {receipt.currency} ${receipt.amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#A0ADA3]">No amount</span>
                          )}
                        </div>
                        <Badge 
                          variant="outline" 
                          className="text-xs shrink-0 bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30"
                        >
                          {categoryLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#A0ADA3] mt-2">
                        {format(new Date(receipt.uploaded_at), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadReceiptModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        projectId={projectId}
        onUploadComplete={refetch}
      />

      {/* Detail Modal */}
      <ReceiptDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        receipt={selectedReceipt}
        projectId={projectId}
        getSignedUrl={getSignedUrl}
        onDelete={deleteReceipt}
      />
    </div>
  );
};
