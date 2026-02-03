import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FolderPlus,
  ListTodo,
  AlertTriangle,
  ShieldCheck,
  Users,
  FileText,
  ClipboardList,
  Receipt,
} from 'lucide-react';
import { useAuthRole } from '@/hooks/useAuthRole';
import { cn } from '@/lib/utils';

// Import all create modals
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { CreateDeficiencyModal } from '@/components/deficiencies/CreateDeficiencyModal';
import { SafetyFormModal } from '@/components/safety/SafetyFormModal';
import { FormTypeSelector } from '@/components/safety/FormTypeSelector';
import { CreateManpowerRequestModal } from '@/components/manpower/CreateManpowerRequestModal';
import { DailyLogForm } from '@/components/dailyLogs/DailyLogForm';
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal';
import { UploadReceiptModal } from '@/components/receipts/UploadReceiptModal';

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId?: string | null;
  onSuccess?: () => void;
}

interface QuickAddOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  permission?: string;
}

const quickAddOptions: QuickAddOption[] = [
  {
    id: 'project',
    label: 'New Project',
    description: 'Create a new construction project',
    icon: FolderPlus,
    color: 'text-blue-500',
    permission: 'create_projects',
  },
  {
    id: 'task',
    label: 'New Task',
    description: 'Add a task to coordinate work',
    icon: ListTodo,
    color: 'text-green-500',
    permission: 'create_tasks',
  },
  {
    id: 'deficiency',
    label: 'New Deficiency',
    description: 'Report a deficiency or issue',
    icon: AlertTriangle,
    color: 'text-amber-500',
    permission: 'create_deficiencies',
  },
  {
    id: 'safety',
    label: 'Safety Form',
    description: 'Submit a safety form',
    icon: ShieldCheck,
    color: 'text-red-500',
    permission: 'create_safety',
  },
  {
    id: 'manpower',
    label: 'Manpower Request',
    description: 'Request additional workers',
    icon: Users,
    color: 'text-purple-500',
    permission: 'request_manpower',
  },
  {
    id: 'dailylog',
    label: 'Daily Log',
    description: 'Create today\'s daily log',
    icon: ClipboardList,
    color: 'text-cyan-500',
    permission: 'create_safety', // Same permission as safety forms (PM/Foreman)
  },
  {
    id: 'document',
    label: 'Upload Document',
    description: 'Upload plans, RFIs, permits',
    icon: FileText,
    color: 'text-indigo-500',
    permission: 'upload_documents',
  },
  {
    id: 'receipt',
    label: 'Upload Receipt',
    description: 'Capture an expense receipt',
    icon: Receipt,
    color: 'text-orange-500',
  },
];

export const QuickAddModal = ({
  open,
  onOpenChange,
  currentProjectId,
  onSuccess,
}: QuickAddModalProps) => {
  const { can } = useAuthRole(currentProjectId || undefined);
  
  // Modal states
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [deficiencyModalOpen, setDeficiencyModalOpen] = useState(false);
  const [safetyFormTypeOpen, setSafetyFormTypeOpen] = useState(false);
  const [safetyFormType, setSafetyFormType] = useState<string | null>(null);
  const [manpowerModalOpen, setManpowerModalOpen] = useState(false);
  const [dailyLogModalOpen, setDailyLogModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const handleOptionClick = (optionId: string) => {
    onOpenChange(false);
    
    switch (optionId) {
      case 'project':
        setProjectModalOpen(true);
        break;
      case 'task':
        setTaskModalOpen(true);
        break;
      case 'deficiency':
        setDeficiencyModalOpen(true);
        break;
      case 'safety':
        setSafetyFormTypeOpen(true);
        break;
      case 'manpower':
        setManpowerModalOpen(true);
        break;
      case 'dailylog':
        setDailyLogModalOpen(true);
        break;
      case 'document':
        setDocumentModalOpen(true);
        break;
      case 'receipt':
        setReceiptModalOpen(true);
        break;
    }
  };

  const handleSafetyFormTypeSelect = (formType: string) => {
    setSafetyFormTypeOpen(false);
    setSafetyFormType(formType);
  };

  const handleSuccess = () => {
    onSuccess?.();
  };

  // Filter options based on permissions
  const availableOptions = quickAddOptions.filter((option) => {
    if (!option.permission) return true;
    if (!currentProjectId) {
      // Only show project creation if no project selected
      return option.id === 'project';
    }
    return can(option.permission, currentProjectId);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Quick Add</DialogTitle>
            <DialogDescription>
              Create new items across your project
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {availableOptions.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                className={cn(
                  "h-auto flex-col items-start gap-2 p-4 hover:bg-accent/50 transition-colors",
                  "border-border hover:border-primary/50"
                )}
                onClick={() => handleOptionClick(option.id)}
              >
                <div className="flex items-center gap-3 w-full">
                  <option.icon className={cn("h-5 w-5", option.color)} />
                  <span className="font-semibold text-sm">{option.label}</span>
                </div>
                <p className="text-xs text-muted-foreground text-left w-full">
                  {option.description}
                </p>
              </Button>
            ))}
          </div>

          {availableOptions.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <p>No actions available. Please select a project first.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        onSuccess={handleSuccess}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSuccess={handleSuccess}
      />

      {/* Create Deficiency Modal */}
      <CreateDeficiencyModal
        isOpen={deficiencyModalOpen}
        onClose={() => setDeficiencyModalOpen(false)}
        onCreate={handleSuccess}
      />

      {/* Safety Form Type Selector */}
      <FormTypeSelector
        isOpen={safetyFormTypeOpen}
        onClose={() => setSafetyFormTypeOpen(false)}
        onSelectType={handleSafetyFormTypeSelect}
      />

      {/* Safety Form Modal */}
      {safetyFormType && (
        <SafetyFormModal
          isOpen={!!safetyFormType}
          onClose={() => setSafetyFormType(null)}
          onCreate={handleSuccess}
          formType={safetyFormType}
        />
      )}

      {/* Manpower Request Modal */}
      <CreateManpowerRequestModal
        open={manpowerModalOpen}
        onOpenChange={setManpowerModalOpen}
        onSuccess={handleSuccess}
        defaultProjectId={currentProjectId || undefined}
      />

      {/* Daily Log Form */}
      {currentProjectId && (
        <DailyLogForm
          projectId={currentProjectId}
          open={dailyLogModalOpen}
          onOpenChange={setDailyLogModalOpen}
          onSuccess={handleSuccess}
        />
      )}

      {/* Document Upload Modal */}
      <DocumentUploadModal
        open={documentModalOpen}
        onOpenChange={setDocumentModalOpen}
        projectId={currentProjectId || undefined}
        onUploadComplete={handleSuccess}
      />

      {/* Receipt Upload Modal */}
      {currentProjectId && (
        <UploadReceiptModal
          open={receiptModalOpen}
          onOpenChange={setReceiptModalOpen}
          projectId={currentProjectId}
          onUploadComplete={handleSuccess}
        />
      )}
    </>
  );
};
