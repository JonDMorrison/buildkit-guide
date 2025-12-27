import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateAndPersistRecordHash } from '@/lib/recordHash';
import type { Json } from '@/integrations/supabase/types';

export type SafetyFormType = 
  | 'daily_safety_log' 
  | 'toolbox_meeting' 
  | 'near_miss' 
  | 'right_to_refuse'
  | 'site_inspection'
  | 'incident_report'
  | 'jha';

interface SafetyFormData {
  projectId: string;
  formType: SafetyFormType;
  title: string;
  inspectionDate?: string;
  deviceInfo?: Json;
  status?: 'draft' | 'submitted';
}

interface SafetyEntry {
  field_name: string;
  field_value: string | null;
  notes?: string | null;
}

interface AttendeeRecord {
  user_id: string;
  is_foreman?: boolean;
  signed_at?: string | null;
  signature_url?: string | null;
}

interface AcknowledgmentRecord {
  user_id: string;
  signature_url?: string | null;
  acknowledged_at: string;
  initiated_by_user_id?: string;
  initiation_method?: 'foreman_proxy' | 'self';
  attestation_text?: string;
}

interface SubmitOptions {
  form: SafetyFormData;
  entries: SafetyEntry[];
  attendees?: AttendeeRecord[];
  acknowledgments?: AcknowledgmentRecord[];
  successMessage?: string;
}

interface UseSafetyFormSubmitReturn {
  submitting: boolean;
  submitForm: (options: SubmitOptions) => Promise<{ formId: string } | null>;
  createEntries: (formId: string, entries: SafetyEntry[]) => Promise<boolean>;
  generateHash: (formId: string) => Promise<string | null>;
}

export const useSafetyFormSubmit = (): UseSafetyFormSubmitReturn => {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const createEntries = async (formId: string, entries: SafetyEntry[]): Promise<boolean> => {
    if (entries.length === 0) return true;

    const entryRecords = entries.map(entry => ({
      safety_form_id: formId,
      field_name: entry.field_name,
      field_value: entry.field_value,
      notes: entry.notes || null,
    }));

    const { error } = await supabase.from('safety_entries').insert(entryRecords);
    
    if (error) {
      console.error('[useSafetyFormSubmit] Failed to create entries:', error);
      throw error;
    }
    
    return true;
  };

  const createAttendees = async (formId: string, attendees: AttendeeRecord[], currentUserId: string): Promise<boolean> => {
    if (attendees.length === 0) return true;

    const attendeeRecords = attendees.map(a => ({
      safety_form_id: formId,
      user_id: a.user_id || currentUserId, // Use current user if not specified
      is_foreman: a.is_foreman ?? false,
      signed_at: a.signed_at || null,
      signature_url: a.signature_url || null,
    }));

    const { error } = await supabase.from('safety_form_attendees').insert(attendeeRecords);
    
    if (error) {
      console.error('[useSafetyFormSubmit] Failed to create attendees:', error);
      throw error;
    }
    
    return true;
  };

  const createAcknowledgments = async (formId: string, acknowledgments: AcknowledgmentRecord[], currentUserId: string): Promise<boolean> => {
    if (acknowledgments.length === 0) return true;

    const ackRecords = acknowledgments.map(a => ({
      safety_form_id: formId,
      user_id: a.user_id,
      signature_url: a.signature_url || null,
      acknowledged_at: a.acknowledged_at,
      initiated_by_user_id: a.initiated_by_user_id || currentUserId,
      initiation_method: a.initiation_method || 'self',
      attestation_text: a.attestation_text || null,
    }));

    const { error } = await supabase.from('safety_form_acknowledgments').insert(ackRecords);
    
    if (error) {
      console.error('[useSafetyFormSubmit] Failed to create acknowledgments:', error);
      throw error;
    }
    
    return true;
  };

  const generateHash = async (formId: string): Promise<string | null> => {
    try {
      const hash = await generateAndPersistRecordHash(formId);
      if (!hash) {
        console.error('[useSafetyFormSubmit] Failed to generate record hash for form:', formId);
      }
      return hash;
    } catch (error) {
      console.error('[useSafetyFormSubmit] Hash generation error:', error);
      return null;
    }
  };

  const submitForm = async (options: SubmitOptions): Promise<{ formId: string } | null> => {
    const { form, entries, attendees = [], acknowledgments = [], successMessage } = options;
    
    setSubmitting(true);

    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('Not authenticated');
      }

      // Create the safety form
      const formStatus = form.status || 'submitted';
      const { data: createdForm, error: formError } = await supabase
        .from('safety_forms')
        .insert([{
          project_id: form.projectId,
          form_type: form.formType,
          title: form.title,
          status: formStatus,
          inspection_date: form.inspectionDate || new Date().toISOString().split('T')[0],
          created_by: userData.user.id,
          device_info: form.deviceInfo || null,
        }])
        .select()
        .single();

      if (formError) throw formError;

      const formId = createdForm.id;

      // Create entries
      await createEntries(formId, entries);

      // Create attendees if provided
      if (attendees.length > 0) {
        await createAttendees(formId, attendees, userData.user.id);
      }

      // Create acknowledgments if provided
      if (acknowledgments.length > 0) {
        await createAcknowledgments(formId, acknowledgments, userData.user.id);
      }

      // Generate tamper-evidence hash (BC compliance) - only for submitted forms
      if (formStatus === 'submitted') {
        await generateHash(formId);
      }

      // Success toast
      toast({
        title: 'Success',
        description: successMessage || 'Safety form submitted successfully',
      });

      return { formId };
    } catch (error: any) {
      console.error('[useSafetyFormSubmit] Submission error:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit safety form',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    submitForm,
    createEntries,
    generateHash,
  };
};
