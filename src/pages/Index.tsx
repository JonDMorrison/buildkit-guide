import { Layout } from "@/components/Layout";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { Plus } from "lucide-react";

const projects = [
  {
    id: 1,
    name: "Downtown Office Complex",
    location: "123 Main St, Seattle, WA",
    status: "active" as const,
    tasks: { total: 45, completed: 28 },
  },
  {
    id: 2,
    name: "Harbor Bridge Renovation",
    location: "Harbor District, Portland, OR",
    status: "active" as const,
    tasks: { total: 62, completed: 41 },
  },
  {
    id: 3,
    name: "Riverside Apartments",
    location: "456 River Rd, Tacoma, WA",
    status: "planning" as const,
    tasks: { total: 38, completed: 12 },
  },
];

const Index = () => {
  return (
    <Layout>
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <SectionHeader
          title="Projects"
          count={projects.length}
          action={{
            label: "Add Project",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => console.log("Add project"),
          }}
        />

        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} {...project} />
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Index;
