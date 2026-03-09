import { formatDistanceToNow } from "date-fns";
import { FileText, Image as ImageIcon, File, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface DocumentListProps {
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
    specification: 'Specification',
    other: 'Other',
  };
  return labels[type] || type;
};

export const DocumentList = ({ documents, onPreview, onDelete }: DocumentListProps) => {
  const { toast } = useToast();
  const { currentProjectId } = useCurrentProject();
  const { can } = useAuthRole(currentProjectId || undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = currentProjectId && can('delete_documents', currentProjectId);

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      // Delete from storage if it's in project-documents bucket
      if (documentToDelete.file_url.includes('project-documents')) {
        const filePath = documentToDelete.file_url.split('/project-documents/')[1];
        await supabase.storage.from('project-documents').remove([filePath]);
      }

      // Delete from database
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

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPreview(doc)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(doc)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
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
