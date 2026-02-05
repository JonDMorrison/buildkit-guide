import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { 
  Camera, 
  Receipt as ReceiptIcon, 
  Loader2, 
  DollarSign, 
  FileText,
  Calendar,
  ArrowUpDown,
  Files
} from 'lucide-react';
import { useReceipts, Receipt, RECEIPT_CATEGORIES, ReceiptCategory } from '@/hooks/useReceipts';
import { UploadReceiptModal } from './UploadReceiptModal';
import { BatchUploadReceiptModal } from './BatchUploadReceiptModal';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import { ExportReceiptsButton } from './ExportReceiptsButton';
import { format, startOfMonth, startOfWeek, isAfter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface PMReceiptsViewProps {
  projectId: string;
}

interface ProjectMember {
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

const ReceiptThumbnail = ({
  filePath,
  getSignedUrl,
}: {
  filePath: string;
  getSignedUrl: (filePath: string) => Promise<string | null>;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const signedUrl = await getSignedUrl(filePath);
      setUrl(signedUrl);
      setLoading(false);
    };
    load();
  }, [filePath, getSignedUrl]);

  if (loading) {
    return (
      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
        <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Receipt"
      className="w-12 h-12 object-cover rounded-lg shrink-0"
    />
  );
};

export const PMReceiptsView = ({ projectId }: PMReceiptsViewProps) => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [batchUploadModalOpen, setBatchUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [category, setCategory] = useState<ReceiptCategory | null>(null);
  const [uploadedBy, setUploadedBy] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { receipts, loading, refetch, getSignedUrl, deleteReceipt } = useReceipts({
    projectId,
    category,
    uploadedBy,
    startDate,
    endDate,
  });

  // Fetch project members for the filter
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select(`
          user_id,
          profile:profiles!user_id(full_name, email)
        `)
        .eq('project_id', projectId);
      
      if (data) {
        setProjectMembers(data as unknown as ProjectMember[]);
      }
    };
    fetchMembers();
  }, [projectId]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const weekStart = startOfWeek(now);

    const monthlyReceipts = receipts.filter(r => 
      isAfter(new Date(r.uploaded_at), monthStart)
    );
    const weeklyReceipts = receipts.filter(r => 
      isAfter(new Date(r.uploaded_at), weekStart)
    );

    const monthlyTotal = monthlyReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      monthlyTotal,
      weeklyCount: weeklyReceipts.length,
    };
  }, [receipts]);

  // Sort receipts
  const sortedReceipts = useMemo(() => {
    return [...receipts].sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.uploaded_at).getTime();
        const dateB = new Date(b.uploaded_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const amountA = a.amount || 0;
        const amountB = b.amount || 0;
        return sortOrder === 'desc' ? amountB - amountA : amountA - amountB;
      }
    });
  }, [receipts, sortBy, sortOrder]);

  const handleReceiptClick = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDetailModalOpen(true);
  };

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const clearFilters = () => {
    setCategory(null);
    setUploadedBy(null);
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C3B23]">Project Receipts</h1>
          <p className="text-[#A0ADA3] mt-1">Review and export receipts for this project.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportReceiptsButton receipts={receipts} projectId={projectId} />
          <Button
            onClick={() => setBatchUploadModalOpen(true)}
            variant="outline"
            className="border-[#DC8644] text-[#DC8644] hover:bg-[#DC8644]/10"
          >
            <Files className="h-4 w-4 mr-2" />
            Batch Upload
          </Button>
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="bg-[#1C3B23] hover:bg-[#3D7237] text-white"
          >
            <Camera className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-[#A0ADA3]/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#A0ADA3]">Total This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[#3D7237]" />
              <span className="text-2xl font-bold text-[#1C3B23]">
                ${metrics.monthlyTotal.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#A0ADA3]/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#A0ADA3]">Receipts This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#3D7237]" />
              <span className="text-2xl font-bold text-[#1C3B23]">
                {metrics.weeklyCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-[#A0ADA3]/20 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-foreground">Start Date</Label>
              <DatePicker
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(v) => setStartDate(v ? new Date(v) : null)}
                placeholder="Select start"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">End Date</Label>
              <DatePicker
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(v) => setEndDate(v ? new Date(v) : null)}
                placeholder="Select end"
                minDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-[#1C3B23]">Category</Label>
              <Select value={category || 'all'} onValueChange={(v) => setCategory(v === 'all' ? null : v as ReceiptCategory)}>
                <SelectTrigger className="border-[#A0ADA3]/30">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {RECEIPT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Uploaded By */}
            <div className="space-y-2">
              <Label className="text-[#1C3B23]">Uploaded By</Label>
              <Select value={uploadedBy || 'all'} onValueChange={(v) => setUploadedBy(v === 'all' ? null : v)}>
                <SelectTrigger className="border-[#A0ADA3]/30">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {projectMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profile?.full_name || member.profile?.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(category || uploadedBy || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="mt-4 text-[#A0ADA3]"
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#A0ADA3]">Sort by:</span>
        <Button
          variant={sortBy === 'date' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleSort('date')}
          className="gap-1"
        >
          <Calendar className="h-4 w-4" />
          Date
          {sortBy === 'date' && (
            <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          )}
        </Button>
        <Button
          variant={sortBy === 'amount' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => toggleSort('amount')}
          className="gap-1"
        >
          <DollarSign className="h-4 w-4" />
          Amount
          {sortBy === 'amount' && (
            <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          )}
        </Button>
      </div>

      {/* Receipts List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : sortedReceipts.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-[#A0ADA3]/30">
          <ReceiptIcon className="h-12 w-12 mx-auto text-[#A0ADA3] mb-4" />
          <h3 className="font-medium text-[#1C3B23] mb-1">No receipts found</h3>
          <p className="text-sm text-[#A0ADA3]">
            {category || uploadedBy || startDate || endDate
              ? 'Try adjusting your filters'
              : 'Upload your first receipt to get started'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid md:grid-cols-[auto_1fr_100px_100px_100px_120px_80px] gap-4 px-4 py-2 text-sm font-medium text-[#A0ADA3] border-b border-[#A0ADA3]/20">
            <span className="w-12"></span>
            <span>Vendor</span>
            <span>Amount</span>
            <span>Category</span>
            <span>Uploaded By</span>
            <span>Date</span>
            <span>Task</span>
          </div>

          {sortedReceipts.map((receipt) => {
            const categoryLabel = RECEIPT_CATEGORIES.find((c) => c.value === receipt.category)?.label || receipt.category;

            return (
              <Card
                key={receipt.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors border-[#A0ADA3]/20 shadow-sm"
                onClick={() => handleReceiptClick(receipt)}
              >
                {/* Mobile Layout */}
                <div className="md:hidden p-4">
                  <div className="flex gap-4">
                    <ReceiptThumbnail filePath={receipt.file_path} getSignedUrl={getSignedUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#1C3B23] truncate">
                            {receipt.vendor || 'No vendor'}
                          </p>
                          {receipt.amount ? (
                            <span className="text-lg font-semibold text-[#1C3B23]">
                              {receipt.currency} ${receipt.amount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#A0ADA3]">No amount</span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0 bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30"
                        >
                          {categoryLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-[#A0ADA3]">
                        <span>{receipt.uploader?.full_name || receipt.uploader?.email}</span>
                        <span>·</span>
                        <span>{format(new Date(receipt.uploaded_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:grid md:grid-cols-[auto_1fr_100px_100px_100px_120px_80px] gap-4 p-4 items-center">
                  <ReceiptThumbnail filePath={receipt.file_path} getSignedUrl={getSignedUrl} />
                  <span className="font-medium text-[#1C3B23] truncate">
                    {receipt.vendor || 'No vendor'}
                  </span>
                  <span className="font-semibold text-[#1C3B23]">
                    {receipt.amount ? `$${receipt.amount.toFixed(2)}` : '-'}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs w-fit bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30"
                  >
                    {categoryLabel}
                  </Badge>
                  <span className="text-sm text-[#A0ADA3] truncate">
                    {receipt.uploader?.full_name || receipt.uploader?.email}
                  </span>
                  <span className="text-sm text-[#A0ADA3]">
                    {format(new Date(receipt.uploaded_at), 'MMM d')}
                  </span>
                  <span className="text-sm text-[#A0ADA3] truncate">
                    {receipt.task?.title || '-'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <UploadReceiptModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        projectId={projectId}
        onUploadComplete={refetch}
      />

      {/* Batch Upload Modal */}
      <BatchUploadReceiptModal
        open={batchUploadModalOpen}
        onOpenChange={setBatchUploadModalOpen}
        projectId={projectId}
        onUploadComplete={refetch}
      />

      {/* Detail Modal */}
      <ReceiptDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        receipt={selectedReceipt}
        projectId={projectId}
        getSignedUrl={getSignedUrl}
        onDelete={deleteReceipt}
      />
    </div>
  );
};
