import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook to manage the current project ID across the app
 * Uses URL search params to persist project selection
 */
export const useCurrentProject = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive the current project id from URL params in a stable way
  const urlProjectId = useMemo(() => searchParams.get('projectId'), [searchParams]);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(urlProjectId);

  useEffect(() => {
    setCurrentProjectId(urlProjectId);
  }, [urlProjectId]);

  const setCurrentProject = useCallback(
    (projectId: string | null) => {
      // IMPORTANT: never mutate the URLSearchParams instance in-place.
      // Mutating can cause render loops in some environments.
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (projectId) next.set('projectId', projectId);
        else next.delete('projectId');
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

