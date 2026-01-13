import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  FileText,
  Layers,
} from "lucide-react";

// Set up PDF.js worker - use inline worker to avoid CDN/CORS issues
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfViewerProps {
  signedUrl: string;
  fileName?: string;
  onOpenExternal: () => void;
  onRetry?: () => void;
}

interface PageThumbnail {
  pageNum: number;
  dataUrl: string | null;
  loading: boolean;
}

// Separate component for zoom controls to access transform state via context
const ZoomControls = () => {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const scale = instance.transformState.scale;

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-background/90 backdrop-blur rounded-lg border shadow-lg p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => zoomIn()}
        className="h-8 w-8"
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <span className="text-xs text-center py-1 text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => zoomOut()}
        className="h-8 w-8"
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="w-full h-px bg-border my-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => resetTransform()}
        className="h-8 w-8"
        title="Reset zoom"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const PdfViewer = ({
  signedUrl,
  fileName,
  onOpenExternal,
  onRetry,
}: PdfViewerProps) => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [rotation, setRotation] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  // Track container size with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && width !== containerWidth) {
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [containerWidth]);

  // Load PDF document
  useEffect(() => {
    if (!signedUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setCurrentPage(1);
      setTotalPages(0);
      setThumbnails([]);

      try {
        const loadingTask = pdfjs.getDocument({
          url: signedUrl,
          disableAutoFetch: false,
        });

        const doc = await loadingTask.promise;

        if (cancelled) {
          doc.destroy();
          return;
        }

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setThumbnails(
          Array.from({ length: doc.numPages }, (_, i) => ({
            pageNum: i + 1,
            dataUrl: null,
            loading: false,
          }))
        );
      } catch (err) {
        console.error("Error loading PDF:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load PDF document"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  // Render current page when page/container changes
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || containerWidth === 0) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setPageLoading(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      currentPageRef.current = page;

      // Get viewport at scale 1 to calculate dimensions
      const unscaledViewport = page.getViewport({ scale: 1, rotation });

      // Calculate scale to fit container width with some padding
      const padding = 32;
      const availableWidth = containerWidth - padding;
      const baseScale = availableWidth / unscaledViewport.width;

      // Use device pixel ratio for sharper rendering on high-DPI screens
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const renderScale = baseScale * pixelRatio;

      const viewport = page.getViewport({ scale: renderScale, rotation });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not get canvas context");
      }

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Set display size (CSS)
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      // Ignore cancelled render errors
      if (err instanceof Error && err.message.includes("Rendering cancelled")) {
        return;
      }
      console.error("Error rendering page:", err);
    } finally {
      setPageLoading(false);
    }
  }, [pdfDoc, currentPage, containerWidth, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Generate thumbnails lazily
  const generateThumbnail = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc) return;

      // Check if already loading or loaded
      const existing = thumbnails.find((t) => t.pageNum === pageNum);
      if (existing?.dataUrl || existing?.loading) return;

      // Mark as loading
      setThumbnails((prev) =>
        prev.map((t) =>
          t.pageNum === pageNum ? { ...t, loading: true } : t
        )
      );

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.2, rotation: 0 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const dataUrl = canvas.toDataURL("image/png", 0.7);

        setThumbnails((prev) =>
          prev.map((t) =>
            t.pageNum === pageNum
              ? { ...t, dataUrl, loading: false }
              : t
          )
        );
      } catch (err) {
        console.error(`Error generating thumbnail for page ${pageNum}:`, err);
        setThumbnails((prev) =>
          prev.map((t) =>
            t.pageNum === pageNum ? { ...t, loading: false } : t
          )
        );
      }
    },
    [pdfDoc, thumbnails, rotation]
  );

  // Generate first few thumbnails when panel opens
  useEffect(() => {
    if (!showThumbnails || !pdfDoc) return;

    // Generate first 5 thumbnails immediately, then queue the rest
    const initialBatch = Math.min(5, totalPages);

    for (let i = 1; i <= initialBatch; i++) {
      generateThumbnail(i);
    }

    // Queue remaining with delays to avoid blocking
    for (let i = initialBatch + 1; i <= totalPages; i++) {
      setTimeout(() => generateThumbnail(i), (i - initialBatch) * 100);
    }
  }, [showThumbnails, pdfDoc, totalPages, generateThumbnail]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handlePageJump = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // Trigger re-load by resetting error
      setError(null);
      setLoading(true);
      // Force re-run of load effect
      setPdfDoc(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading PDF...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">Unable to load PDF</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button onClick={onOpenExternal}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open PDF
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30 flex-wrap">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[80px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom & Tools */}
        <div className="flex items-center gap-1">
          {totalPages > 1 && (
            <Button
              variant={showThumbnails ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowThumbnails(!showThumbnails)}
              className="h-8 w-8"
              title="Show pages"
            >
              <Layers className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRotate}
            className="h-8 w-8"
            title="Rotate"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExternal}
            className="h-8 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Open PDF</span>
          </Button>
        </div>
      </div>

      {/* Thumbnail Strip */}
      {showThumbnails && totalPages > 1 && (
        <div className="border-b bg-muted/20 p-2">
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {thumbnails.map((thumb) => (
                <button
                  key={thumb.pageNum}
                  onClick={() => handlePageJump(thumb.pageNum)}
                  className={`flex-shrink-0 w-16 h-20 rounded border-2 overflow-hidden transition-all ${
                    thumb.pageNum === currentPage
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {thumb.dataUrl ? (
                    <img
                      src={thumb.dataUrl}
                      alt={`Page ${thumb.pageNum}`}
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      {thumb.loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b border-primary" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {thumb.pageNum}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* PDF Canvas with Zoom/Pan */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted relative"
      >
        {pageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit
          doubleClick={{ mode: "toggle", step: 0.7 }}
          panning={{ velocityDisabled: true }}
          wheel={{ smoothStep: 0.05 }}
        >
          <ZoomControls />
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
            }}
            contentStyle={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100%",
              touchAction: "none",
            }}
          >
            <canvas
              ref={canvasRef}
              className="shadow-lg"
              style={{
                background: "white",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
};
