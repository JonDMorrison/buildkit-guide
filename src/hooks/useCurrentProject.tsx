import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook to manage the current project ID across the app
 * Uses URL search params to persist project selection
 */
export const useCurrentProject = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    searchParams.get('projectId')
  );

  useEffect(() => {
    const projectId = searchParams.get('projectId');
    setCurrentProjectId(projectId);
  }, [searchParams]);

  const setCurrentProject = (projectId: string | null) => {
    if (projectId) {
      searchParams.set('projectId', projectId);
    } else {
      searchParams.delete('projectId');
    }
    setSearchParams(searchParams);
    setCurrentProjectId(projectId);
  };

  return {
    currentProjectId,
    setCurrentProject,
  };
};
