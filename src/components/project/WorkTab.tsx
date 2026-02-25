import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHelp } from '@/components/dashboard/shared/SectionHelp';

interface WorkTabProps {
  projectId: string;
  children: {
    tasks: React.ReactNode;
    lookahead: React.ReactNode;
    trades: React.ReactNode;
  };
}

export function WorkTab({ children }: WorkTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Work</h2>
        <SectionHelp text="Everything about what's being done — active tasks, upcoming schedule, and assigned trades." />
      </div>
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="lookahead">Lookahead</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">{children.tasks}</TabsContent>
        <TabsContent value="lookahead" className="mt-4">{children.lookahead}</TabsContent>
        <TabsContent value="trades" className="mt-4">{children.trades}</TabsContent>
      </Tabs>
    </div>
  );
}
