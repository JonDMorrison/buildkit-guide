import { useState, useEffect, useRef, useCallback } from "react";
import { pdfjs, defaultLoadOptions } from "@/lib/pdfjs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Bug,
} from "lucide-react";

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

interface DebugInfo {
  containerWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  baseScale: number;
  renderScale: number;
  pixelRatio: number;
  loadMethod: "url" | "arrayBuffer" | "none";
  renderStarted: string | null;
  renderCompleted: string | null;
  ocgEnabled: boolean;
  pageRotation: number;
  effectiveRotation: number;
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

// Debug overlay component
const DebugOverlay = ({ info }: { info: DebugInfo }) => (
  <div className="absolute top-2 left-2 z-30 bg-black/80 text-white text-xs font-mono p-3 rounded-lg max-w-xs overflow-auto">
    <div className="font-bold mb-2 text-yellow-400">🐛 PDF Debug Info</div>
    <div className="space-y-1">
      <div>Container: {info.containerWidth}px</div>
      <div>Viewport: {info.viewportWidth} × {info.viewportHeight}</div>
      <div>Canvas: {info.canvasWidth} × {info.canvasHeight}</div>
      <div>Base scale: {info.baseScale.toFixed(3)}</div>
      <div>Render scale: {info.renderScale.toFixed(3)}</div>
      <div>Pixel ratio: {info.pixelRatio}</div>
      <div>Load method: <span className={info.loadMethod === "arrayBuffer" ? "text-green-400" : "text-blue-400"}>{info.loadMethod}</span></div>
      <div>Page rotation: {info.pageRotation}°</div>
      <div>Effective rotation: {info.effectiveRotation}°</div>
      <div>OCG forced: {info.ocgEnabled ? "✅" : "❌"}</div>
      <div className="text-gray-400 mt-2">
        {info.renderStarted && <div>Started: {info.renderStarted}</div>}
        {info.renderCompleted && <div>Completed: {info.renderCompleted}</div>}
      </div>
    </div>
  </div>
);

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
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    containerWidth: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    baseScale: 0,
    renderScale: 0,
    pixelRatio: 1,
    loadMethod: "none",
    renderStarted: null,
    renderCompleted: null,
    ocgEnabled: false,
    pageRotation: 0,
    effectiveRotation: 0,
  });
  const [loadMethod, setLoadMethod] = useState<"url" | "arrayBuffer">("url");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  // Track container size with ResizeObserver + fallback measurement
  useEffect(() => {
    if (!containerRef.current) return;

    // Immediate measurement fallback
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.width !== containerWidth) {
          console.log(`[PDF] Container measured: ${rect.width}px`);
          setContainerWidth(rect.width);
        }
      }
    };

    // Measure immediately
    measureContainer();
    // Also measure after a short delay (in case of layout settling)
    const timeoutId = setTimeout(measureContainer, 100);
    const timeoutId2 = setTimeout(measureContainer, 500);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && width !== containerWidth) {
          console.log(`[PDF] ResizeObserver width: ${width}px`);
          setContainerWidth(width);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      resizeObserver.disconnect();
    };
  }, [containerWidth]);

  // Re-measure when PDF doc loads (container might be ready now)
  useEffect(() => {
    if (pdfDoc && containerRef.current && containerWidth === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        console.log(`[PDF] Post-load container: ${rect.width}px`);
        setContainerWidth(rect.width);
      }
    }
  }, [pdfDoc, containerWidth]);

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
      setThumbnails([]);

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
      setDebugInfo(prev => ({ ...prev, loadMethod: usedMethod }));

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
          setDebugInfo(prev => ({ ...prev, ocgEnabled: true }));
        }
      } catch (ocgErr) {
        console.log("[PDF] No OCG or error reading OCG:", ocgErr);
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
    if (!pdfDoc || !canvasRef.current || containerWidth === 0) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setPageLoading(true);
    const renderStartTime = new Date().toISOString();
    setDebugInfo(prev => ({ ...prev, renderStarted: renderStartTime, renderCompleted: null }));

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

      // Calculate scale to fit container width with some padding
      const padding = 32;
      const availableWidth = containerWidth - padding;
      const baseScale = availableWidth / unscaledViewport.width;

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

      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        containerWidth,
        viewportWidth: Math.round(viewport.width),
        viewportHeight: Math.round(viewport.height),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        baseScale,
        renderScale,
        pixelRatio,
        pageRotation,
        effectiveRotation,
      }));

      console.log(`[PDF] Rendering page ${currentPage}: canvas=${canvas.width}x${canvas.height}, scale=${renderScale.toFixed(3)}`);

      const renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        const renderEndTime = new Date().toISOString();
        setDebugInfo(prev => ({ ...prev, renderCompleted: renderEndTime }));
        console.log(`[PDF] Page ${currentPage} render completed at ${renderEndTime}`);
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
  }, [pdfDoc, currentPage, containerWidth, rotation]);

  useEffect(() => {
    if (!useIframeFallback) {
      renderPage();
    }
  }, [renderPage, useIframeFallback]);

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
        const effectiveRotation = (page.rotate || 0) % 360;
        const viewport = page.getViewport({ scale: 0.2, rotation: effectiveRotation });

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
          {/* Debug toggle */}
          <Button
            variant={showDebug ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowDebug(!showDebug)}
            className="h-8 w-8"
            title="Show debug info"
          >
            <Bug className="h-4 w-4" />
          </Button>
          
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
          
          {/* Iframe fallback toggle */}
          <div className="flex items-center gap-2 px-2">
            <Switch
              id="iframe-mode"
              checked={useIframeFallback}
              onCheckedChange={setUseIframeFallback}
            />
            <Label htmlFor="iframe-mode" className="text-xs cursor-pointer">
              Browser
            </Label>
          </div>
          
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
        {/* Debug overlay */}
        {showDebug && <DebugOverlay info={debugInfo} />}
        
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
