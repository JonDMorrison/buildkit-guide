import { useState, useEffect, useRef, useCallback } from "react";
import { pdfjs, defaultLoadOptions } from "@/lib/pdfjs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  FileText,
} from "lucide-react";

interface PdfViewerProps {
  signedUrl: string;
  fileName?: string;
  onOpenExternal: () => void;
  onRetry?: () => void;
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
  const [containerHeight, setContainerHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [loadMethod, setLoadMethod] = useState<"url" | "arrayBuffer">("url");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  // Track container size with ResizeObserver + fallback measurement
  // Use ref to track last dimensions and avoid stale closure issues
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Immediate measurement fallback
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use clientWidth/Height as fallback - more reliable in some flex contexts
        const width = rect.width || containerRef.current.clientWidth;
        const height = rect.height || containerRef.current.clientHeight || 400; // Fallback minimum
        
        // Only update if we have valid dimensions that differ from stored values
        if (width > 0 && height >= 100) {
          if (width !== lastWidthRef.current || height !== lastHeightRef.current) {
            console.log(`[PDF] Container measured: ${width}px x ${height}px`);
            lastWidthRef.current = width;
            lastHeightRef.current = height;
            setContainerWidth(width);
            setContainerHeight(height);
          }
        }
      }
    };

    // Measure immediately
    measureContainer();
    // Also measure after delays to catch layout settling
    const timeoutId = setTimeout(measureContainer, 100);
    const timeoutId2 = setTimeout(measureContainer, 300);
    const timeoutId3 = setTimeout(measureContainer, 600);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize if available (more accurate) or fallback to contentRect
        const borderBox = entry.borderBoxSize?.[0];
        const width = borderBox?.inlineSize || entry.contentRect.width;
        const height = borderBox?.blockSize || entry.contentRect.height || 400;
        
        if (width > 0 && height >= 100) {
          if (width !== lastWidthRef.current || height !== lastHeightRef.current) {
            console.log(`[PDF] ResizeObserver: ${width}px x ${height}px`);
            lastWidthRef.current = width;
            lastHeightRef.current = height;
            setContainerWidth(width);
            setContainerHeight(height);
          }
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      resizeObserver.disconnect();
    };
  }, []); // Run once on mount - no dependencies needed

  // Re-measure when PDF doc loads (container might be ready now)
  useEffect(() => {
    if (pdfDoc && containerRef.current) {
      // Always try to get accurate measurements after PDF loads
      const measureAfterLoad = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 50) {
            if (rect.width !== lastWidthRef.current || rect.height !== lastHeightRef.current) {
              console.log(`[PDF] Post-load container: ${rect.width}px x ${rect.height}px`);
              lastWidthRef.current = rect.width;
              lastHeightRef.current = rect.height;
              setContainerWidth(rect.width);
              setContainerHeight(rect.height);
            }
          }
        }
      };
      
      // Measure immediately and with delays
      measureAfterLoad();
      const t1 = setTimeout(measureAfterLoad, 100);
      const t2 = setTimeout(measureAfterLoad, 300);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [pdfDoc]);

  // Load PDF document with fallback to arrayBuffer method
  useEffect(() => {
    if (!signedUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setCurrentPage(1);
      setTotalPages(0);
      

      // Try URL method first
      let doc: PDFDocumentProxy | null = null;
      let usedMethod: "url" | "arrayBuffer" = "url";

      try {
        console.log("[PDF] Attempting URL load method...");
        const loadingTask = pdfjs.getDocument({
          url: signedUrl,
          ...defaultLoadOptions,
        });

        doc = await loadingTask.promise;
        console.log(`[PDF] URL method succeeded. Pages: ${doc.numPages}`);
      } catch (urlErr) {
        console.warn("[PDF] URL method failed, trying arrayBuffer fallback:", urlErr);
        
        // Fallback to arrayBuffer method
        try {
          const response = await fetch(signedUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          console.log(`[PDF] Downloaded ${arrayBuffer.byteLength} bytes, loading via arrayBuffer...`);
          
          const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            ...defaultLoadOptions,
          });

          doc = await loadingTask.promise;
          usedMethod = "arrayBuffer";
          console.log(`[PDF] ArrayBuffer method succeeded. Pages: ${doc.numPages}`);
        } catch (bufErr) {
          console.error("[PDF] ArrayBuffer method also failed:", bufErr);
          throw bufErr;
        }
      }

      if (cancelled) {
        doc?.destroy();
        return;
      }

      setLoadMethod(usedMethod);

      // Force all Optional Content Groups (layers) to be visible
      try {
        const ocConfig = await doc.getOptionalContentConfig();
        if (ocConfig) {
          console.log("[PDF] Optional Content Groups found, forcing all visible");
          // Get all groups and set them visible
          const groups = ocConfig.getGroups();
          if (groups && typeof groups === 'object') {
            Object.keys(groups).forEach(groupId => {
              ocConfig.setVisibility(groupId, true);
            });
          }
        }
      } catch (ocgErr) {
        console.log("[PDF] No OCG or error reading OCG:", ocgErr);
      }

      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setLoading(false);
    };

    loadPdf().catch(err => {
      console.error("Error loading PDF:", err);
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Failed to load PDF document"
        );
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  // Render current page when page/container changes
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || containerWidth === 0 || containerHeight === 0) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setPageLoading(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      currentPageRef.current = page;

      const pageRotation = page.rotate || 0;
      // Respect the PDF page's built-in rotation (some drawing sets come rotated)
      const effectiveRotation = (pageRotation + rotation) % 360;

      // Get viewport at scale 1 to calculate dimensions
      const unscaledViewport = page.getViewport({
        scale: 1,
        rotation: effectiveRotation,
      });

      // Calculate scale to fit container - use smaller of width or height to fit whole page
      const padding = 16; // Minimal padding for better space utilization
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding;
      
      const scaleX = availableWidth / unscaledViewport.width;
      const scaleY = availableHeight / unscaledViewport.height;
      const baseScale = Math.min(scaleX, scaleY); // Fit entire page in view

      // Use device pixel ratio for sharper rendering on high-DPI screens
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const renderScale = baseScale * pixelRatio;

      const viewport = page.getViewport({
        scale: renderScale,
        rotation: effectiveRotation,
      });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not get canvas context");
      }

      // Clear canvas before rendering
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Set display size (CSS)
      canvas.style.width = `${viewport.width / pixelRatio}px`;
      canvas.style.height = `${viewport.height / pixelRatio}px`;

      console.log(`[PDF] Rendering page ${currentPage}: canvas=${canvas.width}x${canvas.height}, scale=${renderScale.toFixed(3)}`);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        console.log(`[PDF] Page ${currentPage} render completed`);
      } catch (renderErr) {
        // If it's not a cancellation, surface the error
        if (renderErr instanceof Error && !renderErr.message.includes("Rendering cancelled")) {
          console.error("[PDF] Render error:", renderErr);
          setError(`Failed to render page: ${renderErr.message}`);
        }
        throw renderErr;
      }
      renderTaskRef.current = null;
    } catch (err) {
      // Ignore cancelled render errors
      if (err instanceof Error && err.message.includes("Rendering cancelled")) {
        return;
      }
      console.error("[PDF] Error rendering page:", err);
    } finally {
      setPageLoading(false);
    }
  }, [pdfDoc, currentPage, containerWidth, containerHeight, rotation]);

  useEffect(() => {
    if (!useIframeFallback) {
      renderPage();
    }
  }, [renderPage, useIframeFallback]);

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
        <div className="flex gap-2 flex-wrap justify-center">
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" onClick={() => setUseIframeFallback(true)}>
            Use Browser Viewer
          </Button>
          <Button onClick={onOpenExternal}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open PDF
          </Button>
        </div>
      </div>
    );
  }

  // Iframe fallback mode
  if (useIframeFallback) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">Browser PDF Viewer</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseIframeFallback(false)}
            >
              Try Canvas Viewer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenExternal}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open PDF
            </Button>
          </div>
        </div>
        <iframe
          src={signedUrl}
          className="flex-1 w-full border-0"
          title={fileName || "PDF Document"}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
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

        {/* Open External */}
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


      {/* PDF Canvas with Zoom/Pan */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-muted relative min-h-0 h-full"
        style={{ minHeight: '400px' }}
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
