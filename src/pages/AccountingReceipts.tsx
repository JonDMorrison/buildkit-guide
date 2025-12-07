import { useState, useMemo, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NoAccess } from '@/components/NoAccess';
import { 
  Download, 
  Receipt as ReceiptIcon, 
  Loader2, 
  DollarSign, 
  FileText,
  Calendar as CalendarIcon,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  CheckCircle2,
  Clock,
  CircleDot,
  CheckSquare,
  Square
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { RECEIPT_CATEGORIES, ReceiptCategory, ReceiptReviewStatus } from '@/hooks/useReceipts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { AccountingReceiptDetail } from '@/components/accounting/AccountingReceiptDetail';

interface AccountingReceipt {
  id: string;
  project_id: string;
  task_id: string | null;
  uploaded_by: string;
  file_path: string;
  amount: number | null;
  currency: string;
  vendor: string | null;
  category: ReceiptCategory;
  notes: string | null;
  uploaded_at: string;
  processed_data_json: any;
  review_status: ReceiptReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  project?: { name: string } | null;
  uploader?: { full_name: string | null; email: string } | null;
  reviewer?: { full_name: string | null; email: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface Uploader {
  id: string;
  full_name: string | null;
  email: string;
}

const ITEMS_PER_PAGE = 25;

const AccountingReceipts = () => {
  const { user } = useAuth();
  const { isAdmin, roles, loading: rolesLoading } = useUserRole();
  const { toast } = useToast();

  // Data states
  const [receipts, setReceipts] = useState<AccountingReceipt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [category, setCategory] = useState<ReceiptCategory | 'all'>('all');
  const [uploadedBy, setUploadedBy] = useState<string>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReceiptReviewStatus | 'all'>('all');

  // Table states
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'vendor'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState<AccountingReceipt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);

  // Check if user has accounting access (cast to any to handle new role)
  const isAccounting = (roles as string[]).includes('accounting');
  const hasAccess = isAdmin || isAccounting;

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      setProjects(data || []);
    };
    if (hasAccess) fetchProjects();
  }, [hasAccess]);

  // Fetch unique uploaders
  useEffect(() => {
    const fetchUploaders = async () => {
      const { data } = await supabase
        .from('receipts')
        .select('uploaded_by')
        .order('uploaded_by');
      
      if (data) {
        const uniqueIds = [...new Set(data.map(r => r.uploaded_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uniqueIds);
        setUploaders(profiles || []);
      }
    };
    if (hasAccess) fetchUploaders();
  }, [hasAccess]);

  // Fetch receipts with filters
  const fetchReceipts = useCallback(async () => {
    if (!hasAccess) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select(`
          *,
          project:projects(name),
          uploader:profiles!uploaded_by(full_name, email),
          reviewer:profiles!reviewed_by(full_name, email)
        `, { count: 'exact' });

      // Apply filters
      if (selectedProjects.length > 0) {
        query = query.in('project_id', selectedProjects);
      }
      if (startDate) {
        query = query.gte('uploaded_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('uploaded_at', endOfDay.toISOString());
      }
      if (category && category !== 'all') {
        query = query.eq('category', category as ReceiptCategory);
      }
      if (uploadedBy && uploadedBy !== 'all') {
        query = query.eq('uploaded_by', uploadedBy);
      }
      if (minAmount) {
        query = query.gte('amount', parseFloat(minAmount));
      }
      if (maxAmount) {
        query = query.lte('amount', parseFloat(maxAmount));
      }
      if (reviewStatus && reviewStatus !== 'all') {
        query = query.eq('review_status', reviewStatus);
      }

      // Apply sorting
      const sortColumn = sortBy === 'date' ? 'uploaded_at' : sortBy;
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setReceipts(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching receipts:', error);
      toast({
        title: 'Error loading receipts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [hasAccess, selectedProjects, startDate, endDate, category, uploadedBy, minAmount, maxAmount, reviewStatus, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const avgAmount = receipts.length > 0 ? totalAmount / receipts.length : 0;
    
    // Calculate top category
    const categoryTotals: Record<string, number> = {};
    receipts.forEach(r => {
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + (r.amount || 0);
    });
    const topCategory = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
      totalAmount,
      count: totalCount,
      avgAmount,
      topCategory,
    };
  }, [receipts, totalCount]);

  const clearFilters = () => {
    setSelectedProjects([]);
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
    setCategory('all');
    setUploadedBy('all');
    setMinAmount('');
    setMaxAmount('');
    setReviewStatus('all');
    setCurrentPage(1);
  };

  const toggleSort = (field: 'date' | 'amount' | 'vendor') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    // Build CSV content
    const headers = [
      'receipt_id',
      'project_id', 
      'project_name',
      'purchase_date',
      'uploaded_at',
      'vendor',
      'amount',
      'currency',
      'category',
      'notes',
      'uploaded_by_user_id',
      'uploaded_by_name',
      'task_id',
      'file_path'
    ];

    const rows = receipts.map(r => [
      r.id,
      r.project_id,
      r.project?.name || '',
      r.processed_data_json?.purchase_date || format(new Date(r.uploaded_at), 'yyyy-MM-dd'),
      format(new Date(r.uploaded_at), 'yyyy-MM-dd HH:mm:ss'),
      r.vendor || '',
      r.amount?.toString() || '',
      r.currency,
      r.category,
      r.notes || '',
      r.uploaded_by,
      r.uploader?.full_name || r.uploader?.email || '',
      r.task_id || '',
      r.file_path
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `receipts_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    setExportDialogOpen(false);
    toast({
      title: 'Export complete',
      description: `${receipts.length} receipts exported to CSV.`,
    });
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Check if all current page items are selected
  const currentPageIds = receipts.map(r => r.id);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
  const someCurrentPageSelected = currentPageIds.some(id => selectedIds.has(id));

  // Batch selection handlers
  const toggleSelectAllOnPage = () => {
    const newSelected = new Set(selectedIds);
    if (allCurrentPageSelected) {
      // Deselect all on current page
      currentPageIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on current page
      currentPageIds.forEach(id => newSelected.add(id));
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchStatusUpdate = async (newStatus: ReceiptReviewStatus) => {
    if (selectedIds.size === 0) return;
    
    setBatchUpdating(true);
    try {
      const updateData: any = { review_status: newStatus };
      
      // Only set reviewed_by and reviewed_at when moving from pending
      if (newStatus !== 'pending') {
        updateData.reviewed_by = user?.id;
        updateData.reviewed_at = new Date().toISOString();
      } else {
        updateData.reviewed_by = null;
        updateData.reviewed_at = null;
      }

      const { error } = await supabase
        .from('receipts')
        .update(updateData)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `${selectedIds.size} receipt(s) marked as ${newStatus}.`,
      });

      setSelectedIds(new Set());
      fetchReceipts();
    } catch (error: any) {
      toast({
        title: 'Error updating receipts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBatchUpdating(false);
    }
  };

  // Clear selection only when filters change (not page change - persist across pages)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedProjects, startDate, endDate, category, uploadedBy, minAmount, maxAmount, reviewStatus]);

  if (rolesLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6 bg-[#FAFAFA] min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1C3B23]">Receipts</h1>
            <p className="text-[#A0ADA3] mt-1">Review, filter, and export receipts across all projects.</p>
          </div>
          <Button
            onClick={() => setExportDialogOpen(true)}
            disabled={receipts.length === 0}
            className="bg-[#1C3B23] hover:bg-[#3D7237] text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-[#A0ADA3]/20 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Project Multi-Select */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">Projects</Label>
                <Select
                  value={selectedProjects.length === 0 ? 'all' : 'custom'}
                  onValueChange={(v) => {
                    if (v === 'all') setSelectedProjects([]);
                  }}
                >
                  <SelectTrigger className="border-[#A0ADA3]/30">
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} onClick={() => {
                        setSelectedProjects(prev => 
                          prev.includes(p.id) 
                            ? prev.filter(id => id !== p.id)
                            : [...prev, p.id]
                        );
                      }}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn(
                      "w-full justify-start text-left font-normal border-[#A0ADA3]/30",
                      !startDate && "text-muted-foreground"
                    )}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn(
                      "w-full justify-start text-left font-normal border-[#A0ADA3]/30",
                      !endDate && "text-muted-foreground"
                    )}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ReceiptCategory | 'all')}>
                  <SelectTrigger className="border-[#A0ADA3]/30">
                    <SelectValue />
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
                <Select value={uploadedBy} onValueChange={setUploadedBy}>
                  <SelectTrigger className="border-[#A0ADA3]/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {uploaders.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Range */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">Amount Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="border-[#A0ADA3]/30"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="border-[#A0ADA3]/30"
                  />
                </div>
              </div>

              {/* Review Status Filter */}
              <div className="space-y-2">
                <Label className="text-[#1C3B23]">Review Status</Label>
                <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as ReceiptReviewStatus | 'all')}>
                  <SelectTrigger className="border-[#A0ADA3]/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="mt-4 text-[#A0ADA3]"
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[#A0ADA3]/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#A0ADA3]">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#DC8644]" />
                <span className="text-2xl font-bold text-[#1C3B23]">
                  ${metrics.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-[#A0ADA3] mt-1">Current filters</p>
            </CardContent>
          </Card>

          <Card className="border-[#A0ADA3]/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#A0ADA3]">Number of Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#3D7237]" />
                <span className="text-2xl font-bold text-[#1C3B23]">{metrics.count}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#A0ADA3]/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#A0ADA3]">Average per Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#3D7237]" />
                <span className="text-2xl font-bold text-[#1C3B23]">
                  ${metrics.avgAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#A0ADA3]/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#A0ADA3]">Top Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30 text-lg px-3 py-1">
                {RECEIPT_CATEGORIES.find(c => c.value === metrics.topCategory)?.label || metrics.topCategory}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Sort Controls & Batch Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[#A0ADA3]">Sort by:</span>
            {(['date', 'amount', 'vendor'] as const).map((field) => (
              <Button
                key={field}
                variant={sortBy === field ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => toggleSort(field)}
                className="gap-1 capitalize"
              >
                {field}
                {sortBy === field && (
                  <ArrowUpDown className={`h-3 w-3 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                )}
              </Button>
            ))}
          </div>

          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-2 bg-[#1C3B23]/5 rounded-lg border border-[#1C3B23]/20">
              <span className="text-sm font-medium text-[#1C3B23]">
                {selectedIds.size} selected
              </span>
              <div className="h-4 w-px bg-[#A0ADA3]/30" />
              <Button
                size="sm"
                variant="outline"
                disabled={batchUpdating}
                onClick={() => handleBatchStatusUpdate('reviewed')}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {batchUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={batchUpdating}
                onClick={() => handleBatchStatusUpdate('processed')}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                {batchUpdating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Mark Processed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={batchUpdating}
                onClick={() => setSelectedIds(new Set())}
                className="text-[#A0ADA3]"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Receipts Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-4 w-24 bg-muted rounded" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-[#A0ADA3]/30">
            <ReceiptIcon className="h-12 w-12 mx-auto text-[#A0ADA3] mb-4" />
            <h3 className="font-medium text-[#1C3B23] mb-1">No receipts found</h3>
            <p className="text-sm text-[#A0ADA3]">Try adjusting your filters</p>
          </Card>
        ) : (
          <>
            {/* Selection Info Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-[#1C3B23]/5 rounded-lg border border-[#1C3B23]/20 mb-2">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-[#1C3B23]" />
                  <span className="text-sm font-medium text-[#1C3B23]">
                    {selectedIds.size} receipt{selectedIds.size !== 1 ? 's' : ''} selected
                    {selectedIds.size > currentPageIds.length && (
                      <span className="text-[#A0ADA3] ml-1">
                        (across multiple pages)
                      </span>
                    )}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[#A0ADA3] hover:text-[#1C3B23]"
                >
                  Clear all
                </Button>
              </div>
            )}

            {/* Desktop Table Header */}
            <div className="hidden lg:grid lg:grid-cols-[40px_60px_1fr_120px_100px_100px_100px_100px_80px] gap-4 px-4 py-2 text-sm font-medium text-[#A0ADA3] border-b border-[#A0ADA3]/20">
              <div 
                className="flex items-center justify-center cursor-pointer"
                onClick={toggleSelectAllOnPage}
                title={allCurrentPageSelected ? "Deselect all on this page" : "Select all on this page"}
              >
                <Checkbox 
                  checked={allCurrentPageSelected}
                  className={cn(
                    "border-[#A0ADA3]",
                    someCurrentPageSelected && !allCurrentPageSelected && "data-[state=unchecked]:bg-[#A0ADA3]/30"
                  )}
                />
              </div>
              <span></span>
              <span>Project / Vendor</span>
              <span>Amount</span>
              <span>Category</span>
              <span>Status</span>
              <span>Uploaded By</span>
              <span>Date</span>
              <span>Task</span>
            </div>

            <div className="space-y-2">
              {receipts.map((receipt) => (
                <ReceiptRow 
                  key={receipt.id} 
                  receipt={receipt} 
                  isSelected={selectedIds.has(receipt.id)}
                  onToggleSelect={(e) => toggleSelectOne(receipt.id, e)}
                  onClick={() => {
                    setSelectedReceipt(receipt);
                    setDetailOpen(true);
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-[#A0ADA3]">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-[#1C3B23]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export filtered receipts</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              You are about to export <strong>{receipts.length}</strong> receipts for the selected filters.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExportCSV} className="bg-[#1C3B23] hover:bg-[#3D7237]">
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Drawer */}
        <AccountingReceiptDetail
          receipt={selectedReceipt}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdate={fetchReceipts}
        />
      </div>
    </Layout>
  );
};

// Receipt row component
interface ReceiptRowProps {
  receipt: AccountingReceipt;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const ReceiptRow = ({ receipt, isSelected, onToggleSelect, onClick }: ReceiptRowProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadThumbnail = async () => {
      const { data } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.file_path, 3600);
      setThumbnailUrl(data?.signedUrl || null);
    };
    loadThumbnail();
  }, [receipt.file_path]);

  const categoryLabel = RECEIPT_CATEGORIES.find(c => c.value === receipt.category)?.label || receipt.category;

  const getStatusBadge = (status: ReceiptReviewStatus) => {
    switch (status) {
      case 'reviewed':
        return (
          <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Reviewed
          </Badge>
        );
      case 'processed':
        return (
          <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Processed
          </Badge>
        );
      default:
        return (
          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
            <CircleDot className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors border-[#A0ADA3]/20 shadow-sm"
      onClick={onClick}
    >
      {/* Mobile Layout */}
      <div className="lg:hidden p-4">
        <div className="flex gap-3">
          <div 
            className="flex items-start pt-1"
            onClick={onToggleSelect}
          >
            <Checkbox 
              checked={isSelected}
              className="border-[#A0ADA3]"
            />
          </div>
          <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Receipt" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[#1C3B23] truncate">
                  {receipt.vendor || 'No vendor'}
                </p>
                <span className="text-lg font-semibold text-[#DC8644]">
                  {receipt.amount ? `${receipt.currency} $${receipt.amount.toFixed(2)}` : '-'}
                </span>
              </div>
              {getStatusBadge(receipt.review_status)}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#A0ADA3]">
              <span>{receipt.project?.name || 'Unknown project'}</span>
              <span>·</span>
              <span>{format(new Date(receipt.uploaded_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-[40px_60px_1fr_120px_100px_100px_100px_100px_80px] gap-4 p-4 items-center">
        <div 
          className="flex items-center justify-center"
          onClick={onToggleSelect}
        >
          <Checkbox 
            checked={isSelected}
            className="border-[#A0ADA3]"
          />
        </div>
        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="Receipt" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#1C3B23] truncate">{receipt.vendor || 'No vendor'}</p>
          <p className="text-xs text-[#A0ADA3] truncate">{receipt.project?.name}</p>
        </div>
        <span className="font-semibold text-[#DC8644]">
          {receipt.amount ? `$${receipt.amount.toFixed(2)}` : '-'}
        </span>
        <Badge className="text-xs w-fit bg-[#DC8644]/10 text-[#DC8644] border-[#DC8644]/30">
          {categoryLabel}
        </Badge>
        {getStatusBadge(receipt.review_status)}
        <span className="text-sm text-[#A0ADA3] truncate">
          {receipt.uploader?.full_name || receipt.uploader?.email}
        </span>
        <span className="text-sm text-[#A0ADA3]">
          {format(new Date(receipt.uploaded_at), 'MMM d')}
        </span>
        <span className="text-sm text-[#A0ADA3] truncate">
          {receipt.task_id ? 'Linked' : '-'}
        </span>
      </div>
    </Card>
  );
};

export default AccountingReceipts;
