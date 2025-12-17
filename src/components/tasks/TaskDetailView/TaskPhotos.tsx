import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Camera, Plus, X, Loader2, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

interface TaskPhotosProps {
  taskId: string;
  projectId: string;
  attachments: Attachment[];
  canUpload: boolean;
  onUploadComplete: () => void;
}

export const TaskPhotos = ({
  taskId,
  projectId,
  attachments,
  canUpload,
  onUploadComplete,
}: TaskPhotosProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}.${fileExt}`;
      const filePath = `task-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('deficiency-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('deficiency-photos')
        .getPublicUrl(filePath);

      // Create attachment record
      const { error: dbError } = await supabase.from('attachments').insert({
        task_id: taskId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: urlData.publicUrl,
      });

      if (dbError) throw dbError;

      toast({ title: 'Photo uploaded successfully' });
      onUploadComplete();
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Camera className="h-4 w-4 text-muted-foreground" />
          Photos
          {attachments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {attachments.length}
            </Badge>
          )}
        </div>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-7 px-2"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Photo
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No photos yet</p>
          {canUpload && (
            <Button
              variant="link"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 h-auto p-0"
            >
              Upload a photo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setPreviewUrl(photo.file_url)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
            >
              <img
                src={photo.file_url}
                alt={photo.file_name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Photo Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
