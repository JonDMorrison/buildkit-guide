import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { pdfjs } from "@/lib/pdfjs";

interface DrawingThumbnailProps {
  fileUrl: string;
  fileType: string;
  fileName: string;
}

export const DrawingThumbnail = ({ fileUrl, fileType, fileName }: DrawingThumbnailProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfThumbnailUrl, setPdfThumbnailUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isImage = fileType?.startsWith('image/') ?? false;
  const isPDF = fileType === 'application/pdf';

  // Fetch signed URL using shared logic
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!fileUrl) {
        setLoading(false);
        return;
      }

      // If it's already a full URL (legacy data)
      if (fileUrl.startsWith('http')) {
        // Check if it's a Supabase storage URL that needs signing
        if (fileUrl.includes('/storage/v1/object/public/')) {
          const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
          if (pathMatch) {
            const filePath = pathMatch[1];
            const { data, error: signError } = await supabase.storage
              .from('project-documents')
              .createSignedUrl(filePath, 3600);

            if (signError) {
              console.error('Error creating signed URL for thumbnail:', signError);
              setSignedUrl(fileUrl);
            } else {
              setSignedUrl(data.signedUrl);
            }
          } else {
            setSignedUrl(fileUrl);
          }
        } else {
          setSignedUrl(fileUrl);
        }
        setLoading(false);
        return;
      }

      // It's a file path, generate signed URL
      const { data, error: signError } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(fileUrl, 3600);

      if (signError) {
        console.error('Error creating signed URL for thumbnail:', signError);
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    };

    fetchSignedUrl();
  }, [fileUrl]);

  // Render PDF first page as thumbnail
  useEffect(() => {
    if (!isPDF || !signedUrl || loading) return;

    const renderPdfThumbnail = async () => {
      try {
        const loadingTask = pdfjs.getDocument({ url: signedUrl });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Calculate scale to fit thumbnail (target ~200px width)
        const targetWidth = 200;
        const viewport = page.getViewport({ scale: 1, rotation: page.rotate || 0 });
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale, rotation: page.rotate || 0 });

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          setError(true);
          return;
        }

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        // Convert to data URL for display
        const dataUrl = canvas.toDataURL('image/png');
        setPdfThumbnailUrl(dataUrl);
      } catch (err) {
        console.error('Error rendering PDF thumbnail:', err);
        setError(true);
      }
    };

    renderPdfThumbnail();
  }, [isPDF, signedUrl, loading]);

  if (loading) {
    return <Skeleton className="w-full h-full" />;
  }

  // PDF with rendered thumbnail
  if (isPDF && pdfThumbnailUrl) {
    return (
      <img 
        src={pdfThumbnailUrl} 
        alt={fileName}
        className="w-full h-full object-cover"
      />
    );
  }

  // PDF still loading thumbnail or failed - show icon with PDF badge
  if (isPDF && !pdfThumbnailUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted relative">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mt-1 font-medium">PDF</span>
        {!error && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="h-1 bg-muted-foreground/20 rounded overflow-hidden">
              <div className="h-full bg-primary/50 animate-pulse w-1/2" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Non-image/non-PDF files
  if (!isImage || error || !signedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <FileText className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  // Image files
  return (
    <img 
      src={signedUrl} 
      alt={fileName}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};
