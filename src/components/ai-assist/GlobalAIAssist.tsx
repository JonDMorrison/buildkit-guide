import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AIAssistButton } from './AIAssistButton';
import { AIAssistPanel } from './AIAssistPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const GlobalAIAssist = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [hasNotification, setHasNotification] = useState(false);

  // Get current project from URL
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    setProjectId(urlProjectId);

    // Fetch project name
    if (urlProjectId) {
      supabase
        .from('projects')
        .select('name')
        .eq('id', urlProjectId)
        .single()
        .then(({ data }) => {
          setProjectName(data?.name);
        });
    } else {
      setProjectName(undefined);
    }
  }, [searchParams]);

  // Keyboard shortcut (Cmd+I or Ctrl+I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setHasNotification(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Don't show if not authenticated
  if (!user) {
    return null;
  }

  return (
    <>
      <AIAssistButton 
        onClick={handleOpen} 
        hasNotification={hasNotification}
      />
      <AIAssistPanel
        isOpen={isOpen}
        onClose={handleClose}
        projectId={projectId}
        projectName={projectName}
      />
    </>
  );
};
