import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CommentsSectionProps {
  taskId?: string;
  deficiencyId?: string;
  projectId: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface ProjectMember {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export const CommentsSection = ({ taskId, deficiencyId, projectId }: CommentsSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    fetchComments();
    fetchProjectMembers();

    // Subscribe to new comments
    const channel = supabase
      .channel(`comments-${taskId || deficiencyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: taskId ? `task_id=eq.${taskId}` : `deficiency_id=eq.${deficiencyId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, deficiencyId]);

  const fetchComments = async () => {
    try {
      const query = supabase
        .from("comments")
        .select("*,profiles(full_name,email)")
        .order("created_at", { ascending: true });

      if (taskId) {
        query.eq("task_id", taskId);
      } else if (deficiencyId) {
        query.eq("deficiency_id", deficiencyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setComments((data as unknown as Comment[]) || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id,profiles(id,full_name,email)")
        .eq("project_id", projectId);

      if (error) throw error;
      setProjectMembers((data as unknown as ProjectMember[]) || []);
    } catch (error) {
      console.error("Error fetching project members:", error);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      // Extract mentions (@username)
      const mentionRegex = /@(\w+)/g;
      const mentionedEmails = newComment.match(mentionRegex)?.map(m => m.slice(1)) || [];
      const mentionedUserIds = projectMembers
        .filter(m => mentionedEmails.some(email => m.profiles?.email.includes(email)))
        .map(m => m.user_id);

      const { error } = await supabase.from("comments").insert({
        task_id: taskId || null,
        deficiency_id: deficiencyId || null,
        user_id: user?.id,
        content: newComment.trim(),
        mentions: mentionedUserIds,
      });

      if (error) throw error;

      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    } catch (error) {
      const err = error as Error;
      toast({
        title: "Error posting comment",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Comment deleted",
        description: "Your comment has been removed.",
      });
    } catch (error) {
      const err = error as Error;
      toast({
        title: "Error deleting comment",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        <span>Comments ({comments.length})</span>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(comment.profiles.full_name, comment.profiles.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {comment.profiles.full_name || comment.profiles.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
              </div>
              {comment.user_id === user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Comment Form */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Write a comment... (Use @email to mention someone)"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={!newComment.trim() || submitting}
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: Press Cmd/Ctrl + Enter to submit
      </p>
    </div>
  );
};
