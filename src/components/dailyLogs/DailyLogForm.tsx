import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/FormField";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useSmartDefaults } from "@/hooks/useSmartDefaults";
import { Loader2, Sparkles } from "lucide-react";

interface DailyLog {
  id: string;
  project_id: string;
  log_date: string;
  weather: string | null;
  temperature: string | null;
  crew_count: number | null;
  work_performed: string;
  issues: string | null;
  next_day_plan: string | null;
  safety_notes: string | null;
  created_by: string;
  created_at: string;
}

interface DailyLogFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingLog?: DailyLog;
}

interface DailyLogFormData {
  log_date: string;
  weather: string;
  temperature: string;
  crew_count: number | null;
  work_performed: string;
  issues: string;
  next_day_plan: string;
  safety_notes: string;
}

export const DailyLogForm = ({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  existingLog,
}: DailyLogFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const smartDefaults = useSmartDefaults(projectId || undefined);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<DailyLogFormData>({
    defaultValues: existingLog || {
      log_date: new Date().toISOString().split('T')[0],
      weather: '',
      temperature: '',
      crew_count: null,
      work_performed: '',
      issues: '',
      next_day_plan: '',
      safety_notes: '',
    },
  });

  // Pre-fill crew count and weather from most recent log (after useForm so setValue/getValues are ready)
  useEffect(() => {
    if (open && !existingLog && smartDefaults.lastCrewCount !== null) {
      const current = getValues('crew_count');
      if (current === null || current === undefined || current === 0) {
        setValue('crew_count', smartDefaults.lastCrewCount);
      }
    }
  }, [open, existingLog, smartDefaults.lastCrewCount]);

  useEffect(() => {
    if (open && !existingLog && smartDefaults.lastWeather) {
      const current = getValues('weather');
      if (!current) {
        setValue('weather', smartDefaults.lastWeather);
      }
    }
  }, [open, existingLog, smartDefaults.lastWeather]);

  const watchedWeather = watch('weather');
  const watchedCrewCount = watch('crew_count');
  const weatherCarried = !existingLog && !!smartDefaults.lastWeather && watchedWeather === smartDefaults.lastWeather;
  const crewCarried = !existingLog && smartDefaults.lastCrewCount !== null && watchedCrewCount === smartDefaults.lastCrewCount;

  const handleAutoFill = async () => {
    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assist', {
        body: {
          project_id: projectId,
          quick_action: 'daily_log_autofill',
          response_format: 'json',
          instructions: 'Respond ONLY with a valid JSON object with exactly these keys: work_performed (string), issues (string, empty string if none), next_day_plan (string). No markdown, no explanation, no extra keys.',
        },
      });

      if (error) throw error;

      const answer = data?.answer || '';
      let parsed: { work_performed?: string; issues?: string; next_day_plan?: string } = {};

      try {
        const clean = answer.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { work_performed: answer, issues: '', next_day_plan: '' };
      }

      if (parsed.work_performed) setValue('work_performed', parsed.work_performed);
      if (parsed.issues) setValue('issues', parsed.issues);
      if (parsed.next_day_plan) setValue('next_day_plan', parsed.next_day_plan);

      toast({
        title: 'Auto-filled from today\'s activity',
        description: 'Review and edit before saving',
      });
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Auto-fill failed',
        description: error.message || 'Please fill manually',
        variant: 'destructive',
      });
    } finally {
      setAutoFilling(false);
    }
  };

  const onSubmit = async (data: DailyLogFormData) => {
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      if (existingLog) {
        // Update existing log
        const { error } = await supabase
          .from('daily_logs')
          .update({
            weather: data.weather || null,
            temperature: data.temperature || null,
            crew_count: data.crew_count,
            work_performed: data.work_performed,
            issues: data.issues || null,
            next_day_plan: data.next_day_plan || null,
            safety_notes: data.safety_notes || null,
          })
          .eq('id', existingLog.id);

        if (error) throw error;

        toast({
          title: 'Daily log updated',
          description: 'Your changes have been saved',
        });
      } else {
        // Create new log
        const { error } = await supabase.from('daily_logs').insert({
          project_id: projectId,
          log_date: data.log_date,
          weather: data.weather || null,
          temperature: data.temperature || null,
          crew_count: data.crew_count,
          work_performed: data.work_performed,
          issues: data.issues || null,
          next_day_plan: data.next_day_plan || null,
          safety_notes: data.safety_notes || null,
          created_by: userData.user.id,
        });

        if (error) throw error;

        toast({
          title: 'Daily log created',
          description: 'Your log has been saved successfully',
        });
      }

      reset();
      queryClient.invalidateQueries({ queryKey: ['smart-defaults', projectId] });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Error saving log',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingLog ? 'Edit Daily Log' : 'Create Daily Log'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Date" required error={errors.log_date?.message}>
            <DatePicker
              value={watch('log_date')}
              onChange={(v) => setValue('log_date', v)}
              placeholder="Select date"
              disabled={!!existingLog}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Weather">
              <Input
                {...register('weather')}
                placeholder="Sunny, Cloudy, Rainy..."
              />
              {weatherCarried && <p className="text-xs text-muted-foreground mt-1">Carried from last log</p>}
            </FormField>

            <FormField label="Temperature">
              <Input
                {...register('temperature')}
                placeholder="72°F, 22°C..."
              />
            </FormField>
          </div>

          <FormField label="Crew Count">
            <Input
              type="number"
              {...register('crew_count', {
                valueAsNumber: true,
                validate: (val) => val === null || val >= 0 || 'Must be positive'
              })}
              placeholder="Number of workers on site"
            />
            {crewCarried && <p className="text-xs text-muted-foreground mt-1">Carried from last log</p>}
          </FormField>

          <div className="flex items-center justify-between">
            <FormField label="Work Performed" required error={errors.work_performed?.message}>
              <span></span>
            </FormField>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFill}
              disabled={autoFilling || submitting}
              className="gap-1.5 text-xs h-7"
            >
              {autoFilling ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Auto-fill from Today
                </>
              )}
            </Button>
          </div>
          <Textarea
            {...register('work_performed', { required: 'This field is required' })}
            placeholder="Describe the work completed today..."
            className="min-h-[100px]"
          />

          <FormField label="Issues / Delays">
            <Textarea
              {...register('issues')}
              placeholder="Any problems, delays, or challenges encountered..."
              className="min-h-[80px]"
            />
          </FormField>

          <FormField label="Next Day Plan">
            <Textarea
              {...register('next_day_plan')}
              placeholder="What's planned for tomorrow..."
              className="min-h-[80px]"
            />
          </FormField>

          <FormField label="Safety Notes">
            <Textarea
              {...register('safety_notes')}
              placeholder="Safety observations, incidents, or concerns..."
              className="min-h-[80px]"
            />
          </FormField>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                existingLog ? 'Update Log' : 'Create Log'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};