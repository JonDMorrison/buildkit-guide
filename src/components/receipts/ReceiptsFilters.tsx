import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { RECEIPT_CATEGORIES, ReceiptCategory } from '@/hooks/useReceipts';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ReceiptsFiltersProps {
  projectId: string;
  category: ReceiptCategory | null;
  onCategoryChange: (category: ReceiptCategory | null) => void;
  uploadedBy: string | null;
  onUploadedByChange: (userId: string | null) => void;
  startDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  endDate: Date | null;
  onEndDateChange: (date: Date | null) => void;
}

interface ProjectMember {
  user_id: string;
  profile: {
    full_name: string | null;
    email: string;
  };
}

export const ReceiptsFilters = ({
  projectId,
  category,
  onCategoryChange,
  uploadedBy,
  onUploadedByChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: ReceiptsFiltersProps) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('user_id,profile:profiles!user_id(full_name,email)')
        .eq('project_id', projectId);
      setMembers((data as unknown as ProjectMember[]) || []);
    };
    fetchMembers();
  }, [projectId]);

  const hasFilters = category || uploadedBy || startDate || endDate;

  const clearFilters = () => {
    onCategoryChange(null);
    onUploadedByChange(null);
    onStartDateChange(null);
    onEndDateChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Category Filter */}
        <Select
          value={category || 'all'}
          onValueChange={(v) => onCategoryChange(v === 'all' ? null : v as ReceiptCategory)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
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

        {/* Uploaded By Filter */}
        <Select
          value={uploadedBy || 'all'}
          onValueChange={(v) => onUploadedByChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Uploaded by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.profile?.full_name || m.profile?.email || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-[130px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, 'MMM d') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate || undefined}
              onSelect={(d) => onStartDateChange(d || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-[130px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, 'MMM d') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate || undefined}
              onSelect={(d) => onEndDateChange(d || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};
