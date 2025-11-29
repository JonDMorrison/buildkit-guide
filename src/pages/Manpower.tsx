import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { ChevronLeft, ChevronRight, Users, CheckCircle, XCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from "date-fns";

export default function Manpower() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'14day' | 'monthly'>('14day');
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentProjectId } = useCurrentProject();
  const { can, loading: roleLoading } = useAuthRole(currentProjectId || undefined);

  // Check permissions
  const canRequestManpower = currentProjectId ? can('request_manpower', currentProjectId) : false;
  const canApprove = currentProjectId ? can('approve_manpower', currentProjectId) : false;

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("manpower_requests")
        .select(`
          *,
          trades:trade_id (
            name,
            company_name,
            trade_type
          ),
          projects:project_id (
            name
          ),
          created_by_profile:created_by (
            full_name
          ),
          tasks:task_id (
            title
          )
        `)
        .eq("is_deleted", false)
        .order("required_date", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Error fetching manpower requests:", error);
      toast({
        title: "Error",
        description: "Failed to load manpower requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApproval = async (requestId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from("manpower_requests")
        .update({
          status: approved ? "approved" : "rejected",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Request ${approved ? "approved" : "rejected"} successfully`,
      });

      fetchRequests();
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    }
  };

  const getDaysInMonth = () => {
    if (viewMode === '14day') {
      // Return next 14 days starting from today
      const days = [];
      const today = new Date();
      for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        days.push(date);
      }
      return days;
    } else {
      // Monthly view
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return eachDayOfInterval({ start, end });
    }
  };

  const getRequestsForDate = (date: Date) => {
    return requests.filter((request) => {
      const requestDate = parseISO(request.required_date);
      const endDate = request.duration_days 
        ? new Date(requestDate.getTime() + request.duration_days * 24 * 60 * 60 * 1000)
        : requestDate;
      
      return date >= requestDate && date <= endDate;
    });
  };

  const getTotalWorkersForDate = (date: Date) => {
    return getRequestsForDate(date).reduce((sum, req) => sum + req.requested_count, 0);
  };

  const getTradeBreakdown = (date: Date) => {
    const dateRequests = getRequestsForDate(date);
    const breakdown = new Map<string, number>();
    
    dateRequests.forEach((req) => {
      const tradeName = req.trades?.name || "Unknown";
      breakdown.set(tradeName, (breakdown.get(tradeName) || 0) + req.requested_count);
    });
    
    return Array.from(breakdown.entries()).map(([trade, count]) => ({ trade, count }));
  };

  const days = getDaysInMonth();
  const today = new Date();

  // Show NoAccess for workers
  if (!roleLoading && currentProjectId && !canRequestManpower) {
    return (
      <Layout>
        <NoAccess 
          title="Manpower Access Restricted"
          message="Only Project Managers and Foremen can view and manage manpower requests."
          returnPath="/tasks"
          returnLabel="Back to My Tasks"
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 pb-24 space-y-6">
        <SectionHeader
          title="Manpower Calendar"
          subtitle="Worker requirements by date and trade"
        />

        {/* View Mode Toggle and Month Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === '14day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('14day')}
            >
              14-Day View
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('monthly')}
            >
              Monthly View
            </Button>
          </div>

          {viewMode === 'monthly' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <h2 className="text-lg font-bold">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {days.map((day) => {
              const totalWorkers = getTotalWorkersForDate(day);
              const tradeBreakdown = getTradeBreakdown(day);
              const isToday = isSameDay(day, today);
              
              if (totalWorkers === 0) return null;

              return (
                <Card
                  key={day.toISOString()}
                  className={`p-4 ${isToday ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold">
                        {format(day, "EEEE, MMM d")}
                      </h3>
                      {isToday && (
                        <Badge variant="default" className="mt-1">Today</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="text-2xl font-bold">{totalWorkers}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">By Trade:</p>
                    <div className="flex flex-wrap gap-2">
                      {tradeBreakdown.map(({ trade, count }) => (
                        <Badge key={trade} variant="secondary" className="text-sm">
                          {trade}: {count}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Show linked tasks if any */}
                    {getRequestsForDate(day).some(req => req.tasks) && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Linked Tasks:</p>
                        <div className="space-y-1">
                          {getRequestsForDate(day)
                            .filter(req => req.tasks)
                            .map(req => (
                              <p key={req.id} className="text-xs text-muted-foreground">
                                • {req.tasks.title}
                              </p>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pending Approvals Section (PM/Admin only) */}
        {canApprove && (
          <div className="space-y-4">
            <SectionHeader
              title="Pending Approvals"
              subtitle="Review and approve manpower requests"
            />

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {requests
                  .filter((req) => req.status === "pending")
                  .map((request) => (
                    <Card key={request.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-lg">
                              {request.projects?.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Requested by {request.created_by_profile?.full_name}
                            </p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Trade</p>
                            <p className="font-medium">{request.trades?.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Workers Needed</p>
                            <p className="font-bold text-xl">{request.requested_count}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Start Date</p>
                            <p className="font-medium">
                              {format(parseISO(request.required_date), "MMM d, yyyy")}
                            </p>
                          </div>
                          {request.duration_days && (
                            <div>
                              <p className="text-sm text-muted-foreground">Duration</p>
                              <p className="font-medium">{request.duration_days} days</p>
                            </div>
                          )}
                        </div>

                        {request.reason && (
                          <div>
                            <p className="text-sm text-muted-foreground">Reason</p>
                            <p className="text-sm">{request.reason}</p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproval(request.id, true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleApproval(request.id, false)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                {requests.filter((req) => req.status === "pending").length === 0 && (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No pending approvals</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
