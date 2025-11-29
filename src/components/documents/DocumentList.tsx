import { formatDistanceToNow } from "date-fns";
import { FileText, Image as ImageIcon, File, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DocumentListProps {
  documents: any[];
  onPreview: (doc: any) => void;
}

const getDocumentIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) {
    return ImageIcon;
  } else if (fileType === 'application/pdf') {
    return FileText;
  }
  return File;
};

const getDocumentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    plan: 'Plan',
    rfi: 'RFI',
    permit: 'Permit',
    safety: 'Safety',
    contract: 'Contract',
    specification: 'Specification',
    other: 'Other',
  };
  return labels[type] || type;
};

export const DocumentList = ({ documents, onPreview }: DocumentListProps) => {
  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const Icon = getDocumentIcon(doc.file_type);
        
        return (
          <div
            key={doc.id}
            className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate mb-1">
                {doc.file_name}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {getDocumentTypeLabel(doc.document_type)}
                </Badge>
                <span>•</span>
                <span>{doc.profiles?.full_name || doc.profiles?.email || 'Unknown'}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </span>
                {doc.file_size && (
                  <>
                    <span>•</span>
                    <span>{(doc.file_size / 1024 / 1024).toFixed(1)} MB</span>
                  </>
                )}
              </div>
            </div>

            {/* Action */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPreview(doc)}
              className="flex-shrink-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
