import { useState, useEffect } from 'react';
import { Clock, Loader2, Bell, MapPin, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';

interface TimeTrackingSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (result: { timezoneSet: boolean; timeTrackingEnabled: boolean; configured: boolean }) => void;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Toronto', label: 'Eastern Canada' },
  { value: 'America/Vancouver', label: 'Pacific Canada' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export function TimeTrackingSettingsModal({
  open,
  onOpenChange,
  onSave,
}: TimeTrackingSettingsModalProps) {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings state
  const [timezone, setTimezone] = useState('America/New_York');
  const [timeTrackingEnabled, setTimeTrackingEnabled] = useState(false);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState(false);
  const [autoCloseHours, setAutoCloseHours] = useState([12]);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState([240]);
  const [endOfDayReminderEnabled, setEndOfDayReminderEnabled] = useState(false);
  const [endOfDayReminderTime, setEndOfDayReminderTime] = useState('17:00');
  const [gpsAccuracyWarn, setGpsAccuracyWarn] = useState([100]);

  // Load existing settings
  useEffect(() => {
    if (!open || !activeOrganizationId) return;

    const loadSettings = async () => {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (data) {
        setTimezone(data.default_timezone || 'America/New_York');
        setTimeTrackingEnabled(data.time_tracking_enabled || false);
        setAutoCloseEnabled(data.time_auto_close_enabled || false);
        setAutoCloseHours([data.time_auto_close_hours || 12]);
        setRemindersEnabled(data.time_reminders_enabled || false);
        setReminderMinutes([data.time_reminder_after_minutes || 240]);
        setEndOfDayReminderEnabled(data.time_end_of_day_reminder_enabled || false);
        setEndOfDayReminderTime(data.time_end_of_day_reminder_time_local || '17:00');
        setGpsAccuracyWarn([data.time_gps_accuracy_warn_meters || 100]);
      }

      setIsLoading(false);
    };

    loadSettings();
  }, [open, activeOrganizationId]);

  const handleSave = async () => {
    if (!activeOrganizationId) return;

    setIsSaving(true);

    try {
      const settingsData = {
        organization_id: activeOrganizationId,
        default_timezone: timezone,
        time_tracking_enabled: timeTrackingEnabled,
        time_auto_close_enabled: autoCloseEnabled,
        time_auto_close_hours: autoCloseHours[0],
        time_reminders_enabled: remindersEnabled,
        time_reminder_after_minutes: reminderMinutes[0],
        time_end_of_day_reminder_enabled: endOfDayReminderEnabled,
        time_end_of_day_reminder_time_local: endOfDayReminderTime,
        time_gps_accuracy_warn_meters: gpsAccuracyWarn[0],
        updated_at: new Date().toISOString(),
      };

      // Check if settings exist
      const { data: existing } = await supabase
        .from('organization_settings')
        .select('organization_id')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('organization_settings')
          .update(settingsData)
          .eq('organization_id', activeOrganizationId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_settings')
          .insert(settingsData);
        
        if (error) throw error;
      }

      toast({
        title: 'Settings saved',
        description: 'Time tracking settings have been updated.',
      });

      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
      queryClient.invalidateQueries({ queryKey: ['setup-progress'] });

      // Determine what was configured for setup progress
      const configured = autoCloseEnabled || remindersEnabled || endOfDayReminderEnabled;
      
      onSave?.({
        timezoneSet: !!timezone,
        timeTrackingEnabled,
        configured,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time Tracking Settings
          </DialogTitle>
          <DialogDescription>
            Configure time tracking rules, reminders, and geofencing for your organization.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Timezone Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label className="text-base font-medium">Timezone</Label>
              </div>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default timezone for all time tracking and scheduling.
              </p>
            </div>

            <Separator />

            {/* Enable Time Tracking */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Time Tracking</Label>
                <p className="text-xs text-muted-foreground">
                  Allow workers to check in/out at job sites
                </p>
              </div>
              <Switch
                checked={timeTrackingEnabled}
                onCheckedChange={setTimeTrackingEnabled}
              />
            </div>

            {timeTrackingEnabled && (
              <>
                <Separator />

                {/* Auto-Close Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Close Open Entries</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically close entries after specified hours
                      </p>
                    </div>
                    <Switch
                      checked={autoCloseEnabled}
                      onCheckedChange={setAutoCloseEnabled}
                    />
                  </div>
                  
                  {autoCloseEnabled && (
                    <div className="pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Close after</span>
                        <span className="text-sm font-medium">{autoCloseHours[0]} hours</span>
                      </div>
                      <Slider
                        value={autoCloseHours}
                        onValueChange={setAutoCloseHours}
                        min={4}
                        max={24}
                        step={1}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Reminders Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Reminders</Label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Check-out Reminders</Label>
                      <p className="text-xs text-muted-foreground">
                        Remind workers to check out after being checked in
                      </p>
                    </div>
                    <Switch
                      checked={remindersEnabled}
                      onCheckedChange={setRemindersEnabled}
                    />
                  </div>

                  {remindersEnabled && (
                    <div className="pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Remind after</span>
                        <span className="text-sm font-medium">{reminderMinutes[0]} min</span>
                      </div>
                      <Slider
                        value={reminderMinutes}
                        onValueChange={setReminderMinutes}
                        min={60}
                        max={480}
                        step={30}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>End-of-Day Reminder</Label>
                      <p className="text-xs text-muted-foreground">
                        Daily reminder to check out at a specific time
                      </p>
                    </div>
                    <Switch
                      checked={endOfDayReminderEnabled}
                      onCheckedChange={setEndOfDayReminderEnabled}
                    />
                  </div>

                  {endOfDayReminderEnabled && (
                    <div className="pl-4">
                      <Label htmlFor="eodTime" className="text-sm">Reminder Time</Label>
                      <Input
                        id="eodTime"
                        type="time"
                        value={endOfDayReminderTime}
                        onChange={(e) => setEndOfDayReminderTime(e.target.value)}
                        className="w-32 mt-1"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* GPS Accuracy Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Geofence Settings</Label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">GPS Accuracy Warning Threshold</span>
                      <span className="text-sm font-medium">{gpsAccuracyWarn[0]}m</span>
                    </div>
                    <Slider
                      value={gpsAccuracyWarn}
                      onValueChange={setGpsAccuracyWarn}
                      min={20}
                      max={500}
                      step={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Show a warning when GPS accuracy is worse than this threshold.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
