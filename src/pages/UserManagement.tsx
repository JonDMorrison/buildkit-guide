import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useProjectRole } from "@/hooks/useProjectRole";
import { useAuth } from "@/hooks/useAuth";
import { NoAccess } from "@/components/NoAccess";
import { UserPlus, Users, Shield, Briefcase, Trash2, Edit2, Mail } from "lucide-react";
import { AddUserToProjectModal } from "@/components/users/AddUserToProjectModal";
import { InviteUserModal } from "@/components/users/InviteUserModal";
import { EditUserRoleModal } from "@/components/users/EditUserRoleModal";
import { InvitesList } from "@/components/users/InvitesList";

interface ProjectMember {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  trade_id: string | null;
  profiles: {
    full_name: string | null;
    email: string;
  };
  projects: {
    name: string;
  };
  trades: {
    name: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
}

const UserManagement = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isGlobalAdmin, loading: roleLoading } = useProjectRole();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
  const [activeTab, setActiveTab] = useState<'projects' | 'invitations'>('projects');

  useEffect(() => {
    if (!roleLoading) {
      fetchProjects();
    }
  }, [roleLoading, isGlobalAdmin]);

  useEffect(() => {
    if (selectedProject) {
      fetchMembers();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      let data: Project[] = [];

      if (isGlobalAdmin) {
        // Admins see all projects
        const { data: allProjects, error } = await supabase
          .from('projects')
          .select('id,name')
          .order('name');

        if (error) throw error;
        data = allProjects || [];
      } else {
        // Non-admins only see projects they manage
        const { data: managedProjects, error } = await supabase
          .from('project_members')
          .select('project_id,projects!inner(id,name)')
          .eq('user_id', user?.id)
          .eq('role', 'project_manager');

        if (error) throw error;

        type ManagedProjectResult = {
          projects: {
            id: string;
            name: string;
          };
        };

        data = ((managedProjects as unknown) as ManagedProjectResult[] || []).map((pm) => ({
          id: pm.projects.id,
          name: pm.projects.name,
        }));
      }

      setProjects(data);
      if (data && data.length > 0) {
        const paramProjectId = searchParams.get('projectId');
        if (paramProjectId && data.some(p => p.id === paramProjectId)) {
          setSelectedProject(paramProjectId);
        } else {
          setSelectedProject(data[0].id);
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error loading projects',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!selectedProject) return;

    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`id,user_id,project_id,role,trade_id,profiles:user_id (full_name,email),projects:project_id (name),trades:trade_id (name)`)
        .eq('project_id', selectedProject)
        .order('role');

      if (error) throw error;

      setMembers((data as unknown) as ProjectMember[] || []);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error loading members',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this project?`)) return;

    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Member removed',
        description: `${userName} has been removed from the project.`,
      });

      fetchMembers();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error removing member',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'project_manager':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'foreman':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'internal_worker':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'external_trade':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'project_manager':
        return 'Project Manager';
      case 'foreman':
        return 'Foreman';
      case 'internal_worker':
        return 'Internal Worker';
      case 'external_trade':
        return 'External Trade';
      default:
        return role;
    }
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Access control - admin only
  if (!isGlobalAdmin) {
    return (
      <Layout>
        <NoAccess title="Admin Access Required" message="Only administrators can access user management." />
      </Layout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardHeader
        title="User Management"
        subtitle="Manage project members and their roles"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setInviteModalOpen(true)} variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
            <Button onClick={() => setAddModalOpen(true)} disabled={!selectedProject}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add to Project
            </Button>
          </div>
        }
      />

        {/* Main view tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'projects' | 'invitations')} className="mb-6">
          <TabsList>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Project Members
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invitations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-6">
            {/* Project tabs */}
            <Tabs value={selectedProject || ''} onValueChange={setSelectedProject}>
              <TabsList className="w-full mb-6 overflow-x-auto flex-wrap h-auto">
                {projects.map((project) => (
                  <TabsTrigger key={project.id} value={project.id} className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {project.name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {projects.map((project) => (
                <TabsContent key={project.id} value={project.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Members</CardTitle>
                      <CardDescription>
                        {members.length} {members.length === 1 ? 'member' : 'members'} on {project.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {members.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Users className="h-12 w-12 text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">
                            No members on this project yet. Add users to get started.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-foreground truncate">
                                      {member.profiles?.full_name || 'Unnamed User'}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={getRoleBadgeColor(member.role)}
                                    >
                                      {getRoleLabel(member.role)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {member.profiles?.email}
                                  </p>
                                  {member.trades && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Trade: {member.trades.name}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setEditModalOpen(true);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveMember(
                                      member.id,
                                      member.profiles?.full_name || member.profiles?.email || 'User'
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <InvitesList />
          </TabsContent>
        </Tabs>

        {selectedProject && (
          <>
            <AddUserToProjectModal
              open={addModalOpen}
              onOpenChange={setAddModalOpen}
              projectId={selectedProject}
              onSuccess={() => {
                fetchMembers();
                setAddModalOpen(false);
              }}
            />

            {selectedMember && (
              <EditUserRoleModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                member={selectedMember}
                onSuccess={() => {
                  fetchMembers();
                  setEditModalOpen(false);
                }}
              />
            )}
          </>
        )}

        <InviteUserModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          onSuccess={() => {
            setInviteModalOpen(false);
          }}
        />
    </DashboardLayout>
  );
};

export default UserManagement;
