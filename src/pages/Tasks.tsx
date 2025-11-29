import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { CheckSquare, Plus } from "lucide-react";

const Tasks = () => {
  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SectionHeader
          title="Tasks"
          count={0}
          action={{
            label: "Add Task",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => console.log("Add task"),
          }}
        />
        
        <EmptyState
          icon={<CheckSquare className="h-8 w-8" />}
          title="No tasks yet"
          description="Create your first task to start coordinating work across trades."
          action={{
            label: "Create Task",
            onClick: () => console.log("Create task"),
          }}
        />
      </div>
    </Layout>
  );
};

export default Tasks;
