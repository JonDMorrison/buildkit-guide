import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUpload } from "./PhotoUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateDeficiencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export const CreateDeficiencyModal = ({
  isOpen,
  onClose,
  onCreate,
}: CreateDeficiencyModalProps) => {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    project_id: "",
    assigned_trade_id: "",
    location: "",
    priority: "3",
    due_date: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      fetchTrades();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_deleted", false)
      .order("name");

    if (error) {
      console.error("Error fetching projects:", error);
      return;
    }
    setProjects(data || []);
  };

  const fetchTrades = async () => {
    const { data, error } = await supabase
      .from("trades")
      .select("id, company_name, trade_type")
      .eq("is_active", true)
      .order("company_name");

    if (error) {
      console.error("Error fetching trades:", error);
      return;
    }
    setTrades(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.project_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create deficiency
      const { data: deficiency, error: deficiencyError } = await supabase
        .from("deficiencies")
        .insert({
          title: formData.title,
          description: formData.description || null,
          project_id: formData.project_id,
          assigned_trade_id: formData.assigned_trade_id || null,
          location: formData.location || null,
          priority: parseInt(formData.priority),
          due_date: formData.due_date || null,
          created_by: userData.user.id,
          status: "open",
        })
        .select()
        .single();

      if (deficiencyError) throw deficiencyError;

      // Upload photos if any
      if (photos.length > 0 && deficiency) {
        const uploadPromises = photos.map(async (photo, index) => {
          const fileExt = photo.name.split(".").pop();
          const fileName = `${deficiency.id}/${Date.now()}_${index}.${fileExt}`;
          
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from("deficiency-photos")
            .upload(fileName, photo);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("deficiency-photos")
            .getPublicUrl(fileName);

          // Create attachment record
          await supabase.from("attachments").insert({
            deficiency_id: deficiency.id,
            project_id: formData.project_id,
            file_name: photo.name,
            file_type: photo.type,
            file_url: urlData.publicUrl,
            file_size: photo.size,
            uploaded_by: userData.user.id,
          });
        });

        await Promise.all(uploadPromises);
      }

      toast({
        title: "Success",
        description: `Deficiency created${photos.length > 0 ? ` with ${photos.length} photo(s)` : ""}`,
      });

      setFormData({
        title: "",
        description: "",
        project_id: "",
        assigned_trade_id: "",
        location: "",
        priority: "3",
        due_date: "",
      });
      setPhotos([]);
      onCreate();
      onClose();
    } catch (error: any) {
      console.error("Error creating deficiency:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create deficiency",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create Deficiency</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter deficiency title"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the issue in detail"
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Project <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Assigned Trade</Label>
              <Select
                value={formData.assigned_trade_id}
                onValueChange={(value) => setFormData({ ...formData, assigned_trade_id: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select trade" />
                </SelectTrigger>
                <SelectContent>
                  {trades.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., 3rd Floor East Wing"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Critical</SelectItem>
                  <SelectItem value="2">2 - High</SelectItem>
                  <SelectItem value="3">3 - Medium</SelectItem>
                  <SelectItem value="4">4 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Due Date</Label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Photos</Label>
            <PhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={10}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="h-12">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-12 min-w-[120px]">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Deficiency"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
