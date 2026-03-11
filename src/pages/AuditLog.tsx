import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { NoAccess } from "@/components/NoAccess";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, Database } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}

const AuditLog = () => {
  const { isAdmin, loading: roleLoading } = useAuthRole();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchAuditLog();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchAuditLog = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*,profiles(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error("Error fetching audit log:", error);
    } finally {
      setLoading(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <NoAccess
            title="Admin Access Required"
            message="Only administrators can view the audit log."
            returnPath="/"
            returnLabel="Back to Projects"
          />
        </div>
      </Layout>
    );
  }

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      INSERT: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
    };
    return (
      <Badge variant={variants[action] || "default"}>
        {action}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <SectionHeader
          title="Audit Log"
          subtitle="Recent system activity and changes"
          count={entries.length}
        />

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3">
            {entries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No audit entries found</p>
                </CardContent>
              </Card>
            ) : (
              entries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action)}
                          <span className="text-sm font-medium">
                            {entry.table_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {entry.profiles && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>
                                {entry.profiles.full_name || entry.profiles.email}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(entry.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>

                        {entry.action === "UPDATE" && entry.old_data && entry.new_data && (
                          <div className="text-xs space-y-1 mt-2">
                            <p className="font-medium">Changes:</p>
                            <div className="bg-muted p-2 rounded">
                              {Object.keys(entry.new_data)
                                .filter(key => 
                                  JSON.stringify(entry.old_data[key]) !== JSON.stringify(entry.new_data[key])
                                )
                                .map(key => (
                                  <div key={key} className="py-1">
                                    <span className="font-medium">{key}:</span>{" "}
                                    <span className="line-through text-muted-foreground">
                                      {JSON.stringify(entry.old_data[key])}
                                    </span>{" "}
                                    → {JSON.stringify(entry.new_data[key])}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
};

export default AuditLog;
