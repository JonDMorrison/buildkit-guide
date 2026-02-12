import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, RefreshCw, Plus, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { useQueryClient } from "@tanstack/react-query";

export const NewUserWelcome = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCheckForProjects = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["user-projects"] });
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Hero */}
        <div className="space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Project Path</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Get started by creating your first project, or wait for your team lead to add you.
          </p>
        </div>

        {/* Path A: Create */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-semibold text-foreground">I'm setting up a new project</h2>
            <p className="text-sm text-muted-foreground">
              Create your first project and start coordinating your team.
            </p>
            <Button onClick={() => setCreateModalOpen(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Create My First Project
            </Button>
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Path B: Invited */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-semibold text-foreground">I was invited by someone</h2>
            <p className="text-sm text-muted-foreground">
              Your project manager will add you to a project. It will appear here automatically.
            </p>
            <Button
              variant="outline"
              onClick={handleCheckForProjects}
              disabled={refreshing}
              className="w-full gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Checking..." : "Check for Projects"}
            </Button>
          </CardContent>
        </Card>

        {/* Help text */}
        {user?.email && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Mail className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Still not seeing anything? Ask the person who invited you to send an invitation to{" "}
              <strong className="text-foreground">{user.email}</strong>
            </span>
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["user-projects"] });
        }}
      />
    </div>
  );
};
