import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  FileText, 
  User, 
  Calendar, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Maximize2,
  History,
  ExternalLink,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/hooks/useSignedUrl";
import { PdfViewer } from "./PdfViewer";
import type { Drawing, DrawingRevision } from "@/types/drawings";

interface DrawingViewerProps {
  drawing: Drawing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadRevision?: () => void;
}

export const DrawingViewer = ({ 
  drawing, 
  open, 
  onOpenChange,
  onUploadRevision
}: DrawingViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [revisionHistory, setRevisionHistory] = useState<DrawingRevision[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Safely check file type with null guard
  const isImage = drawing?.file_type?.startsWith('image/') ?? false;
  const isPDF = drawing?.file_type === 'application/pdf';

  useEffect(() => {
    if (open && drawing?.id) {
      // Reset view state when opening new drawing
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageError(false);
      setSignedUrl(null);

      fetchRevisionHistory();
      fetchSignedUrl();
    }
  }, [drawing?.id, open]);

  const fetchSignedUrl = async () => {
    setUrlLoading(true);
    setImageError(false);
    try {
      const url = await getSignedUrl(drawing.file_url, 'project-documents');
      setSignedUrl(url);
    } catch (error) {
      console.error('Error fetching signed URL:', error);
      setSignedUrl(null);
    }
    setUrlLoading(false);
  };

  const fetchRevisionHistory = async () => {
    // Find all versions of this drawing by sheet number
    if (!drawing.sheet_number) {
      setRevisionHistory([drawing]);
      return;
    }

    const { data } = await supabase
      .from('attachments')
      .select('*, profiles(full_name)')
      .eq('project_id', drawing.project_id)
      .eq('sheet_number', drawing.sheet_number)
      .order('revision_date', { ascending: false });

    setRevisionHistory(data || [drawing]);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch support for mobile
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / lastTouchDistance;
      setZoom(prev => Math.min(Math.max(prev * scale, 0.25), 4));
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleDownload = async () => {
    const url = signedUrl || await getSignedUrl(drawing.file_url, 'project-documents');
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleFullScreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg sm:text-xl mb-2 truncate">{drawing.file_name}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {drawing.sheet_number && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {drawing.sheet_number}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Rev {drawing.revision_number || 'A'}
                </Badge>
                {revisionHistory.length > 1 && (
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-secondary/80 text-xs"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <History className="h-3 w-3 mr-1" />
                    {revisionHistory.length} ver
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {onUploadRevision && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUploadRevision}
                  className="text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Upload Revision</span>
                  <span className="sm:hidden">Upload</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handleDownload}
                className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Download</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleFullScreen}
                className="h-8 w-8 sm:h-9 sm:w-9"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Revision History Sidebar */}
          {showHistory && (
            <div className="w-64 border-r bg-muted/30 overflow-hidden flex flex-col">
              <div className="p-3 border-b">
                <h4 className="font-semibold text-sm">Revision History</h4>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {revisionHistory.map((rev, idx) => (
                    <div 
                      key={rev.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        rev.id === drawing.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-card hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold">
                          Rev {rev.revision_number || 'A'}
                        </span>
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-xs">Latest</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rev.profiles?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rev.revision_date 
                          ? formatDistanceToNow(new Date(rev.revision_date), { addSuffix: true })
                          : formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Main Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-2 p-2 border-b bg-muted/30">
              <Button variant="ghost" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-16 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-2" />
              <Button variant="ghost" size="icon" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>

            {/* Drawing Canvas */}
            <div 
              ref={containerRef}
              className="flex-1 overflow-hidden bg-muted flex items-center justify-center touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {urlLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
                  <p className="text-sm text-muted-foreground">Loading drawing...</p>
                </div>
              ) : !signedUrl ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Unable to load drawing</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    There was an error loading this file.
                  </p>
                  <Button onClick={fetchSignedUrl}>
                    Try Again
                  </Button>
                </div>
              ) : imageError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Unable to display drawing</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The image could not be loaded. Try downloading it instead.
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              ) : isImage ? (
                <img 
                  src={signedUrl} 
                  alt={drawing.file_name}
                  className="max-w-none select-none"
                  draggable={false}
                  onError={() => setImageError(true)}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                  }}
                />
              ) : isPDF ? (
                signedUrl ? (
                  <PdfViewer
                    signedUrl={signedUrl}
                    fileName={drawing.file_name}
                    onOpenExternal={handleDownload}
                    onRetry={fetchSignedUrl}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Unable to load PDF</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      There was an error loading this PDF.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleDownload}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open PDF
                      </Button>
                      <Button variant="outline" onClick={fetchSignedUrl}>
                        Retry
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Preview not available</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This file type cannot be previewed.
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{drawing.profiles?.full_name || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatDistanceToNow(new Date(drawing.created_at), { addSuffix: true })}
              </span>
            </div>
            {drawing.file_size && (
              <span className="text-muted-foreground">
                {(drawing.file_size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
