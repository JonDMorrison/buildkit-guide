import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { pdfjs, defaultLoadOptions } from "@/lib/pdfjs";

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
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStartedLoading = useRef(false);

  const isImage = fileType?.startsWith('image/') ?? false;
  const isPDF = fileType === 'application/pdf';

  // Intersection Observer for lazy loading
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedLoading.current) {
            setIsVisible(true);
            hasStartedLoading.current = true;
          }
        });
      },
      {
        root: null,
        rootMargin: '100px', // Start loading 100px before visible
        threshold: 0,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fetch signed URL only when visible
  useEffect(() => {
    if (!isVisible || !fileUrl) {
      if (!fileUrl) setLoading(false);
      return;
    }

    const fetchSignedUrl = async () => {
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
  }, [fileUrl, isVisible]);

  // Render PDF first page as thumbnail - optimized for speed
  useEffect(() => {
    if (!isPDF || !signedUrl || loading) return;

    const renderPdfThumbnail = async () => {
      try {
        const loadingTask = pdfjs.getDocument({ 
          url: signedUrl, 
          ...defaultLoadOptions,
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Smaller target width for faster rendering (150px instead of 200px)
        const targetWidth = 150;
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

        // Use JPEG for smaller file size (faster conversion)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setPdfThumbnailUrl(dataUrl);
        
        // Cleanup
        pdf.destroy();
      } catch (err) {
        console.error('Error rendering PDF thumbnail:', err);
        setError(true);
      }
    };

    renderPdfThumbnail();
  }, [isPDF, signedUrl, loading]);

  // Before visible or initial loading state
  if (!isVisible || loading) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  // PDF with rendered thumbnail
  if (isPDF && pdfThumbnailUrl) {
    return (
      <div ref={containerRef} className="w-full h-full">
        <img 
          src={pdfThumbnailUrl} 
          alt={fileName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // PDF still loading thumbnail or failed - show icon with PDF badge
  if (isPDF && !pdfThumbnailUrl) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
        <div className="relative">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded">
            PDF
          </span>
        </div>
        {!error && (
          <div className="mt-2 flex gap-1">
            <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-pulse delay-100" />
            <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-pulse delay-200" />
          </div>
        )}
      </div>
    );
  }

  // Non-image, non-PDF file
  if (!isImage && !isPDF) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted/50">
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  // Image file with error
  if (error) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-muted/50">
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  // Image file - use native lazy loading
  return (
    <div ref={containerRef} className="w-full h-full">
      <img 
        src={signedUrl || fileUrl} 
        alt={fileName}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
};
