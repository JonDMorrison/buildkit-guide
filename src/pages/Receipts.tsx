import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/shared/DashboardLayout';
import { DashboardHeader } from '@/components/dashboard/shared/DashboardHeader';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useReceipts, Receipt, ReceiptCategory } from '@/hooks/useReceipts';
import { useAuthRole } from '@/hooks/useAuthRole';
import { UploadReceiptModal } from '@/components/receipts/UploadReceiptModal';
import { ReceiptDetailModal } from '@/components/receipts/ReceiptDetailModal';
import { ReceiptsList } from '@/components/receipts/ReceiptsList';
import { ReceiptsFilters } from '@/components/receipts/ReceiptsFilters';
import { ExportReceiptsButton } from '@/components/receipts/ExportReceiptsButton';
import { EmptyState } from '@/components/EmptyState';
import { NoAccess } from '@/components/NoAccess';

const Receipts = () => {
  const { currentProjectId } = useCurrentProject();
  const { isAdmin, isPM, currentProjectRole, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  
  // Check permissions - project members can view, PM/Admin can export
  const canView = !!currentProjectRole || isAdmin;
  const canExport = isAdmin || isPM();

  // Filters
  const [category, setCategory] = useState<ReceiptCategory | null>(null);
  const [uploadedBy, setUploadedBy] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const { receipts, loading, refetch, getSignedUrl, deleteReceipt } = useReceipts({
    projectId: currentProjectId,
    category,
    uploadedBy,
    startDate,
    endDate,
  });

  if (!currentProjectId) {
    return (
      <Layout>
        <EmptyState
          icon={<Camera className="h-8 w-8" />}
          title="No Project Selected"
          description="Select a project to view and upload receipts."
        />
      </Layout>
    );
  }

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  const handleReceiptClick = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDetailModalOpen(true);
  };

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Receipts"
        subtitle="Upload and manage project receipts"
        actions={
          <div className="flex items-center gap-2">
            {canExport && <ExportReceiptsButton receipts={receipts} projectId={currentProjectId} />}
            <Button onClick={() => setUploadModalOpen(true)} className="shrink-0">
              <Camera className="h-4 w-4 mr-2" />
              Upload Receipt
            </Button>
          </div>
        }
      />

        {/* Filters */}
        <ReceiptsFilters
          projectId={currentProjectId}
          category={category}
          onCategoryChange={setCategory}
          uploadedBy={uploadedBy}
          onUploadedByChange={setUploadedBy}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
        />

        {/* Mobile Upload Button - Large and prominent */}
        <div className="sm:hidden">
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="w-full h-16 text-lg"
            size="lg"
          >
            <Camera className="h-6 w-6 mr-3" />
            Upload Receipt
          </Button>
        </div>

        <ReceiptsList
          receipts={receipts}
          loading={loading}
          onReceiptClick={handleReceiptClick}
          getSignedUrl={getSignedUrl}
        />

      <UploadReceiptModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        projectId={currentProjectId}
        onUploadComplete={refetch}
      />

      <ReceiptDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        receipt={selectedReceipt}
        projectId={currentProjectId}
        getSignedUrl={getSignedUrl}
        onDelete={deleteReceipt}
      />
    </DashboardLayout>
  );
};

export default Receipts;
