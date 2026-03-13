import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Save, Copy, Archive, ChevronDown, Plus, Trash2,
  GripVertical, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { PlaybookDetail, PlaybookPerformance, PlaybookPhaseTask } from '@/hooks/usePlaybooks';

interface PlaybookEditorProps {
  detail: PlaybookDetail | null | undefined;
  performance: PlaybookPerformance | null | undefined;
  isLoading: boolean;
  onSave: (data: { playbook_id: string; name: string; job_type: string; description: string; phases: any[] }) => void;
  onDuplicate: (playbookId: string) => void;
  onArchive: (playbookId: string) => void;
  isSaving: boolean;
}

interface EditableTask {
  id: string;
  title: string;
  description: string;
  role_type: string;
  expected_hours_low: number;
  expected_hours_high: number;
  required_flag: boolean;
  allow_skip: boolean;
  density_weight: number;
  sequence_order: number;
}

interface EditablePhase {
  id: string;
  name: string;
  description: string;
  sequence_order: number;
  tasks: EditableTask[];
}

function generateId() {
  return crypto.randomUUID();
}

/* ── Sortable Phase Card wrapper ── */
function SortablePhaseCard({
  phase,
  children,
}: {
  phase: EditablePhase;
  children: (dragHandleProps: { listeners: any; attributes: any }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

/* ── Sortable Task Row wrapper ── */
function SortableTaskRow({
  task,
  onUpdate,
  onRemove,
}: {
  task: EditableTask;
  onUpdate: (field: string, val: any) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow
        task={task}
        onUpdate={onUpdate}
        onRemove={onRemove}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

export function PlaybookEditor({
  detail, performance, isLoading, onSave, onDuplicate, onArchive, isSaving,
}: PlaybookEditorProps) {
  const [name, setName] = useState('');
  const [jobType, setJobType] = useState('');
  const [description, setDescription] = useState('');
  const [phases, setPhases] = useState<EditablePhase[]>([]);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Sync from detail
  useEffect(() => {
    if (!detail) return;
    setName(detail.playbook.name);
    setJobType(detail.playbook.job_type);
    setDescription(detail.playbook.description);
    setPhases(
      detail.phases.map(p => ({
        id: p.phase.id,
        name: p.phase.name,
        description: p.phase.description,
        sequence_order: p.phase.sequence_order,
        tasks: p.tasks.map(t => ({ ...t })),
      }))
    );
    setDirty(false);
  }, [detail]);

  const markDirty = () => setDirty(true);

  const handleSave = () => {
    if (!detail) return;
    onSave({
      playbook_id: detail.playbook.id,
      name,
      job_type: jobType,
      description,
      phases: phases.map((p, pi) => ({
        name: p.name,
        description: p.description,
        sequence_order: pi + 1,
        tasks: p.tasks.map((t, ti) => ({
          title: t.title,
          description: t.description,
          role_type: t.role_type,
          expected_hours_low: t.expected_hours_low,
          expected_hours_high: t.expected_hours_high,
          required_flag: t.required_flag,
          allow_skip: t.allow_skip,
          density_weight: t.density_weight,
          sequence_order: ti + 1,
        })),
      })),
    });
    setDirty(false);
  };

  const addPhase = () => {
    setPhases(prev => [...prev, {
      id: generateId(),
      name: `Phase ${prev.length + 1}`,
      description: '',
      sequence_order: prev.length + 1,
      tasks: [],
    }]);
    markDirty();
  };

  const removePhase = (idx: number) => {
    if (!window.confirm('Delete this phase and all its tasks?')) return;
    setPhases(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const updatePhase = (idx: number, field: string, value: any) => {
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    markDirty();
  };

  const addTask = (phaseIdx: number) => {
    setPhases(prev => prev.map((p, i) =>
      i === phaseIdx ? {
        ...p,
        tasks: [...p.tasks, {
          id: generateId(),
          title: '',
          description: '',
          role_type: 'laborer',
          expected_hours_low: 0,
          expected_hours_high: 0,
          required_flag: true,
          allow_skip: false,
          density_weight: 1,
          sequence_order: p.tasks.length + 1,
        }],
      } : p
    ));
    markDirty();
  };

  const removeTask = (phaseIdx: number, taskIdx: number) => {
    if (!window.confirm('Delete this task?')) return;
    setPhases(prev => prev.map((p, i) =>
      i === phaseIdx ? { ...p, tasks: p.tasks.filter((_, ti) => ti !== taskIdx) } : p
    ));
    markDirty();
  };

  const updateTask = (phaseIdx: number, taskIdx: number, field: string, value: any) => {
    setPhases(prev => prev.map((p, pi) =>
      pi === phaseIdx ? {
        ...p,
        tasks: p.tasks.map((t, ti) => ti === taskIdx ? { ...t, [field]: value } : t),
      } : p
    ));
    markDirty();
  };

  // Phase drag end
  const handlePhaseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPhases(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id);
      const newIndex = prev.findIndex(p => p.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    markDirty();
  };

  // Task drag end for a specific phase
  const handleTaskDragEnd = (phaseId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPhases(prev => prev.map(p => {
      if (p.id !== phaseId) return p;
      const oldIndex = p.tasks.findIndex(t => t.id === active.id);
      const newIndex = p.tasks.findIndex(t => t.id === over.id);
      return { ...p, tasks: arrayMove(p.tasks, oldIndex, newIndex) };
    }));
    markDirty();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground/50">Select a playbook</p>
          <p className="text-sm text-muted-foreground/30 mt-1">Or create a new one to get started</p>
        </div>
      </div>
    );
  }

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalHoursLow = phases.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.expected_hours_low, 0), 0);
  const totalHoursHigh = phases.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.expected_hours_high, 0), 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Input
              value={name}
              onChange={e => { setName(e.target.value); markDirty(); }}
              className="text-lg font-semibold h-11 border-transparent hover:border-border focus:border-primary bg-transparent px-0"
              placeholder="Playbook name"
            />
            <div className="flex gap-2">
              <Input
                value={jobType}
                onChange={e => { setJobType(e.target.value); markDirty(); }}
                className="h-9 text-sm max-w-[200px]"
                placeholder="Job type"
              />
              <Badge variant="outline" className="text-[10px] font-mono shrink-0 self-center">
                v{detail.playbook.version}
              </Badge>
            </div>
            <Textarea
              value={description}
              onChange={e => { setDescription(e.target.value); markDirty(); }}
              className="min-h-[60px] text-sm resize-none"
              placeholder="Description..."
            />
          </div>
        </div>

        {/* Performance summary */}
        {performance && performance.projects_using > 0 && (
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Used in</span>
                  <span className="font-semibold text-foreground ml-1">{performance.projects_using} projects</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Avg variance:</span>
                  <span className={cn(
                    'font-semibold',
                    Math.abs(performance.variance_percent) <= 10 ? 'text-status-complete' :
                    Math.abs(performance.variance_percent) <= 25 ? 'text-status-warning' :
                    'text-status-issue'
                  )}>
                    {performance.variance_percent > 0 ? '+' : ''}{performance.variance_percent}%
                  </span>
                  {performance.variance_percent > 10 ? <TrendingUp className="h-3.5 w-3.5 text-status-issue" /> :
                   performance.variance_percent < -10 ? <TrendingDown className="h-3.5 w-3.5 text-status-complete" /> :
                   <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div>
                  <span className="text-muted-foreground">Baseline:</span>
                  <span className="font-medium text-foreground ml-1 tabular-nums">
                    {totalHoursLow}–{totalHoursHigh}h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary strip */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground py-1">
          <span>{phases.length} phases</span>
          <span className="text-border">·</span>
          <span>{totalTasks} tasks</span>
          <span className="text-border">·</span>
          <span className="tabular-nums">{totalHoursLow}–{totalHoursHigh}h total</span>
          {totalTasks > 40 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1">Density governor active</Badge>
          )}
        </div>

        {/* Phase editor with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handlePhaseDragEnd}
        >
          <SortableContext items={phases.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {phases.map((phase, phaseIdx) => {
                const perfPhase = performance?.phase_breakdown?.find(p => p.phase_name === phase.name);

                return (
                  <SortablePhaseCard key={phase.id} phase={phase}>
                    {({ listeners, attributes }) => (
                      <Collapsible defaultOpen>
                        <Card className="border-border/50 overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <GripVertical
                                    className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing"
                                    {...listeners}
                                    {...attributes}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <Input
                                    value={phase.name}
                                    onChange={e => updatePhase(phaseIdx, 'name', e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="h-8 text-sm font-semibold border-transparent hover:border-border bg-transparent px-1"
                                    placeholder="Phase name"
                                  />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{phase.tasks.length} tasks</span>
                                  {perfPhase && perfPhase.variance_percent !== 0 && (
                                    <Badge className={cn('text-[9px] h-4 px-1',
                                      Math.abs(perfPhase.variance_percent) <= 10 ? 'bg-status-complete/15 text-status-complete' :
                                      Math.abs(perfPhase.variance_percent) <= 25 ? 'bg-status-warning/15 text-status-warning' :
                                      'bg-status-issue/15 text-status-issue'
                                    )}>
                                      {perfPhase.variance_percent > 0 ? '+' : ''}{perfPhase.variance_percent}%
                                    </Badge>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={e => { e.stopPropagation(); removePhase(phaseIdx); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                                </div>
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0 space-y-2">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handleTaskDragEnd(phase.id, event)}
                              >
                                <SortableContext items={phase.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                  {phase.tasks.map((task, taskIdx) => (
                                    <SortableTaskRow
                                      key={task.id}
                                      task={task}
                                      onUpdate={(field, val) => updateTask(phaseIdx, taskIdx, field, val)}
                                      onRemove={() => removeTask(phaseIdx, taskIdx)}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[11px] h-7 gap-1 text-muted-foreground"
                                onClick={() => addTask(phaseIdx)}
                              >
                                <Plus className="h-3 w-3" /> Add task
                              </Button>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    )}
                  </SortablePhaseCard>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 gap-1.5"
                onClick={addPhase}
              >
                <Plus className="h-3.5 w-3.5" /> Add phase
              </Button>
            </div>
          </SortableContext>
        </DndContext>

        {/* Action bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button
            onClick={handleSave}
            disabled={!dirty || isSaving}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {dirty ? 'Save (new version)' : 'Saved'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDuplicate(detail.playbook.id)}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(detail.playbook.id)}
            className="gap-1.5 text-muted-foreground"
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

/* ── Task Row ── */
function TaskRow({
  task, onUpdate, onRemove, dragListeners, dragAttributes,
}: {
  task: EditableTask;
  onUpdate: (field: string, val: any) => void;
  onRemove: () => void;
  dragListeners?: any;
  dragAttributes?: any;
}) {
  return (
    <div className={cn(
      'rounded-lg border border-border/40 p-3 space-y-2 transition-colors',
      'hover:border-border/70',
      !task.required_flag && 'opacity-60',
    )}>
      {/* Title row */}
      <div className="flex items-center gap-2">
        <GripVertical
          className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 cursor-grab active:cursor-grabbing"
          {...dragListeners}
          {...dragAttributes}
        />
        <Input
          value={task.title}
          onChange={e => onUpdate('title', e.target.value)}
          className="h-8 text-sm border-transparent hover:border-border bg-transparent px-1 flex-1"
          placeholder="Task title"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {/* Properties grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</label>
          <Input
            value={task.role_type}
            onChange={e => onUpdate('role_type', e.target.value)}
            className="h-8 text-xs mt-0.5"
            placeholder="Role"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hours Low</label>
          <Input
            type="number"
            value={task.expected_hours_low}
            onChange={e => onUpdate('expected_hours_low', parseFloat(e.target.value) || 0)}
            className="h-8 text-xs mt-0.5 tabular-nums"
            min={0}
            step={0.5}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hours High</label>
          <Input
            type="number"
            value={task.expected_hours_high}
            onChange={e => onUpdate('expected_hours_high', parseFloat(e.target.value) || 0)}
            className="h-8 text-xs mt-0.5 tabular-nums"
            min={0}
            step={0.5}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Density</label>
          <div className="flex items-center gap-2 mt-1.5">
            <Slider
              value={[task.density_weight]}
              onValueChange={([v]) => onUpdate('density_weight', v)}
              min={1}
              max={5}
              step={1}
              className="flex-1"
            />
            <span className="text-[10px] font-mono text-muted-foreground w-4 text-center">{task.density_weight}</span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Switch
            checked={task.required_flag}
            onCheckedChange={v => onUpdate('required_flag', v)}
            className="scale-75"
          />
          Required
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Switch
            checked={task.allow_skip}
            onCheckedChange={v => onUpdate('allow_skip', v)}
            className="scale-75"
          />
          Allow skip
        </label>
      </div>
    </div>
  );
}
