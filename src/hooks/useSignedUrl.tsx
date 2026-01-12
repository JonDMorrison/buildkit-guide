import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type StorageBucket = 'project-documents' | 'deficiency-photos' | 'task-photos' | 'receipts' | 'safety-attachments';

interface UseSignedUrlOptions {
  expirySeconds?: number;
}

/**
 * Hook to generate a signed URL for a private storage file.
 * Handles both legacy full URLs and new file paths.
 */
export const useSignedUrl = (
  fileUrl: string | null | undefined,
  bucket: StorageBucket,
  options: UseSignedUrlOptions = {}
) => {
  const { expirySeconds = 3600 } = options;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fileUrl) {
      setLoading(false);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(false);

      // If it's already a full URL (legacy data or external), use it directly
      if (fileUrl.startsWith('http')) {
        // Check if it's a Supabase storage URL that needs signing
        if (fileUrl.includes('/storage/v1/object/public/')) {
          // Extract the path from the public URL and create a signed URL
          const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          if (pathMatch) {
            const filePath = pathMatch[1];
            const { data, error: signError } = await supabase.storage
              .from(bucket)
              .createSignedUrl(filePath, expirySeconds);

            if (signError) {
              console.error('Error creating signed URL:', signError);
              // Fall back to the original URL
              setSignedUrl(fileUrl);
            } else {
              setSignedUrl(data.signedUrl);
            }
          } else {
            setSignedUrl(fileUrl);
          }
        } else {
          // External URL or data URL (base64), use as-is
          setSignedUrl(fileUrl);
        }
        setLoading(false);
        return;
      }

      // It's a file path, generate signed URL
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileUrl, expirySeconds);

      if (signError) {
        console.error('Error creating signed URL for file:', signError);
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };

    fetchSignedUrl();
  }, [fileUrl, bucket, expirySeconds]);

  return { signedUrl, loading, error };
};

/**
 * Utility function to get a signed URL imperatively (for downloads, etc.)
 */
export const getSignedUrl = async (
  fileUrl: string,
  bucket: StorageBucket,
  expirySeconds: number = 3600
): Promise<string | null> => {
  if (!fileUrl) return null;

  // If it's already a full URL (legacy data or external)
  if (fileUrl.startsWith('http')) {
    // Check if it's a Supabase storage URL that needs signing
    if (fileUrl.includes('/storage/v1/object/public/')) {
      const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
      if (pathMatch) {
        const filePath = pathMatch[1];
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, expirySeconds);

        if (error) {
          console.error('Error creating signed URL:', error);
          return fileUrl; // Fall back to original
        }
        return data.signedUrl;
      }
    }
    return fileUrl;
  }

  // It's a file path
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileUrl, expirySeconds);

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data.signedUrl;
};
