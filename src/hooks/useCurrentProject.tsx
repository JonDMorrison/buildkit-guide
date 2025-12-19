import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook to manage the current project ID across the app
 * Uses URL search params to persist project selection
 */
export const useCurrentProject = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Use lazy initializer for first render
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    () => searchParams.get('projectId')
  );

  // Sync state with URL when it changes externally (e.g., browser navigation)
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    setCurrentProjectId(urlProjectId);
  }, [searchParams]);

  // Stable setter function that updates URL (state will sync via useEffect)
  const setCurrentProject = useCallback(
    (projectId: string | null) => {
      // Use functional update to avoid mutating URLSearchParams in-place
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (projectId) {
          next.set('projectId', projectId);
        } else {
          next.delete('projectId');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return {
    currentProjectId,
    setCurrentProject,
  };
};
