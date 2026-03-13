import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ActionSuggestion {
  label: string;
  type: 'navigate' | 'prefill' | 'confirm';
  route?: string;
  prefill_type?: string;
  prefill_content?: string;
  prefillData?: Record<string, unknown>;
  // For 'confirm' type
  entity_type?: 'task' | 'deficiency' | 'project' | 'manpower_request';
  entity_data?: Record<string, unknown>;
  confirmation_id?: string;
}

export interface PressingIssues {
  blocked_count: number;
  old_blockers_count?: number;
  overdue_count: number;
  due_today_count: number;
  safety_incidents_count: number;
  unmapped_gc_count: number;
  pending_manpower_count: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionSuggestion[];
  timestamp: Date;
}

type ConversationTurn = { role: 'user' | 'assistant'; content: string };
type QuickAction = 'initial_summary' | 'blocked_tasks' | 'due_today' | 'safety_summary' | 'receipts_summary' | 'gc_deficiencies';

export const useAiAssist = (projectId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pressingIssues, setPressingIssues] = useState<PressingIssues | null>(null);
  const { toast } = useToast();

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const sendMessage = useCallback(async (
    userMessage?: string,
    quickAction?: QuickAction
  ): Promise<string | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    // Add user message to display chat
    if (userMessage) {
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
    }

    // Build updated history for this call
    const updatedHistory: ConversationTurn[] = userMessage
      ? [...conversationHistory, { role: 'user', content: userMessage }]
      : conversationHistory;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-assist', {
        body: {
          project_id: projectId,
          user_message: userMessage,
          quick_action: quickAction,
          messages: updatedHistory,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.pressing_issues) {
        setPressingIssues(data.pressing_issues);
      }

      const answer = data.answer || 'I could not generate a response.';

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: answer,
        actions: data.actions || [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update conversation history with both turns
      setConversationHistory([
        ...updatedHistory,
        { role: 'assistant', content: answer },
      ]);

      return answer;

    } catch (err) {
      console.error('AI Assist error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMessage);

      toast({
        title: 'AI Assist Error',
        description: errorMessage,
        variant: 'destructive',
      });

      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, conversationHistory, toast]);

  const confirmAction = useCallback(async (
    confirmationId: string,
    entityType: string,
    entityData: Record<string, unknown>
  ): Promise<void> => {
    if (!projectId) return;
    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-assist', {
        body: {
          project_id: projectId,
          confirm_action: {
            confirmation_id: confirmationId,
            entity_type: entityType,
            entity_data: entityData,
          },
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const answer = data.answer || 'Done!';
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: answer,
        actions: data.actions || [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: answer }]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create';
      toast({ title: 'Error creating record', description: errorMessage, variant: 'destructive' });
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I couldn't create that. ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast]);

  const getInitialSummary = useCallback(() => {
    return sendMessage(undefined, 'initial_summary');
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
    setPressingIssues(null);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    pressingIssues,
    sendMessage,
    confirmAction,
    getInitialSummary,
    clearMessages,
  };
};
