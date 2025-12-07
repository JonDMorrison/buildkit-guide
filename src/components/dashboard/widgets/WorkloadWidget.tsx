import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WorkloadWidgetProps {
  projectId: string | null;
}

interface TeamMemberWorkload {
  userId: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
  assignedTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  return email.substring(0, 2).toUpperCase();
};

const formatRole = (role: string) => {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const WorkloadWidget = ({ projectId }: WorkloadWidgetProps) => {
  const navigate = useNavigate();

  const { data: workloadData, isLoading } = useQuery({
    queryKey: ["team-workload", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      // Fetch project members with profiles
      const { data: members, error: membersError } = await supabase
        .from("project_members")
        .select(`
          user_id,
          role,
          profiles(id, full_name, email, avatar_url)
        `)
        .eq("project_id", projectId);

      if (membersError) throw membersError;

      // Fetch all task assignments for this project
      const { data: assignments, error: assignmentsError } = await supabase
        .from("task_assignments")
        .select(`
          user_id,
          task:tasks(id, status, project_id)
        `)
        .not("task", "is", null);

      if (assignmentsError) throw assignmentsError;

      // Filter assignments to current project and calculate workload
      const workloadMap = new Map<string, TeamMemberWorkload>();

      members?.forEach((member: any) => {
        if (member.profiles) {
          workloadMap.set(member.user_id, {
            userId: member.user_id,
            fullName: member.profiles.full_name,
            email: member.profiles.email,
            avatarUrl: member.profiles.avatar_url,
            role: member.role,
            assignedTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            blockedTasks: 0,
          });
        }
      });

      assignments?.forEach((assignment: any) => {
        if (assignment.task?.project_id === projectId) {
          const member = workloadMap.get(assignment.user_id);
          if (member) {
            member.assignedTasks++;
            if (assignment.task.status === "done") {
              member.completedTasks++;
            } else if (assignment.task.status === "in_progress") {
              member.inProgressTasks++;
            } else if (assignment.task.status === "blocked") {
              member.blockedTasks++;
            }
          }
        }
      });

      return Array.from(workloadMap.values())
        .sort((a, b) => b.assignedTasks - a.assignedTasks);
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Card className="widget-card h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Workload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const membersWithTasks = workloadData?.filter(m => m.assignedTasks > 0) || [];
  const membersWithoutTasks = workloadData?.filter(m => m.assignedTasks === 0) || [];
  const maxTasks = Math.max(...(workloadData?.map(m => m.assignedTasks) || [1]), 1);

  return (
    <Card 
      className="widget-card h-full cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => navigate("/users")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Workload
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto max-h-[300px]">
        {workloadData?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No team members in this project
          </p>
        ) : (
          <>
            {membersWithTasks.map((member) => {
              const completionRate = member.assignedTasks > 0 
                ? Math.round((member.completedTasks / member.assignedTasks) * 100) 
                : 0;

              return (
                <div 
                  key={member.userId} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={member.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials(member.fullName, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {member.fullName || member.email}
                      </p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {formatRole(member.role)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={(member.assignedTasks / maxTasks) * 100} 
                        className="h-1.5 flex-1"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-medium">{member.assignedTasks}</span>
                        <span className="text-xs text-muted-foreground">tasks</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="text-status-complete">{member.completedTasks} done</span>
                      <span>•</span>
                      <span className="text-status-progress">{member.inProgressTasks} active</span>
                      {member.blockedTasks > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-status-issue">{member.blockedTasks} blocked</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {membersWithoutTasks.length > 0 && membersWithTasks.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Unassigned team members</p>
                <div className="flex flex-wrap gap-1">
                  {membersWithoutTasks.slice(0, 5).map((member) => (
                    <Avatar key={member.userId} className="h-6 w-6 border border-border">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {getInitials(member.fullName, member.email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {membersWithoutTasks.length > 5 && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      +{membersWithoutTasks.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};