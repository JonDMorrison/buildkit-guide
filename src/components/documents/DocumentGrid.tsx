import { formatDistanceToNow } from "date-fns";
import { FileText, Image as ImageIcon, File, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface Document {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  document_type: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface DocumentGridProps {
  documents: Document[];
  onPreview: (doc: Document) => void;
  onDelete?: () => void;
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

export const DocumentGrid = ({ documents, onPreview, onDelete }: DocumentGridProps) => {
  const { toast } = useToast();
  const { currentProjectId } = useCurrentProject();
  const { can } = useAuthRole(currentProjectId || undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = currentProjectId && can('delete_documents', currentProjectId);

  const handleDeleteClick = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      if (documentToDelete.file_url.includes('project-documents')) {
        const filePath = documentToDelete.file_url.split('/project-documents/')[1];
        await supabase.storage.from('project-documents').remove([filePath]);
      }

      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', documentToDelete.id);

      if (error) throw error;

      toast({
        title: 'Document deleted',
        description: 'The document has been removed successfully',
      });

      onDelete?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while deleting the document";
      toast({
        title: 'Error deleting document',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
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
              <div className="absolute top-2 right-2 flex gap-2">
                <Badge variant="secondary" className="text-xs">
                  {getDocumentTypeLabel(doc.document_type)}
                </Badge>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDeleteClick(e, doc)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
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

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{documentToDelete?.file_name}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
