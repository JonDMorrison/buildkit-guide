import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, X, Loader2, Sparkles, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { compressImage, formatFileSize } from '@/lib/imageCompression';
import { RECEIPT_CATEGORIES, ReceiptCategory } from '@/hooks/useReceipts';

interface UploadReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploadComplete?: () => void;
}

interface Task {
  id: string;
  title: string;
}

interface ParsedReceiptData {
  total_amount: number | null;
  tax_amount: number | null;
  currency: string;
  vendor_name: string | null;
  purchase_date: string | null;
  category: string;
  confidence: number;
}

export const UploadReceiptModal = ({
  open,
  onOpenChange,
  projectId,
  onUploadComplete,
}: UploadReceiptModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  // AI parsing state
  const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [aiParsed, setAiParsed] = useState(false);

  // Form fields
  const [taskId, setTaskId] = useState<string>('none');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<ReceiptCategory>('other');
  const [notes, setNotes] = useState('');

  // Fetch tasks for this project
  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId) return;
      const { data } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('title');
      setTasks(data || []);
    };
    if (open) fetchTasks();
  }, [projectId, open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setUploadedReceiptId(null);
    setUploadedFilePath(null);
    setAiParsed(false);

    // Pre-compress to show estimated size
    try {
      const compressed = await compressImage(selectedFile);
      setCompressedSize(compressed.size);
    } catch (error) {
      console.error('Compression preview error:', error);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setCompressedSize(null);
    setUploadedReceiptId(null);
    setUploadedFilePath(null);
    setAiParsed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    clearFile();
    setTaskId('none');
    setAmount('');
    setCurrency('CAD');
    setVendor('');
    setCategory('other');
    setNotes('');
  };

  // Upload image and create receipt record (for AI parsing)
  const uploadImageForParsing = async (): Promise<{ receiptId: string; filePath: string } | null> => {
    if (!file || !user) return null;

    try {
      // Compress image
      const compressedBlob = await compressImage(file);

      // Generate file path
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const receiptId = crypto.randomUUID();
      const filePath = `${projectId}/${year}/${month}/${receiptId}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create receipt record with minimal data
      const { error: dbError } = await supabase.from('receipts').insert({
        id: receiptId,
        project_id: projectId,
        uploaded_by: user.id,
        file_path: filePath,
        category: 'other',
      });

      if (dbError) throw dbError;

      return { receiptId, filePath };
    } catch (error) {
      console.error('Upload for parsing error:', error);
      throw error;
    }
  };

  const handleAIParse = async () => {
    if (!file || !user) return;

    setIsParsing(true);

    try {
      let receiptId = uploadedReceiptId;
      let filePath = uploadedFilePath;

      // If not already uploaded, upload first
      if (!receiptId) {
        const result = await uploadImageForParsing();
        if (!result) {
          throw new Error('Failed to upload image');
        }
        receiptId = result.receiptId;
        filePath = result.filePath;
        setUploadedReceiptId(receiptId);
        setUploadedFilePath(filePath);
      }

      // Call AI parse function
      const { data, error } = await supabase.functions.invoke('ai-parse-receipt', {
        body: { receipt_id: receiptId },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const parsed: ParsedReceiptData = data.data;

        // Fill form fields with parsed data
        if (parsed.total_amount !== null) {
          setAmount(parsed.total_amount.toString());
        }
        if (parsed.currency) {
          setCurrency(parsed.currency === 'Other' ? 'CAD' : parsed.currency);
        }
        if (parsed.vendor_name) {
          setVendor(parsed.vendor_name);
        }
        if (parsed.category && RECEIPT_CATEGORIES.some(c => c.value === parsed.category)) {
          setCategory(parsed.category as ReceiptCategory);
        }

        setAiParsed(true);
        toast({
          title: 'Fields filled',
          description: 'Please review and save.',
        });
      } else {
        throw new Error(data?.error || 'Parsing failed');
      }
    } catch (error: any) {
      console.error('AI parse error:', error);
      toast({
        title: 'Could not read this receipt',
        description: 'Please enter details manually.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      let receiptId = uploadedReceiptId;
      let filePath = uploadedFilePath;

      // If already uploaded (from AI parsing), just update the record
      if (receiptId && filePath) {
        const { error: updateError } = await supabase
          .from('receipts')
          .update({
            task_id: taskId === 'none' ? null : taskId || null,
            amount: amount ? parseFloat(amount) : null,
            currency,
            vendor: vendor || null,
            category,
            notes: notes || null,
          })
          .eq('id', receiptId);

        if (updateError) throw updateError;
      } else {
        // Fresh upload without AI parsing
        const compressedBlob = await compressImage(file);

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        receiptId = crypto.randomUUID();
        filePath = `${projectId}/${year}/${month}/${receiptId}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, compressedBlob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from('receipts').insert({
          id: receiptId,
          project_id: projectId,
          task_id: taskId === 'none' ? null : taskId || null,
          uploaded_by: user.id,
          file_path: filePath,
          amount: amount ? parseFloat(amount) : null,
          currency,
          vendor: vendor || null,
          category,
          notes: notes || null,
        });

        if (dbError) throw dbError;
      }

      toast({
        title: 'Receipt uploaded',
        description: 'Your receipt has been saved successfully.',
      });

      resetForm();
      onOpenChange(false);
      onUploadComplete?.();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!preview ? (
              <Button
                type="button"
                variant="outline"
                className="w-full h-32 border-dashed flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-muted-foreground">Tap to take photo or select image</span>
              </Button>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={clearFile}
                >
                  <X className="h-4 w-4" />
                </Button>
                {compressedSize && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    Compressed: {formatFileSize(compressedSize)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Auto-fill Button */}
          {preview && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#DC8644] text-[#DC8644] hover:bg-[#DC8644]/10"
              onClick={handleAIParse}
              disabled={isParsing || uploading}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reading receipt...
                </>
              ) : aiParsed ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Fields filled - Review below
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-fill with AI
                </>
              )}
            </Button>
          )}

          {/* Task (Optional) */}
          <div className="space-y-2">
            <Label>Task (Optional)</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Input
              placeholder="Store or vendor name"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          {/* Category */}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Save Receipt
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
