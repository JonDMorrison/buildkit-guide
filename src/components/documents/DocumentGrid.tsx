import { formatDistanceToNow } from "date-fns";
import { FileText, Image as ImageIcon, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DocumentGridProps {
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
    specification: 'Spec',
    other: 'Other',
  };
  return labels[type] || type;
};

export const DocumentGrid = ({ documents, onPreview }: DocumentGridProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {documents.map((doc) => {
        const Icon = getDocumentIcon(doc.file_type);
        const isImage = doc.file_type.startsWith('image/');
        
        return (
          <div
            key={doc.id}
            onClick={() => onPreview(doc)}
            className={cn(
              "group cursor-pointer rounded-lg border border-border bg-card overflow-hidden",
              "hover:border-primary/50 hover:shadow-md transition-all"
            )}
          >
            {/* Thumbnail/Preview */}
            <div className="aspect-[4/3] bg-muted flex items-center justify-center relative overflow-hidden">
              {isImage ? (
                <img 
                  src={doc.file_url} 
                  alt={doc.file_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon className="h-16 w-16 text-muted-foreground" />
              )}
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs">
                  {getDocumentTypeLabel(doc.document_type)}
                </Badge>
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h4 className="font-semibold text-sm truncate mb-1">
                {doc.file_name}
              </h4>
              <p className="text-xs text-muted-foreground truncate mb-2">
                {doc.profiles?.full_name || doc.profiles?.email || 'Unknown'}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </span>
                {doc.file_size && (
                  <span>
                    {(doc.file_size / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
