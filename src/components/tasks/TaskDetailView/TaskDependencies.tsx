import { TaskDependencyManager } from '../TaskDependencyManager';
import { Link2 } from 'lucide-react';

interface Dependency {
  id: string;
  depends_on_task: {
    id: string;
    title: string;
    status: string;
  };
}

interface TaskDependenciesProps {
  taskId: string;
  projectId: string;
  dependencies: Dependency[];
  canEdit: boolean;
  onDependenciesChanged: () => void;
}

export const TaskDependencies = ({
  taskId,
  projectId,
  dependencies,
  canEdit,
  onDependenciesChanged,
}: TaskDependenciesProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        Dependencies
      </div>
      <TaskDependencyManager
        taskId={taskId}
        projectId={projectId}
        dependencies={dependencies}
        onDependenciesChanged={onDependenciesChanged}
        canEdit={canEdit}
      />
    </div>
  );
};
