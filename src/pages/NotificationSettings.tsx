import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle2 } from "lucide-react";

interface NotificationPreferences {
  task_assigned: boolean;
  blocker_added: boolean;
  blocker_cleared: boolean;
  manpower_request: boolean;
  manpower_approved: boolean;
  manpower_denied: boolean;
  deficiency_created: boolean;
  safety_alert: boolean;
  document_uploaded: boolean;
  incident_report: boolean;
  general: boolean;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    task_assigned: true,
    blocker_added: true,
    blocker_cleared: true,
    manpower_request: true,
    manpower_approved: true,
    manpower_denied: true,
    deficiency_created: true,
    safety_alert: true,
    document_uploaded: true,
    incident_report: true,
    general: true,
  });

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPreferences({
          task_assigned: data.task_assigned,
          blocker_added: data.blocker_added,
          blocker_cleared: data.blocker_cleared,
          manpower_request: data.manpower_request,
          manpower_approved: data.manpower_approved,
          manpower_denied: data.manpower_denied,
          deficiency_created: data.deficiency_created,
          safety_alert: data.safety_alert,
          document_uploaded: data.document_uploaded,
          incident_report: data.incident_report,
          general: data.general,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error loading preferences',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    setSaving(true);
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user?.id,
          ...newPreferences,
        });

      if (error) throw error;

      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating preferences',
        description: error.message,
        variant: 'destructive',
      });
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const notificationTypes = [
    {
      key: 'task_assigned' as const,
      label: 'Task Assignments',
      description: 'Get notified when you are assigned to a task',
    },
    {
      key: 'blocker_added' as const,
      label: 'Task Blockers',
      description: 'Get notified when a task you\'re assigned to is blocked',
    },
    {
      key: 'blocker_cleared' as const,
      label: 'Blockers Cleared',
      description: 'Get notified when a blocker on your task is resolved',
    },
    {
      key: 'manpower_request' as const,
      label: 'Manpower Requests',
      description: 'Get notified about new manpower requests (PMs only)',
    },
    {
      key: 'manpower_approved' as const,
      label: 'Manpower Approvals',
      description: 'Get notified when your manpower request is approved',
    },
    {
      key: 'manpower_denied' as const,
      label: 'Manpower Denials',
      description: 'Get notified when your manpower request is denied',
    },
    {
      key: 'deficiency_created' as const,
      label: 'Deficiencies',
      description: 'Get notified about new deficiencies for your trade',
    },
    {
      key: 'safety_alert' as const,
      label: 'Safety Alerts',
      description: 'Get notified about safety forms and incidents',
    },
    {
      key: 'document_uploaded' as const,
      label: 'Document Uploads',
      description: 'Get notified when important documents are uploaded',
    },
    {
      key: 'incident_report' as const,
      label: 'Incident Reports',
      description: 'Get notified about safety incident reports',
    },
    {
      key: 'general' as const,
      label: 'General Notifications',
      description: 'Get notified about general project updates',
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-2xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full max-w-xs" />
                  </div>
                  <Skeleton className="h-6 w-11" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-primary/10 p-2">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Notification Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your notification preferences</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Choose which notifications you want to receive. Changes are saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {notificationTypes.map((type) => (
              <div key={type.key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor={type.key} className="text-sm font-medium text-foreground">
                    {type.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
                <Switch
                  id={type.key}
                  checked={preferences[type.key]}
                  onCheckedChange={(checked) => updatePreference(type.key, checked)}
                  disabled={saving}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NotificationSettings;
