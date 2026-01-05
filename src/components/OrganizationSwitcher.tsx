import { memo, useCallback } from "react";
import { ChevronDown, Check, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/useOrganization";

export const OrganizationSwitcher = memo(function OrganizationSwitcher() {
  const { 
    organizations, 
    activeOrganization, 
    setActiveOrganizationId, 
    orgRole,
    loading 
  } = useOrganization();

  const handleOrgSelect = useCallback((orgId: string) => {
    setActiveOrganizationId(orgId);
  }, [setActiveOrganizationId]);

  // Only show switcher if user has multiple orgs
  if (loading || organizations.length <= 1) {
    return null;
  }

  // Only show to roles above internal_worker
  const allowedRoles = ['admin', 'project_manager', 'foreman', 'accounting'];
  if (orgRole && !allowedRoles.includes(orgRole)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Building2 className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {activeOrganization?.name || "Select Organization"}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleOrgSelect(org.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="truncate">{org.name}</span>
            {activeOrganization?.id === org.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
