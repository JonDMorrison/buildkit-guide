import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, User, Calendar, HardDrive } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentPreviewModalProps {
  document: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getDocumentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    plan: 'Plan / Drawing',
    rfi: 'RFI',
    permit: 'Permit',
    safety: 'Safety Document',
    contract: 'Contract',
    specification: 'Specification',
    other: 'Other',
  };
  return labels[type] || type;
};

export const DocumentPreviewModal = ({ 
  document, 
  open, 
  onOpenChange 
}: DocumentPreviewModalProps) => {
  const isImage = document.file_type.startsWith('image/');
  const isPDF = document.file_type === 'application/pdf';

  const handleDownload = () => {
    window.open(document.file_url, '_blank');
  };

  const handleOpenFullScreen = () => {
    window.open(document.file_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{document.file_name}</DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {getDocumentTypeLabel(document.document_type)}
                </Badge>
                <Badge variant="outline">
                  {isImage ? 'Image' : isPDF ? 'PDF' : 'Document'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenFullScreen}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Full Screen
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
          {/* Preview Area */}
          <div className="flex-1 bg-muted rounded-lg overflow-hidden">
            <ScrollArea className="h-full">
              {isImage ? (
                <img 
                  src={document.file_url} 
                  alt={document.file_name}
                  className="w-full h-auto"
                />
              ) : isPDF ? (
                <iframe 
                  src={document.file_url}
                  className="w-full h-full min-h-[600px]"
                  title={document.file_name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Preview not available</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Metadata */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded by</p>
                  <p className="text-sm font-medium">
                    {document.profiles?.full_name || document.profiles?.email || 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Uploaded</p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {document.file_size && (
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">File size</p>
                    <p className="text-sm font-medium">
                      {(document.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-medium">
                    {document.file_type.split('/')[1]?.toUpperCase() || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            {document.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{document.description}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
