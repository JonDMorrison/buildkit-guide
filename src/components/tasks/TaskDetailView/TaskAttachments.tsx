import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSignedUrl } from '@/hooks/useSignedUrl';
import { Paperclip, Plus, Download, Loader2, FileText, File } from 'lucide-react';

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  projectId: string;
  attachments: Attachment[];
  canUpload: boolean;
  onUploadComplete: () => void;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return FileText;
  return File;
};

export const TaskAttachments = ({
  taskId,
  projectId,
  attachments,
  canUpload,
  onUploadComplete,
}: TaskAttachmentsProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Generate signed URLs for all attachments
  useEffect(() => {
    const fetchSignedUrls = async () => {
      const urls: Record<string, string> = {};
      for (const attachment of attachments) {
        const url = await getSignedUrl(attachment.file_url, 'deficiency-photos');
        if (url) {
          urls[attachment.id] = url;
        }
      }
      setSignedUrls(urls);
    };
    if (attachments.length > 0) {
      fetchSignedUrls();
    }
  }, [attachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file under 50MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}.${fileExt}`;
      const filePath = `task-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('deficiency-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path (not public URL) for signed URL generation
      const { error: dbError } = await supabase.from('attachments').insert({
        task_id: taskId,
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: filePath, // Store path, not public URL
      });

      if (dbError) throw dbError;

      toast({ title: 'File uploaded successfully' });
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

  if (attachments.length === 0 && !canUpload) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Attachments
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
                  Upload
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No attachments</p>
        </div>
      ) : (
        <div className="space-y-1">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            const url = signedUrls[attachment.id];
            return (
              <a
                key={attachment.id}
                href={url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group ${!url ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
