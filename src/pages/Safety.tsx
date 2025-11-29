import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { ShieldCheck, Plus } from "lucide-react";

const Safety = () => {
  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SectionHeader
          title="Safety"
          count={0}
          action={{
            label: "Add Report",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => console.log("Add safety report"),
          }}
        />
        
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="No safety reports"
          description="Document safety incidents, inspections, and toolbox talks to maintain compliance."
          action={{
            label: "Create Safety Report",
            onClick: () => console.log("Create safety report"),
          }}
        />
      </div>
    </Layout>
  );
};

export default Safety;
