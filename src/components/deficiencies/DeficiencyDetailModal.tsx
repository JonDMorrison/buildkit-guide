import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { TradeBadge } from "@/components/TradeBadge";
import { PhotoUpload } from "./PhotoUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/hooks/useSignedUrl";
import { format } from "date-fns";
import { Loader2, MapPin, Calendar, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthRole } from "@/hooks/useAuthRole";

interface DeficiencyDetailModalProps {
  deficiencyId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface DeficiencyAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface DeficiencyDetail {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  assigned_trade_id: string | null;
  location: string | null;
  priority: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "fixed" | "verified";
  created_at: string;
  updated_at: string;
  trades?: {
    id: string;
    company_name: string;
    trade_type: string | null;
  } | null;
  created_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

export const DeficiencyDetailModal = ({
  deficiencyId,
  isOpen,
  onClose,
  onUpdate,
}: DeficiencyDetailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [deficiency, setDeficiency] = useState<DeficiencyDetail | null>(null);
  const [attachments, setAttachments] = useState<DeficiencyAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [newStatus, setNewStatus] = useState("");
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  
  const { can, isExternalTrade } = useAuthRole(deficiency?.project_id);
  const canEditStatus = deficiency?.project_id && can('edit_deficiencies', deficiency.project_id);
  const isExternalTradeRole = deficiency?.project_id && isExternalTrade(deficiency.project_id);

  useEffect(() => {
    if (deficiencyId && isOpen) {
      fetchDeficiencyDetails();
    }
  }, [deficiencyId, isOpen]);

  const fetchDeficiencyDetails = async () => {
    if (!deficiencyId) return;

    setLoading(true);
    try {
      const { data: deficiencyData, error: deficiencyError } = await supabase
        .from("deficiencies")
        .select(`
          *,
          trades:assigned_trade_id (
            id,
            company_name,
            trade_type
          ),
          created_by_profile:profiles!deficiencies_created_by_fkey (
            full_name,
            email
          )
        `)
        .eq("id", deficiencyId)
        .single();

      if (deficiencyError) throw deficiencyError;

      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from("attachments")
        .select("*")
        .eq("deficiency_id", deficiencyId)
        .order("created_at", { ascending: true });

      if (attachmentsError) throw attachmentsError;

      // Generate signed URLs for attachments
      const urls: Record<string, string> = {};
      for (const att of attachmentsData || []) {
        const url = await getSignedUrl(att.file_url, 'deficiency-photos');
        if (url) {
          urls[att.id] = url;
        }
      }
      setSignedUrls(urls);

      setDeficiency(deficiencyData as unknown as DeficiencyDetail);
      setAttachments((attachmentsData as unknown as DeficiencyAttachment[]) || []);
      setNewStatus(deficiencyData.status);
    } catch (error: unknown) {
      console.error("Error fetching deficiency:", error);
      toast({
        title: "Error",
        description: "Failed to load deficiency details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!deficiencyId || newStatus === deficiency?.status) return;

    try {
      const { error } = await supabase
        .from("deficiencies")
        .update({ status: newStatus as "open" | "in_progress" | "fixed" | "verified" })
        .eq("id", deficiencyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Deficiency status updated",
      });
      onUpdate();
      fetchDeficiencyDetails();
    } catch (error: unknown) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handlePhotoUpload = async () => {
    if (!deficiencyId || newPhotos.length === 0) return;

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const uploadPromises = newPhotos.map(async (photo, index) => {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${deficiencyId}/${Date.now()}_${index}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("deficiency-photos")
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        // Store file path instead of public URL
        await supabase.from("attachments").insert({
          deficiency_id: deficiencyId,
          project_id: deficiency.project_id,
          file_name: photo.name,
          file_type: photo.type,
          file_url: fileName, // Store path for signed URL generation
          file_size: photo.size,
          uploaded_by: userData.user.id,
        });
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Success",
        description: `${newPhotos.length} photo(s) uploaded`,
      });

      setNewPhotos([]);
      fetchDeficiencyDetails();
      onUpdate();
    } catch (error: unknown) {
      console.error("Error uploading photos:", error);
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusType = (status: string): "complete" | "progress" | "blocked" | "info" => {
    switch (status) {
      case "verified":
        return "complete";
      case "in_progress":
        return "progress";
      case "open":
        return "blocked";
      case "fixed":
        return "info";
      default:
        return "info";
    }
  };

  const photoAttachments = attachments.filter((att) => att.file_type.startsWith("image/"));
  const documentAttachments = attachments.filter((att) => !att.file_type.startsWith("image/"));

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!deficiency) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{deficiency.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* View-only warning for External Trade */}
          {isExternalTradeRole && (
            <Alert>
              <AlertDescription className="text-sm">
                You can only change status from Open to Fixed. Full editing requires PM permissions.
              </AlertDescription>
            </Alert>
          )}

          {/* Status and Trade */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge
              status={getStatusType(deficiency.status)}
              label={deficiency.status.replace("_", " ")}
            />
            {deficiency.trades && (
              <TradeBadge trade={deficiency.trades.trade_type || "general"} />
            )}
            {deficiency.priority && (
              <span className="text-sm text-muted-foreground">
                Priority: {deficiency.priority}
              </span>
            )}
          </div>

          {/* Photos */}
          {photoAttachments.length > 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Photos</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photoAttachments.map((photo) => {
                  const url = signedUrls[photo.id];
                  return (
                    <div
                      key={photo.id}
                      className={`aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-80 transition-opacity ${!url ? 'flex items-center justify-center' : ''}`}
                      onClick={() => url && window.open(url, "_blank")}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={photo.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {deficiency.description && (
            <div>
              <Label className="text-base font-semibold mb-2 block">Description</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {deficiency.description}
              </p>
            </div>
          )}

          {/* Location */}
          {deficiency.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{deficiency.location}</span>
            </div>
          )}

          {/* Due Date */}
          {deficiency.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Due: {format(new Date(deficiency.due_date), "MMMM d, yyyy")}
              </span>
            </div>
          )}

          {/* Add More Photos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Add More Photos</Label>
            <PhotoUpload
              photos={newPhotos}
              onPhotosChange={setNewPhotos}
              maxPhotos={10}
              disabled={uploading}
            />
            {newPhotos.length > 0 && (
              <Button
                onClick={handlePhotoUpload}
                disabled={uploading}
                className="w-full h-12"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${newPhotos.length} Photo${newPhotos.length > 1 ? "s" : ""}`
                )}
              </Button>
            )}
          </div>

          {/* Status Update */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Update Status</Label>
            <div className="flex gap-3">
              <Select value={newStatus} onValueChange={setNewStatus} disabled={!canEditStatus}>
                <SelectTrigger className="h-12 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  {!isExternalTradeRole && <SelectItem value="in_progress">In Progress</SelectItem>}
                  <SelectItem value="fixed">Fixed</SelectItem>
                  {!isExternalTradeRole && <SelectItem value="verified">Verified</SelectItem>}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusUpdate}
                disabled={newStatus === deficiency.status || !canEditStatus}
                className="h-12"
              >
                Update
              </Button>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Discussion</Label>
            <CommentsSection
              deficiencyId={deficiencyId}
              projectId={deficiency.project_id}
            />
          </div>

          {/* Documents */}
          {documentAttachments.length > 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Documents</Label>
              <div className="space-y-2">
                {documentAttachments.map((doc) => {
                  const url = signedUrls[doc.id];
                  return (
                    <a
                      key={doc.id}
                      href={url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors ${!url ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground truncate">{doc.file_name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Timeline</Label>
            <div className="space-y-3 pl-4 border-l-2 border-border">
              <div className="pl-4">
                <p className="text-sm font-medium text-foreground">
                  Deficiency created
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(deficiency.created_at), "MMM d, yyyy 'at' h:mm a")}
                  {deficiency.created_by_profile && (
                    <> by {deficiency.created_by_profile.full_name || deficiency.created_by_profile.email}</>
                  )}
                </p>
              </div>
              {deficiency.updated_at !== deficiency.created_at && (
                <div className="pl-4">
                  <p className="text-sm font-medium text-foreground">
                    Last updated
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(deficiency.updated_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
