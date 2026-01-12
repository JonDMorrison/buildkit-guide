import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type StorageBucket = 'task-photos' | 'deficiency-photos';

interface UploadedFile {
  fileName: string;
  filePath: string; // Store the path, not the public URL
  fileUrl: string; // For backward compatibility - now contains the path
  fileType: string;
  fileSize: number;
}

interface UploadOptions {
  bucket: StorageBucket;
  pathPrefix: string; // e.g., `${projectId}/${taskId}` or `${deficiencyId}`
  maxSizeMB?: number;
  allowedTypes?: string[]; // e.g., ['image/jpeg', 'image/png']
}

interface AttachmentRecord {
  project_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_url: string; // Now stores the file path for signed URL generation
  file_size: number;
  task_id?: string;
  deficiency_id?: string;
  safety_form_id?: string;
}

interface UsePhotoUploadReturn {
  uploading: boolean;
  uploadSingle: (file: File, options: UploadOptions) => Promise<UploadedFile | null>;
  uploadMultiple: (files: File[], options: UploadOptions) => Promise<UploadedFile[]>;
  createAttachmentRecord: (record: AttachmentRecord) => Promise<boolean>;
  validateFile: (file: File, options: Pick<UploadOptions, 'maxSizeMB' | 'allowedTypes'>) => boolean;
}

export const usePhotoUpload = (): UsePhotoUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const validateFile = (
    file: File, 
    options: Pick<UploadOptions, 'maxSizeMB' | 'allowedTypes'>
  ): boolean => {
    const { maxSizeMB = 10, allowedTypes = ['image/'] } = options;
    
    // Check file type
    const isValidType = allowedTypes.some(type => 
      type.endsWith('/') 
        ? file.type.startsWith(type) 
        : file.type === type
    );
    
    if (!isValidType) {
      toast({
        title: 'Invalid file type',
        description: `Please select a valid file type`,
        variant: 'destructive',
      });
      return false;
    }

    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Please select a file under ${maxSizeMB}MB`,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const uploadSingle = async (
    file: File, 
    options: UploadOptions
  ): Promise<UploadedFile | null> => {
    const { bucket, pathPrefix, maxSizeMB, allowedTypes } = options;

    if (!validateFile(file, { maxSizeMB, allowedTypes })) {
      return null;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${pathPrefix}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Return the file path instead of public URL for signed URL generation
      return {
        fileName: file.name,
        filePath: filePath,
        fileUrl: filePath, // Store path in file_url for backward compatibility
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadMultiple = async (
    files: File[], 
    options: UploadOptions
  ): Promise<UploadedFile[]> => {
    const { bucket, pathPrefix, maxSizeMB, allowedTypes } = options;

    // Validate all files first
    const validFiles = files.filter(file => 
      validateFile(file, { maxSizeMB, allowedTypes })
    );

    if (validFiles.length === 0) return [];

    setUploading(true);
    const results: UploadedFile[] = [];

    try {
      const uploadPromises = validFiles.map(async (file, index) => {
        const fileExt = file.name.split('.').pop();
        const filePath = `${pathPrefix}/${Date.now()}_${index}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Return the file path instead of public URL
        return {
          fileName: file.name,
          filePath: filePath,
          fileUrl: filePath, // Store path for backward compatibility
          fileType: file.type,
          fileSize: file.size,
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      results.push(...uploaded);
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }

    return results;
  };

  const createAttachmentRecord = async (record: AttachmentRecord): Promise<boolean> => {
    try {
      const { error } = await supabase.from('attachments').insert(record);
      if (error) throw error;
      return true;
    } catch (err: any) {
      toast({
        title: 'Failed to save attachment',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    uploading,
    uploadSingle,
    uploadMultiple,
    createAttachmentRecord,
    validateFile,
  };
};
