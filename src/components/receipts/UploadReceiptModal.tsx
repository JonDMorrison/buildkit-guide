import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
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

  // Form fields
  const [taskId, setTaskId] = useState<string>('');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    clearFile();
    setTaskId('');
    setAmount('');
    setCurrency('CAD');
    setVendor('');
    setCategory('other');
    setNotes('');
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      // Compress image
      const compressedBlob = await compressImage(file);

      // Generate file path: {project_id}/{year}/{month}/{receipt_id}.jpg
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

      // Insert receipt record
      const { error: dbError } = await supabase.from('receipts').insert({
        id: receiptId,
        project_id: projectId,
        task_id: taskId || null,
        uploaded_by: user.id,
        file_path: filePath,
        amount: amount ? parseFloat(amount) : null,
        currency,
        vendor: vendor || null,
        category,
        notes: notes || null,
      });

      if (dbError) throw dbError;

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

          {/* Task (Optional) */}
          <div className="space-y-2">
            <Label>Task (Optional)</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No task</SelectItem>
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
                Uploading...
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
