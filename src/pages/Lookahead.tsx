import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Calendar } from "lucide-react";

const Lookahead = () => {
  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SectionHeader
          title="2-Week Lookahead"
          subtitle="Planning view"
        />
        
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="No schedule planned"
          description="Start planning your 2-week lookahead schedule to coordinate upcoming work."
        />
      </div>
    </Layout>
  );
};

export default Lookahead;
