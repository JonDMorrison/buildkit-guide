import { useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useAuth } from "@/hooks/useAuth";
import { VoiceCommandModal } from "@/components/voice/VoiceCommandModal";

export function VoiceButton() {
  const { user } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const [open, setOpen] = useState(false);

  if (!user || !currentProjectId) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 animate-pulse hover:animate-none"
        aria-label="Voice command"
      >
        <Mic className="h-6 w-6" />
      </Button>

      <VoiceCommandModal
        open={open}
        onOpenChange={setOpen}
        projectId={currentProjectId}
      />
    </>
  );
}
