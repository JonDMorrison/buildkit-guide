import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DrawingThumbnailProps {
  fileUrl: string;
  fileType: string;
  fileName: string;
}

export const DrawingThumbnail = ({ fileUrl, fileType, fileName }: DrawingThumbnailProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = fileType?.startsWith('image/') ?? false;

  useEffect(() => {
    const fetchSignedUrl = async () => {
      // If it's already a full URL (legacy data), use it directly
      if (fileUrl.startsWith('http')) {
        setSignedUrl(fileUrl);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(fileUrl, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL for thumbnail:', error);
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };

    fetchSignedUrl();
  }, [fileUrl]);

  if (loading) {
    return <Skeleton className="w-full h-full" />;
  }

  if (!isImage || error || !signedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <FileText className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img 
      src={signedUrl} 
      alt={fileName}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};
