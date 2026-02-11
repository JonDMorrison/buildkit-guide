import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  CheckSquare, 
  AlertTriangle, 
  FileText, 
  Shield, 
  Users, 
  Clock,
  X,
  Search,
  Building2,
} from 'lucide-react';
import { useGlobalSearch, SearchResult, SearchResultType } from '@/hooks/useGlobalSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeIcons: Record<SearchResultType, React.ReactNode> = {
  project: <Building2 className="h-4 w-4 text-primary" />,
  task: <CheckSquare className="h-4 w-4 text-primary" />,
  deficiency: <AlertTriangle className="h-4 w-4 text-destructive" />,
  document: <FileText className="h-4 w-4 text-blue-500" />,
  safety_form: <Shield className="h-4 w-4 text-amber-500" />,
  team_member: <Users className="h-4 w-4 text-muted-foreground" />,
};

const typeLabels: Record<SearchResultType, string> = {
  project: 'Projects',
  task: 'Tasks',
  deficiency: 'Deficiencies',
  document: 'Documents',
  safety_form: 'Safety Forms',
  team_member: 'Team Members',
};

const statusColors: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-amber-500/20 text-amber-700',
  complete: 'bg-green-500/20 text-green-700',
  blocked: 'bg-destructive/20 text-destructive',
  open: 'bg-amber-500/20 text-amber-700',
  in_review: 'bg-blue-500/20 text-blue-700',
  resolved: 'bg-green-500/20 text-green-700',
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/20 text-primary',
};

export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  } = useGlobalSearch();

  // Reset query when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open, setQuery]);

  const handleSelect = useCallback((result: SearchResult) => {
    addRecentSearch(result.title);
    onOpenChange(false);
    navigate(result.url);
  }, [addRecentSearch, onOpenChange, navigate]);

  const handleRecentSearch = useCallback((search: string) => {
    setQuery(search);
  }, [setQuery]);

  const renderResultItem = (result: SearchResult) => (
    <CommandItem
      key={`${result.type}-${result.id}`}
      value={`${result.type}-${result.id}-${result.title}`}
      onSelect={() => handleSelect(result)}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
    >
      <div className="flex-shrink-0">
        {typeIcons[result.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{result.title}</span>
          {result.status && (
            <Badge 
              variant="secondary" 
              className={`text-xs ${statusColors[result.status] || ''}`}
            >
              {result.status.replace('_', ' ')}
            </Badge>
          )}
        </div>
        {(result.subtitle || result.projectName) && (
          <div className="text-xs text-muted-foreground truncate">
            {[result.subtitle, result.projectName].filter(Boolean).join(' • ')}
          </div>
        )}
      </div>
    </CommandItem>
  );

  const hasResults = results.total > 0;
  const showRecentSearches = !query.trim() && recentSearches.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tasks, deficiencies, documents, safety forms, team..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        {isLoading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}

        {!isLoading && !hasResults && query.trim() && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <Search className="h-10 w-10 text-muted-foreground/50" />
              <p>No results found for "{query}"</p>
              <p className="text-xs text-muted-foreground">
                Try different keywords or check spelling
              </p>
            </div>
          </CommandEmpty>
        )}

        {showRecentSearches && (
          <CommandGroup heading={
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Recent Searches
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearRecentSearches();
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          }>
            {recentSearches.map((search, i) => (
              <CommandItem
                key={`recent-${i}`}
                value={`recent-${search}`}
                onSelect={() => handleRecentSearch(search)}
                className="px-3 py-2"
              >
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                {search}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query.trim() && !showRecentSearches && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
            <p>Start typing to search across all projects</p>
            <p className="text-xs mt-1">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to select
            </p>
          </div>
        )}

        {hasResults && (
          <>
            {results.projects.length > 0 && (
              <>
                <CommandGroup heading={typeLabels.project}>
                  {results.projects.map(renderResultItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.tasks.length > 0 && (
              <>
                <CommandGroup heading={typeLabels.task}>
                  {results.tasks.map(renderResultItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.deficiencies.length > 0 && (
              <>
                <CommandGroup heading={typeLabels.deficiency}>
                  {results.deficiencies.map(renderResultItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.documents.length > 0 && (
              <>
                <CommandGroup heading={typeLabels.document}>
                  {results.documents.map(renderResultItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.safetyForms.length > 0 && (
              <>
                <CommandGroup heading={typeLabels.safety_form}>
                  {results.safetyForms.map(renderResultItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {results.teamMembers.length > 0 && (
              <CommandGroup heading={typeLabels.team_member}>
                {results.teamMembers.map(renderResultItem)}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>

      {/* Footer with keyboard shortcuts */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd>
            Close
          </span>
        </div>
        <span>{results.total} results</span>
      </div>
    </CommandDialog>
  );
}
