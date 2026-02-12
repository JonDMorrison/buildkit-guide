import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
}

export const LogoUpload = ({ currentUrl, onUploaded }: Props) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File must be under 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("invoice-assets").getPublicUrl(path);
    onUploaded(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Logo uploaded" });
  };

  const handleRemove = () => {
    onUploaded(null);
  };

  return (
    <div className="space-y-2">
      <Label>Company Logo</Label>
      <div className="flex items-center gap-4">
        {currentUrl ? (
          <div className="relative">
            <img src={currentUrl} alt="Company logo" className="h-16 w-auto max-w-[200px] object-contain border rounded p-1" />
            <Button
              type="button" variant="destructive" size="icon"
              className="absolute -top-2 -right-2 h-5 w-5"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="h-16 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-xs">
            No logo
          </div>
        )}
        <div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? "Uploading..." : "Upload Logo"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
        </div>
      </div>
    </div>
  );
};
