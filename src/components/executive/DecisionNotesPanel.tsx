import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardCard } from '@/components/dashboard/shared/DashboardCard';
import { Copy, Check, Download, Trash2 } from 'lucide-react';

type Template = 'weekly' | 'project' | 'risk';

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

interface DecisionNotesPanelProps {
  /** "As of" label from ConfidenceRibbon */
  asOf: string | Date | null;
  /** Top attention project names from the already-loaded change feed */
  topAttentionNames: string[];
}

export function DecisionNotesPanel({ asOf, topAttentionNames }: DecisionNotesPanelProps) {
  const [template, setTemplate] = useState<Template>('weekly');
  const [body, setBody] = useState(TEMPLATES.weekly.outline);
  const [copied, setCopied] = useState(false);

  const asOfLabel = useMemo(() => {
    if (!asOf) return 'Unknown';
    if (asOf instanceof Date) return asOf.toLocaleDateString();
    return String(asOf);
  }, [asOf]);

  const contextBlock = useMemo(() => {
    const lines = [`As of: ${asOfLabel}`];
    if (topAttentionNames.length > 0) {
      lines.push('Top attention items:');
      topAttentionNames.slice(0, 3).forEach((n, i) => lines.push(`  ${i + 1}. ${n}`));
    }
    return lines.join('\n');
  }, [asOfLabel, topAttentionNames]);

  const handleTemplateChange = useCallback(
    (val: string) => {
      const t = val as Template;
      setTemplate(t);
      setBody(TEMPLATES[t].outline);
    },
    [],
  );

  const fullText = `${contextBlock}\n\n${body}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [fullText]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-note-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fullText]);

  const handleClear = useCallback(() => {
    setBody(TEMPLATES[template].outline);
  }, [template]);

  return (
    <DashboardCard
      title="Decision Notes"
      variant="metric"
      traceSource="local-only (no RPC)"
    >
      <p className="text-xs text-muted-foreground -mt-1 mb-3">
        Capture what we decided while the context is fresh.
      </p>

      {/* Template selector */}
      <Tabs value={template} onValueChange={handleTemplateChange} className="mb-3">
        <TabsList className="h-8">
          {(Object.entries(TEMPLATES) as [Template, { label: string }][]).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key} className="text-xs px-3 py-1">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Auto-included context (read-only) */}
      <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground font-mono whitespace-pre-line mb-3 select-text">
        {contextBlock}
      </div>

      {/* Note body */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-[140px] text-sm font-mono"
        placeholder="Start writing your decision note…"
      />

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
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
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />Clear
        </Button>
      </div>
    </DashboardCard>
  );
}
