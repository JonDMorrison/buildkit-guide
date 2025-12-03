import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, X, Loader2, Sparkles, Check, AlertCircle, Files } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { compressImage, formatFileSize } from '@/lib/imageCompression';
import { cn } from '@/lib/utils';

interface BatchUploadReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadComplete?: () => void;
}

interface ReceiptFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'parsing' | 'done' | 'error';
  progress: number;
  receiptId?: string;
  filePath?: string;
  parsedData?: {
    amount: number | null;
    currency: string;
    vendor: string | null;
    category: string;
  };
  error?: string;
}

export const BatchUploadReceiptModal = ({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
}: BatchUploadReceiptModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<ReceiptFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: ReceiptFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (!file.type.startsWith('image/')) {
        continue;
      }

      newFiles.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      });
    }

    if (newFiles.length === 0) {
      toast({
        title: 'No valid images',
        description: 'Please select image files only.',
        variant: 'destructive',
      });
      return;
    }

    setFiles((prev) => [...prev, ...newFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateFileStatus = (
    id: string,
    updates: Partial<ReceiptFile>
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const processFile = async (receiptFile: ReceiptFile): Promise<void> => {
    if (!user) return;

    try {
      // Step 1: Upload
      updateFileStatus(receiptFile.id, { status: 'uploading', progress: 20 });
      
      const compressedBlob = await compressImage(receiptFile.file);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const receiptId = crypto.randomUUID();
      const filePath = `${projectId}/${year}/${month}/${receiptId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      updateFileStatus(receiptFile.id, { progress: 40, receiptId, filePath });

      // Step 2: Create receipt record
      const { error: dbError } = await supabase.from('receipts').insert({
        id: receiptId,
        project_id: projectId,
        uploaded_by: user.id,
        file_path: filePath,
        category: 'other',
      });

      if (dbError) throw dbError;

      updateFileStatus(receiptFile.id, { status: 'parsing', progress: 60 });

      // Step 3: AI Parse
      const { data, error: parseError } = await supabase.functions.invoke('ai-parse-receipt', {
        body: { receipt_id: receiptId },
      });

      if (parseError) {
        console.error('AI parse error:', parseError);
        // Still mark as done, just without AI data
        updateFileStatus(receiptFile.id, {
          status: 'done',
          progress: 100,
          receiptId,
          filePath,
        });
        return;
      }

      if (data?.success && data?.data) {
        updateFileStatus(receiptFile.id, {
          status: 'done',
          progress: 100,
          receiptId,
          filePath,
          parsedData: {
            amount: data.data.total_amount,
            currency: data.data.currency || 'CAD',
            vendor: data.data.vendor_name,
            category: data.data.category || 'other',
          },
        });
      } else {
        updateFileStatus(receiptFile.id, {
          status: 'done',
          progress: 100,
          receiptId,
          filePath,
        });
      }
    } catch (error: any) {
      console.error('Process file error:', error);
      updateFileStatus(receiptFile.id, {
        status: 'error',
        progress: 0,
        error: error.message || 'Upload failed',
      });
    }
  };

  const processAllFiles = async () => {
    if (files.length === 0 || !user) return;

    setIsProcessing(true);
    setOverallProgress(0);

    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error');
    const totalFiles = pendingFiles.length;
    let completedFiles = 0;

    // Process files sequentially to avoid overwhelming the server
    for (const file of pendingFiles) {
      await processFile(file);
      completedFiles++;
      setOverallProgress(Math.round((completedFiles / totalFiles) * 100));
    }

    setIsProcessing(false);

    const successCount = files.filter((f) => f.status === 'done').length;
    const errorCount = files.filter((f) => f.status === 'error').length;

    if (errorCount === 0) {
      toast({
        title: 'All receipts uploaded',
        description: `${successCount} receipt${successCount !== 1 ? 's' : ''} processed successfully.`,
      });
    } else {
      toast({
        title: 'Upload completed with errors',
        description: `${successCount} succeeded, ${errorCount} failed.`,
        variant: 'destructive',
      });
    }

    onUploadComplete?.();
  };

  const handleClose = () => {
    if (isProcessing) return;
    
    // Clean up previews
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    setFiles([]);
    setOverallProgress(0);
    onOpenChange(false);
  };

  const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'error').length;
  const doneCount = files.filter((f) => f.status === 'done').length;

  const getStatusIcon = (status: ReceiptFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'parsing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const getStatusText = (file: ReceiptFile) => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...';
      case 'parsing':
        return 'Reading with AI...';
      case 'done':
        if (file.parsedData?.vendor) {
          return `${file.parsedData.vendor} - ${file.parsedData.currency} ${file.parsedData.amount?.toFixed(2) || '?'}`;
        }
        return 'Uploaded';
      case 'error':
        return file.error || 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Files className="h-5 w-5" />
            Batch Upload Receipts
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelect}
              className="hidden"
              disabled={isProcessing}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full h-24 border-dashed flex flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">
                Select multiple receipt images
              </span>
            </Button>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg border bg-card',
                      file.status === 'error' && 'border-destructive/50 bg-destructive/5',
                      file.status === 'done' && 'border-green-500/30 bg-green-500/5'
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <img
                        src={file.preview}
                        alt="Receipt"
                        className="h-12 w-12 object-cover rounded"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getStatusText(file)}
                      </p>
                      {(file.status === 'uploading' || file.status === 'parsing') && (
                        <Progress value={file.progress} className="h-1 mt-1" />
                      )}
                    </div>

                    {/* Status/Actions */}
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      {file.status === 'pending' && !isProcessing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Overall Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing...</span>
                <span className="font-medium">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} />
            </div>
          )}

          {/* Summary */}
          {files.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
              <span>
                {files.length} receipt{files.length !== 1 ? 's' : ''} selected
                {doneCount > 0 && ` • ${doneCount} done`}
              </span>
              {pendingCount > 0 && (
                <span className="text-primary font-medium">
                  {pendingCount} to process
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isProcessing}
            >
              {doneCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
            </Button>
            {pendingCount > 0 && (
              <Button
                className="flex-1"
                onClick={processAllFiles}
                disabled={isProcessing || pendingCount === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upload & Parse All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
