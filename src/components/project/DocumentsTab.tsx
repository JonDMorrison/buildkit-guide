import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHelp } from '@/components/dashboard/shared/SectionHelp';

interface DocumentsTabProps {
  projectId: string;
  children: {
    drawings: React.ReactNode;
    docs: React.ReactNode;
    safety: React.ReactNode;
  };
}

export function DocumentsTab({ children }: DocumentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Documents</h2>
        <SectionHelp text="All project files — drawings and plans, uploaded documents, and safety inspection forms." />
      </div>
      <Tabs defaultValue="drawings">
        <TabsList>
          <TabsTrigger value="drawings">Drawings</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>
        <TabsContent value="drawings" className="mt-4">{children.drawings}</TabsContent>
        <TabsContent value="docs" className="mt-4">{children.docs}</TabsContent>
        <TabsContent value="safety" className="mt-4">{children.safety}</TabsContent>
      </Tabs>
    </div>
  );
}
