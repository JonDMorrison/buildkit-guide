import { useNavigate } from "react-router-dom";
import { Users, HardHat, Briefcase, Shield, Wrench, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  trade_name?: string | null;
}

interface CrewInfoModalProps {
  crewCount: number;
  teamMembers: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "admin":
      return <Shield className="h-3.5 w-3.5" />;
    case "project_manager":
      return <Briefcase className="h-3.5 w-3.5" />;
    case "foreman":
      return <HardHat className="h-3.5 w-3.5" />;
    case "internal_worker":
      return <Users className="h-3.5 w-3.5" />;
    case "external_trade":
      return <Wrench className="h-3.5 w-3.5" />;
    default:
      return <UserCog className="h-3.5 w-3.5" />;
  }
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "destructive";
    case "project_manager":
      return "default";
    case "foreman":
      return "secondary";
    default:
      return "outline";
  }
};

const formatRole = (role: string) => {
  return role.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

export const CrewInfoModal = ({ 
  crewCount, 
  teamMembers, 
  open, 
  onOpenChange 
}: CrewInfoModalProps) => {
  const navigate = useNavigate();

  // Group members by role
  const roleGroups = teamMembers.reduce((acc, member) => {
    const role = member.role;
    if (!acc[role]) acc[role] = [];
    acc[role].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  const roleOrder = ["admin", "project_manager", "foreman", "internal_worker", "external_trade"];
  const sortedRoles = Object.keys(roleGroups).sort(
    (a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Crew on Site
          </DialogTitle>
        </DialogHeader>

        {/* Crew count */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <HardHat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{crewCount}</p>
            <p className="text-xs text-muted-foreground">Workers on site today</p>
          </div>
        </div>

        {/* Team members list */}
        <div>
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Users className="h-3.5 w-3.5" />
            Project Team ({teamMembers.length})
          </div>
          
          <ScrollArea className="h-[240px]">
            <div className="space-y-1 pr-2">
              {sortedRoles.map((role) => (
                <div key={role} className="space-y-1">
                  {roleGroups[role].map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        {getRoleIcon(member.role)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.full_name || member.email}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant={getRoleBadgeVariant(member.role)} 
                            className="text-[10px] px-1.5 py-0"
                          >
                            {formatRole(member.role)}
                          </Badge>
                          {member.trade_name && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {member.trade_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              
              {teamMembers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No team members yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate("/daily-logs");
            }}
          >
            Update Count
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate("/users");
            }}
          >
            Manage Team
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
