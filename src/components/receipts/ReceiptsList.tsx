import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt as ReceiptIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Receipt, RECEIPT_CATEGORIES } from '@/hooks/useReceipts';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
interface ReceiptsListProps {
  receipts: Receipt[];
  loading: boolean;
  onReceiptClick: (receipt: Receipt) => void;
  getSignedUrl: (filePath: string) => Promise<string | null>;
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
  }, [filePath]);

  if (loading) {
    return (
      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
        <ReceiptIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Receipt thumbnail"
      className="w-16 h-16 object-cover rounded-lg"
    />
  );
};

export const ReceiptsList = ({
  receipts,
  loading,
  onReceiptClick,
  getSignedUrl,
}: ReceiptsListProps) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-4">
              <Skeleton className="w-16 h-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ReceiptIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium mb-1">No receipts yet</h3>
        <p className="text-sm text-muted-foreground">
          Upload your first receipt to get started
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {receipts.map((receipt) => {
        const categoryLabel =
          RECEIPT_CATEGORIES.find((c) => c.value === receipt.category)?.label || receipt.category;

        return (
          <Card
            key={receipt.id}
            className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onReceiptClick(receipt)}
          >
              <div className="flex gap-4">
              <ReceiptThumbnail filePath={receipt.file_path} getSignedUrl={getSignedUrl} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {receipt.amount ? (
                      <span className="font-semibold">
                        {receipt.currency} ${receipt.amount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No amount</span>
                    )}
                    {receipt.vendor && (
                      <span className="text-muted-foreground"> · {receipt.vendor}</span>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {categoryLabel}
                  </Badge>
                </div>
                {receipt.notified_accounting_at && (
                  <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700 shrink-0 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Sent to Accounting
                  </Badge>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {receipt.project?.job_number && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      #{receipt.project.job_number}
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground truncate">
                    {receipt.uploader?.full_name || receipt.uploader?.email}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(receipt.uploaded_at), 'MMM d, yyyy · h:mm a')}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
