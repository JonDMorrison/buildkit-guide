import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { Receipt } from '@/hooks/useReceipts';
import { format } from 'date-fns';

interface ExportReceiptsButtonProps {
  receipts: Receipt[];
  projectId: string;
}

export const ExportReceiptsButton = ({ receipts, projectId }: ExportReceiptsButtonProps) => {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = () => {
    setExporting(true);

    try {
      const headers = [
        'project_id',
        'uploaded_at',
        'vendor',
        'amount',
        'currency',
        'category',
        'notes',
        'uploaded_by',
        'task',
        'file_path',
      ];

      const rows = receipts.map((r) => [
        r.project_id,
        format(new Date(r.uploaded_at), 'yyyy-MM-dd HH:mm:ss'),
        r.vendor || '',
        r.amount?.toString() || '',
        r.currency,
        r.category,
        r.notes || '',
        r.uploader?.full_name || r.uploader?.email || '',
        r.task?.title || '',
        r.file_path,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipts-${projectId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={exportToCSV}
      disabled={exporting || receipts.length === 0}
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export CSV
    </Button>
  );
};
