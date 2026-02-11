import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type SearchResultType = 'project' | 'task' | 'deficiency' | 'document' | 'safety_form' | 'team_member';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  status?: string;
  projectId?: string;
  projectName?: string;
  url: string;
}

interface SearchData {
  projects: SearchResult[];
  tasks: SearchResult[];
  deficiencies: SearchResult[];
  documents: SearchResult[];
  safetyForms: SearchResult[];
  teamMembers: SearchResult[];
}

// Simple fuzzy match - checks if query words appear in text (case-insensitive)
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  return queryWords.every(word => lowerText.includes(word));
}

// Score results for ranking (higher = better match)
function scoreMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;
  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 80;
  // Contains exact query
  if (lowerText.includes(lowerQuery)) return 60;
  // All words match
  return 40;
}

export function useGlobalSearch() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const currentProjectId = searchParams.get('projectId');
  
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchData, setSearchData] = useState<SearchData>({
    projects: [],
    tasks: [],
    deficiencies: [],
    documents: [],
    safetyForms: [],
    teamMembers: [],
  });

  // Fetch all searchable data on mount
  useEffect(() => {
    if (!user) return;

    const fetchSearchData = async () => {
      setIsLoading(true);
      try {
        // Fetch projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, location, status, job_number')
          .eq('is_deleted', false)
          .limit(200);

        // Fetch tasks
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, status, location, project_id, projects(name)')
          .eq('is_deleted', false)
          .limit(500);

        // Fetch deficiencies
        const { data: deficiencies } = await supabase
          .from('deficiencies')
          .select('id, title, status, location, project_id, projects(name)')
          .eq('is_deleted', false)
          .limit(500);

        // Fetch documents (attachments with document_type)
        const { data: documents } = await supabase
          .from('attachments')
          .select('id, file_name, document_type, project_id, projects(name)')
          .not('document_type', 'is', null)
          .limit(500);

        // Fetch safety forms
        const { data: safetyForms } = await supabase
          .from('safety_forms')
          .select('id, title, form_type, status, project_id, projects(name)')
          .eq('is_deleted', false)
          .limit(500);

        // Fetch team members (profiles via project_members)
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .limit(200);

        setSearchData({
          projects: (projects || []).map(p => ({
            id: p.id,
            type: 'project' as const,
            title: p.name,
            subtitle: [p.job_number ? `#${p.job_number}` : null, p.location].filter(Boolean).join(' • ') || undefined,
            status: p.status,
            url: `/dashboard?projectId=${p.id}`,
          })),
          tasks: (tasks || []).map(t => ({
            id: t.id,
            type: 'task' as const,
            title: t.title,
            subtitle: t.location || undefined,
            status: t.status,
            projectId: t.project_id,
            projectName: (t.projects as any)?.name,
            url: `/tasks?projectId=${t.project_id}&taskId=${t.id}`,
          })),
          deficiencies: (deficiencies || []).map(d => ({
            id: d.id,
            type: 'deficiency' as const,
            title: d.title,
            subtitle: d.location || undefined,
            status: d.status,
            projectId: d.project_id,
            projectName: (d.projects as any)?.name,
            url: `/deficiencies?projectId=${d.project_id}&deficiencyId=${d.id}`,
          })),
          documents: (documents || []).map(doc => ({
            id: doc.id,
            type: 'document' as const,
            title: doc.file_name,
            subtitle: doc.document_type || undefined,
            projectId: doc.project_id,
            projectName: (doc.projects as any)?.name,
            url: `/documents?projectId=${doc.project_id}`,
          })),
          safetyForms: (safetyForms || []).map(sf => ({
            id: sf.id,
            type: 'safety_form' as const,
            title: sf.title,
            subtitle: sf.form_type,
            status: sf.status,
            projectId: sf.project_id,
            projectName: (sf.projects as any)?.name,
            url: `/safety?projectId=${sf.project_id}&formId=${sf.id}`,
          })),
          teamMembers: (teamMembers || []).map(tm => ({
            id: tm.id,
            type: 'team_member' as const,
            title: tm.full_name || tm.email,
            subtitle: tm.full_name ? tm.email : undefined,
            url: `/users`,
          })),
        });
      } catch (error) {
        console.error('Error fetching search data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSearchData();
  }, [user]);

  // Filter and rank results based on query
  const results = useMemo(() => {
    if (!query.trim()) {
      return {
        projects: [],
        tasks: [],
        deficiencies: [],
        documents: [],
        safetyForms: [],
        teamMembers: [],
        total: 0,
      };
    }

    const filterAndSort = (items: SearchResult[]) => {
      return items
        .filter(item => {
          const searchText = [item.title, item.subtitle, item.projectName]
            .filter(Boolean)
            .join(' ');
          return fuzzyMatch(searchText, query);
        })
        .map(item => ({
          ...item,
          score: scoreMatch(item.title, query),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    };

    const filteredProjects = filterAndSort(searchData.projects);
    const filteredTasks = filterAndSort(searchData.tasks);
    const filteredDeficiencies = filterAndSort(searchData.deficiencies);
    const filteredDocuments = filterAndSort(searchData.documents);
    const filteredSafetyForms = filterAndSort(searchData.safetyForms);
    const filteredTeamMembers = filterAndSort(searchData.teamMembers);

    return {
      projects: filteredProjects,
      tasks: filteredTasks,
      deficiencies: filteredDeficiencies,
      documents: filteredDocuments,
      safetyForms: filteredSafetyForms,
      teamMembers: filteredTeamMembers,
      total: 
        filteredProjects.length +
        filteredTasks.length + 
        filteredDeficiencies.length + 
        filteredDocuments.length + 
        filteredSafetyForms.length + 
        filteredTeamMembers.length,
    };
  }, [query, searchData]);

  // Recent searches stored in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentSearches') || '[]');
    } catch {
      return [];
    }
  });

  const addRecentSearch = (search: string) => {
    if (!search.trim()) return;
    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    currentProjectId,
  };
}
