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
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Template = 'weekly' | 'project' | 'risk';

interface SavedNote {
  id: string;
  createdAt: string;
  asOf: string;
  templateType: Template;
  top3Projects: string[];
  body: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_NOTES = 10;

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

// ── Helpers ────────────────────────────────────────────────────────────────

function storageKey(orgId: string) {
  return `decision_notes::${orgId}`;
}

function readNotes(orgId: string): SavedNote[] {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(orgId: string, notes: SavedNote[]) {
  localStorage.setItem(storageKey(orgId), JSON.stringify(notes.slice(0, MAX_NOTES)));
}

function makeAsOfString(asOf: string | Date | null): string {
  if (!asOf) return 'Unknown';
  if (asOf instanceof Date) return asOf.toISOString();
  return String(asOf);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface DecisionNotesPanelProps {
  asOf: string | Date | null;
  topAttentionNames: string[];
  orgId: string;
}

export function DecisionNotesPanel({ asOf, topAttentionNames, orgId }: DecisionNotesPanelProps) {
  const [template, setTemplate] = useState<Template>('weekly');
  const [body, setBody] = useState(TEMPLATES.weekly.outline);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<SavedNote | null>(null);
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load notes from localStorage on mount / orgId change
  useEffect(() => {
    setNotes(readNotes(orgId));
  }, [orgId]);

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

  // ── Persistence ────────────────────────────────────────────────────────

  const persistNote = useCallback(() => {
    const note: SavedNote = {
      id: `dn-${Date.now()}`,
      createdAt: new Date().toISOString(),
      asOf: makeAsOfString(asOf),
      templateType: template,
      top3Projects: [...top3],
      body,
    };
    const updated = [note, ...notes].slice(0, MAX_NOTES);
    writeNotes(orgId, updated);
    setNotes(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [asOf, template, top3, body, notes, orgId]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleTemplateChange = useCallback((val: string) => {
    if (viewingNote) return; // don't switch while viewing
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

  const handleSave = useCallback(() => {
    persistNote();
  }, [persistNote]);

  // ── History actions ────────────────────────────────────────────────────

  const handleViewNote = useCallback((note: SavedNote) => {
    setViewingNote(note);
    setTemplate(note.templateType);
    setBody(note.body);
  }, []);

  const handleDuplicate = useCallback((note: SavedNote) => {
    setViewingNote(null);
    setTemplate(note.templateType);
    setBody(note.body);
  }, []);

  const handleDeleteNote = useCallback((noteId: string) => {
    if (confirmDeleteId !== noteId) {
      setConfirmDeleteId(noteId);
      return;
    }
    const updated = notes.filter(n => n.id !== noteId);
    writeNotes(orgId, updated);
    setNotes(updated);
    setConfirmDeleteId(null);
    if (viewingNote?.id === noteId) {
      setViewingNote(null);
      setBody(TEMPLATES[template].outline);
    }
  }, [confirmDeleteId, notes, orgId, viewingNote, template]);

  // Reset confirm state if user clicks away
  useEffect(() => {
    if (confirmDeleteId) {
      const t = setTimeout(() => setConfirmDeleteId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [confirmDeleteId]);

  const isViewing = viewingNote !== null;

  return (
    <DashboardCard
      title="Decision Notes"
      variant="metric"
      traceSource="local-only (no RPC)"
    >
      <p className="text-xs text-muted-foreground -mt-1 mb-3">
        Capture what we decided while the context is fresh.
      </p>

      {/* ── Recent Notes (collapsible) ─────────────────────── */}
      {notes.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className="mb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground px-2 h-7">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <History className="h-3.5 w-3.5" />
                Recent Notes ({notes.length})
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 p-1.5">
              {notes.slice(0, 6).map(note => (
                <div
                  key={note.id}
                  className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer hover:bg-muted/50 ${
                    viewingNote?.id === note.id ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                  onClick={() => handleViewNote(note)}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground font-medium">{formatDate(note.createdAt)}</span>
                    <span className="text-muted-foreground ml-2 capitalize">{note.templateType}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Duplicate as new draft"
                      onClick={() => handleDuplicate(note)}
                    >
                      <CopyPlus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 ${confirmDeleteId === note.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                      title={confirmDeleteId === note.id ? 'Click again to confirm' : 'Delete note'}
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
          <span>Viewing saved note from {formatDate(viewingNote.createdAt)}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleClear}>
            Back to draft
          </Button>
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
          <Button variant="outline" size="sm" onClick={handleSave}>
            {saved ? (
              <><Check className="h-3.5 w-3.5 mr-1.5 text-primary" />Saved</>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" />Save</>
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
