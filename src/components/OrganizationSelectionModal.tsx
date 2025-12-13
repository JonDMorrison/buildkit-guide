import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";

export const OrganizationSelectionModal = () => {
  const { 
    organizations, 
    activeOrganizationId,
    setActiveOrganizationId, 
    loading 
  } = useOrganization();

  // Show modal only when user has multiple orgs and none is selected
  const requiresSelection = !loading && organizations.length > 1 && !activeOrganizationId;

  if (!requiresSelection) {
    return null;
  }

  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Organization
          </DialogTitle>
          <DialogDescription>
            You belong to multiple organizations. Please select one to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          {organizations.map((org) => (
            <Button
              key={org.id}
              variant="outline"
              className="justify-start h-auto py-3 px-4"
              onClick={() => setActiveOrganizationId(org.id)}
            >
              <Building2 className="h-4 w-4 mr-3 text-muted-foreground" />
              <span>{org.name}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
