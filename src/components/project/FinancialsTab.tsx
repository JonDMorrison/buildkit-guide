import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHelp } from '@/components/dashboard/shared/SectionHelp';

interface FinancialsTabProps {
  projectId: string;
  children: {
    scope: React.ReactNode;
    budget: React.ReactNode;
    receipts: React.ReactNode;
  };
}

export function FinancialsTab({ children }: FinancialsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Financials</h2>
        <SectionHelp text="All money-related views — scope line items, budget tracking, and expense receipts." />
      </div>
      <Tabs defaultValue="scope">
        <TabsList>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>
        <TabsContent value="scope" className="mt-4">{children.scope}</TabsContent>
        <TabsContent value="budget" className="mt-4">{children.budget}</TabsContent>
        <TabsContent value="receipts" className="mt-4">{children.receipts}</TabsContent>
      </Tabs>
    </div>
  );
}
