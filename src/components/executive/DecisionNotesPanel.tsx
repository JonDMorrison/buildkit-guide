import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Copy, Check, Download, Trash2, ChevronDown, History, CopyPlus, Save,
  Cloud, HardDrive, Upload,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useExecutiveDecisionNotes, type DecisionNote } from '@/hooks/useExecutiveDecisionNotes';
import { djb2Hash } from '@/lib/hash';
import { DecisionFollowThrough } from '@/components/executive/DecisionFollowThrough';

// ── Types ──────────────────────────────────────────────────────────────────

type Template = 'weekly' | 'project' | 'risk';

interface LocalNote {
  id: string;
  createdAt: string;
  asOf: string;
  templateType: Template;
  top3Projects: string[];
  body: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_LOCAL_NOTES = 10;

const TEMPLATES: Record<Template, { label: string; outline: string }> = {
  weekly: {
    label: 'Weekly',
    outline: `## Weekly Decision Summary

**Key decisions made:**
- 

**Follow-up actions:**
- [ ] 

**Owner / deadline:**
- `,
  },
  project: {
    label: 'Project-specific',
    outline: `## Project Decision Note

**Project:**

**Decision:**

**Rationale:**

**Next steps:**
- [ ] `,
  },
  risk: {
    label: 'Risk response',
    outline: `## Risk Response Decision

**Risk identified:**

**Chosen response (accept / mitigate / escalate):**

**Mitigation actions:**
- [ ] 

**Review date:** `,
  },
};

// ── LocalStorage helpers ───────────────────────────────────────────────────

function lsKey(orgId: string) { return `decision_notes::${orgId}`; }

function readLocalNotes(orgId: string): LocalNote[] {
  try {
    const raw = localStorage.getItem(lsKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocalNotes(orgId: string, notes: LocalNote[]) {
  localStorage.setItem(lsKey(orgId), JSON.stringify(notes.slice(0, MAX_LOCAL_NOTES)));
}

function makeAsOfISO(asOf: string | Date | null): string {
  if (!asOf) return new Date().toISOString();
  if (asOf instanceof Date) return asOf.toISOString();
  return String(asOf);
}

/** Deterministic hash for deduplication */
function computeClientHash(asOfISO: string, templateType: string, body: string, top3: string[]): string {
  const input = [asOfISO, templateType, body, top3.join('|')].join('\0');
  return djb2Hash(input);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Unified display type ───────────────────────────────────────────────────

interface DisplayNote {
  id: string;
  createdAt: string;
  asOf: string;
  templateType: Template;
  top3Projects: string[];
  body: string;
  storageType: 'org' | 'device';
}

function dbToDisplay(n: DecisionNote): DisplayNote {
  return {
    id: n.id,
    createdAt: n.created_at,
    asOf: n.as_of,
    templateType: n.template_type,
    top3Projects: n.top3_projects ?? [],
    body: n.body,
    storageType: 'org',
  };
}

function localToDisplay(n: LocalNote): DisplayNote {
  return { ...n, createdAt: n.createdAt, storageType: 'device' };
}

// ── Component ──────────────────────────────────────────────────────────────

interface DecisionNotesPanelProps {
  asOf: string | Date | null;
  topAttentionNames: string[];
  orgId: string;
  /** Whether the current user has admin role (controls delete visibility) */
  isAdmin?: boolean;
  /** Called whenever the draft/viewed body changes, so parent can use it for export */
  onBodyChange?: (body: string) => void;
  /** Current attention project names from change feed (ordered) for follow-through */
  currentAttentionNames?: string[];
  /** Current as-of date from change feed */
  currentAsOf?: string;
  /** Callback to scroll to a project in AttentionInbox */
  onScrollToProject?: (projectName: string) => void;
}

export function DecisionNotesPanel({
  asOf, topAttentionNames, orgId, isAdmin = false, onBodyChange,
  currentAttentionNames = [], currentAsOf, onScrollToProject,
}: DecisionNotesPanelProps) {
  const { user } = useAuth();
  const { notes: dbNotes, isError: dbError, insertNote, deleteNote, isInserting } = useExecutiveDecisionNotes(orgId);

  const [template, setTemplate] = useState<Template>('weekly');
  const [body, setBodyState] = useState(TEMPLATES.weekly.outline);
  const setBody = useCallback((val: string) => {
    setBodyState(val);
    onBodyChange?.(val);
  }, [onBodyChange]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<DisplayNote | null>(null);
  const [localNotes, setLocalNotes] = useState<LocalNote[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { setLocalNotes(readLocalNotes(orgId)); }, [orgId]);

  const asOfLabel = useMemo(() => {
    if (!asOf) return 'Unknown';
    if (asOf instanceof Date) return asOf.toLocaleDateString();
    return String(asOf);
  }, [asOf]);

  const top3 = useMemo(() => topAttentionNames.slice(0, 3), [topAttentionNames]);

  const contextBlock = useMemo(() => {
    const lines = [`As of: ${asOfLabel}`];
    if (top3.length > 0) {
      lines.push('Top attention items:');
      top3.forEach((n, i) => lines.push(`  ${i + 1}. ${n}`));
    }
    return lines.join('\n');
  }, [asOfLabel, top3]);

  const fullText = `${contextBlock}\n\n${body}`;

  // ── Merged display list: DB first, then device-only ──────────────────

  const displayNotes = useMemo<DisplayNote[]>(() => {
    const dbDisplay = dbNotes.map(dbToDisplay);
    if (dbError || dbDisplay.length === 0) {
      // Fallback: show local notes
      const localDisplay = localNotes.map(localToDisplay);
      // Merge: DB first, then local not already in DB
      const dbIds = new Set(dbDisplay.map(n => n.id));
      const merged = [...dbDisplay, ...localDisplay.filter(n => !dbIds.has(n.id))];
      return merged.slice(0, 10);
    }
    return dbDisplay.slice(0, 10);
  }, [dbNotes, dbError, localNotes]);

  // ── Save (DB + localStorage fallback) ────────────────────────────────

  const persistNote = useCallback(async () => {
    const asOfISO = makeAsOfISO(asOf);

    // Always write to localStorage as fallback
    const localNote: LocalNote = {
      id: `dn-${Date.now()}`,
      createdAt: new Date().toISOString(),
      asOf: asOfISO,
      templateType: template,
      top3Projects: [...top3],
      body,
    };
    const updatedLocal = [localNote, ...localNotes].slice(0, MAX_LOCAL_NOTES);
    writeLocalNotes(orgId, updatedLocal);
    setLocalNotes(updatedLocal);

    // Try DB insert with client_hash for deduplication
    if (user?.id) {
      try {
        const hash = computeClientHash(asOfISO, template, body, top3);
        await insertNote({
          organization_id: orgId,
          created_by: user.id,
          as_of: asOfISO,
          template_type: template,
          top3_projects: [...top3],
          body,
          client_hash: hash,
        });
      } catch {
        // DB failed — localStorage fallback already saved
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [asOf, template, top3, body, localNotes, orgId, user, insertNote]);

  // ── Actions ──────────────────────────────────────────────────────────

  const handleTemplateChange = useCallback((val: string) => {
    if (viewingNote) return;
    const t = val as Template;
    setTemplate(t);
    setBody(TEMPLATES[t].outline);
  }, [viewingNote]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullText).then(() => {
      persistNote();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [fullText, persistNote]);

  const handleDownload = useCallback(() => {
    persistNote();
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-note-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fullText, persistNote]);

  const handleClear = useCallback(() => {
    setViewingNote(null);
    setBody(TEMPLATES[template].outline);
  }, [template]);

  const handleSave = useCallback(() => { persistNote(); }, [persistNote]);

  // ── History actions ──────────────────────────────────────────────────

  const handleViewNote = useCallback((note: DisplayNote) => {
    setViewingNote(note);
    setTemplate(note.templateType);
    setBody(note.body);
  }, []);

  const handleDuplicate = useCallback((note: DisplayNote) => {
    setViewingNote(null);
    setTemplate(note.templateType);
    setBody(note.body);
  }, []);

  const handleDeleteNote = useCallback(async (note: DisplayNote) => {
    if (confirmDeleteId !== note.id) {
      setConfirmDeleteId(note.id);
      return;
    }
    if (note.storageType === 'org') {
      try { await deleteNote(note.id); } catch { /* ignore */ }
    }
    // Also remove from local
    const updatedLocal = localNotes.filter(n => n.id !== note.id);
    writeLocalNotes(orgId, updatedLocal);
    setLocalNotes(updatedLocal);
    setConfirmDeleteId(null);
    if (viewingNote?.id === note.id) {
      setViewingNote(null);
      setBody(TEMPLATES[template].outline);
    }
  }, [confirmDeleteId, deleteNote, localNotes, orgId, viewingNote, template]);

  useEffect(() => {
    if (confirmDeleteId) {
      const t = setTimeout(() => setConfirmDeleteId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [confirmDeleteId]);

  // ── Import device notes to DB ────────────────────────────────────────

  const showImportButton = dbNotes.length === 0 && localNotes.length > 0 && !dbError && user?.id;

  const handleImport = useCallback(async () => {
    if (!user?.id) return;
    setImporting(true);
    const toImport = localNotes.slice(0, 10);
    for (const ln of toImport) {
      try {
        const hash = computeClientHash(ln.asOf, ln.templateType, ln.body, ln.top3Projects);
        await insertNote({
          organization_id: orgId,
          created_by: user.id,
          as_of: ln.asOf,
          template_type: ln.templateType,
          top3_projects: ln.top3Projects,
          body: ln.body,
          client_hash: hash,
        });
      } catch { /* duplicate or error — skip */ }
    }
    setImporting(false);
  }, [localNotes, orgId, user, insertNote]);

  const isViewing = viewingNote !== null;

  return (
    <DashboardCard
      title="Decision Notes"
      variant="metric"
      traceSource="executive_decision_notes (DB) + localStorage fallback"
    >
      <p className="text-xs text-muted-foreground -mt-1 mb-3">
        Capture what we decided while the context is fresh.
      </p>

      {/* ── Import banner ──────────────────────────────────── */}
      {showImportButton && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 border border-border/50 px-3 py-2 mb-3 text-xs">
          <span className="text-muted-foreground">
            {localNotes.length} note{localNotes.length !== 1 ? 's' : ''} saved on this device only.
          </span>
          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={handleImport} disabled={importing}>
            <Upload className="h-3 w-3 mr-1" />
            {importing ? 'Importing…' : 'Import to Org'}
          </Button>
        </div>
      )}

      {/* ── Recent Notes (collapsible) ─────────────────────── */}
      {displayNotes.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="mb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground px-2 h-7">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <History className="h-3.5 w-3.5" />
                Recent Notes ({displayNotes.length})
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 p-1.5">
              {displayNotes.slice(0, 6).map(note => (
                <div
                  key={note.id}
                  className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer hover:bg-muted/50 ${
                    viewingNote?.id === note.id ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                  onClick={() => handleViewNote(note)}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    {note.storageType === 'org'
                      ? <span title="Saved (Org)"><Cloud className="h-3 w-3 text-primary shrink-0" /></span>
                      : <span title="Saved (This Device)"><HardDrive className="h-3 w-3 text-muted-foreground shrink-0" /></span>
                    }
                    <span className="text-foreground font-medium">{formatDate(note.createdAt)}</span>
                    <span className="text-muted-foreground capitalize">{note.templateType}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Duplicate as new draft"
                      onClick={() => handleDuplicate(note)}
                    >
                      <CopyPlus className="h-3 w-3" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost" size="sm"
                        className={`h-6 w-6 p-0 ${confirmDeleteId === note.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                        title={confirmDeleteId === note.id ? 'Click again to confirm' : 'Delete note'}
                        onClick={() => handleDeleteNote(note)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── Viewing banner ─────────────────────────────────── */}
      {isViewing && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 border border-border/50 px-3 py-1.5 mb-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {viewingNote.storageType === 'org'
              ? <Cloud className="h-3 w-3 text-primary" />
              : <HardDrive className="h-3 w-3" />
            }
            Viewing saved note from {formatDate(viewingNote.createdAt)}
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleClear}>
            Back to draft
          </Button>
        </div>
      )}

      {/* ── Follow-through (only for saved notes with feed data) ── */}
      {isViewing && currentAsOf && viewingNote.top3Projects.length > 0 && (
        <div className="mb-3">
          <DecisionFollowThrough
            noteAsOf={viewingNote.asOf}
            noteTop3Projects={viewingNote.top3Projects}
            currentAsOf={currentAsOf}
            currentAttentionByName={new Set(currentAttentionNames)}
            onScrollToProject={onScrollToProject}
          />
        </div>
      )}

      {/* Template selector */}
      <Tabs value={template} onValueChange={handleTemplateChange} className="mb-3">
        <TabsList className="h-8">
          {(Object.entries(TEMPLATES) as [Template, { label: string }][]).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key} className="text-xs px-3 py-1" disabled={isViewing}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Auto-included context (read-only) */}
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-line mb-3 select-text">
        {isViewing
          ? [`As of: ${viewingNote.asOf}`, ...(viewingNote.top3Projects.length > 0
              ? ['Top attention items:', ...viewingNote.top3Projects.map((n, i) => `  ${i + 1}. ${n}`)]
              : [])
            ].join('\n')
          : contextBlock
        }
      </div>

      {/* Note body */}
      <Textarea
        value={body}
        onChange={(e) => { if (!isViewing) setBody(e.target.value); }}
        className="min-h-[140px] text-sm font-mono"
        placeholder="Start writing your decision note…"
        readOnly={isViewing}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {!isViewing && (
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isInserting}>
            {saved ? (
              <><Check className="h-3.5 w-3.5 mr-1.5 text-primary" />Saved</>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" />{isInserting ? 'Saving…' : 'Save'}</>
            )}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <><Check className="h-3.5 w-3.5 mr-1.5 text-primary" />Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1.5" />Download .txt
        </Button>
        {!isViewing && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear
          </Button>
        )}
      </div>
    </DashboardCard>
  );
}
