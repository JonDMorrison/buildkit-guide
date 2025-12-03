import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthRole } from '@/hooks/useAuthRole';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowLeft,
  Download,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

type ImportStatus = 'uploaded' | 'parsing' | 'parsed' | 'importing' | 'imported' | 'parse_failed';

interface GCImport {
  id: string;
  project_id: string;
  uploaded_by: string;
  file_path: string;
  source_name: string;
  status: ImportStatus;
  total_rows: number;
  horizon_rows: number;
  imported_rows: number;
  error_message: string | null;
  created_at: string;
}

interface GCItem {
  id: string;
  import_id: string;
  row_index: number;
  raw_row_json: any;
  belongs_to_horizon: boolean;
  belongs_confidence: number;
  parsed_description: string | null;
  parsed_location: string | null;
  parsed_priority: string | null;
  parsed_due_date: string | null;
  parsed_gc_trade: string | null;
  suggested_internal_scope: string | null;
  mapped_deficiency_id: string | null;
  is_error: boolean;
  error_message: string | null;
}

interface ColumnMapping {
  description: string | null;
  location: string | null;
  gc_trade: string | null;
  status: string | null;
  due_date: string | null;
  gc_id: string | null;
}

export default function DeficiencyImport() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPM, isAdmin } = useAuthRole(projectId);
  const queryClient = useQueryClient();
  const canManage = isPM || isAdmin;

  const [selectedImport, setSelectedImport] = useState<GCImport | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editedItems, setEditedItems] = useState<Record<string, Partial<GCItem>>>({});

  // Column mapping state
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    description: null,
    location: null,
    gc_trade: null,
    status: null,
    due_date: null,
    gc_id: null,
  });
  const [pendingFileData, setPendingFileData] = useState<{ rows: any[]; sourceName: string; filePath: string } | null>(null);

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch imports
  const { data: imports = [], isLoading: importsLoading } = useQuery({
    queryKey: ['gc-imports', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('gc_deficiency_imports')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GCImport[];
    },
    enabled: !!projectId,
  });

  // Fetch items for selected import
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['gc-import-items', selectedImport?.id],
    queryFn: async () => {
      if (!selectedImport?.id) return [];
      const { data, error } = await supabase
        .from('gc_deficiency_items')
        .select('*')
        .eq('import_id', selectedImport.id)
        .order('row_index', { ascending: true });
      if (error) throw error;
      return data as GCItem[];
    },
    enabled: !!selectedImport?.id,
  });

  // Fetch saved column mapping
  const { data: savedMapping } = useQuery({
    queryKey: ['gc-column-mapping', projectId, pendingFileData?.sourceName],
    queryFn: async () => {
      if (!projectId || !pendingFileData?.sourceName) return null;
      const { data } = await supabase
        .from('gc_column_mappings')
        .select('mapping')
        .eq('project_id', projectId)
        .eq('source_name', pendingFileData.sourceName)
        .single();
      return data?.mapping as unknown as ColumnMapping | null;
    },
    enabled: !!projectId && !!pendingFileData?.sourceName,
  });

  // Auto-select Horizon items when items load
  useState(() => {
    if (items.length > 0 && selectedItems.size === 0) {
      const horizonItems = items
        .filter(item => item.belongs_to_horizon && item.belongs_confidence >= 0.7 && !item.mapped_deficiency_id)
        .map(item => item.id);
      setSelectedItems(new Set(horizonItems));
    }
  });

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    if (!projectId || !user) return;

    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext || '')) {
        throw new Error('Invalid file type. Please upload .xlsx, .xls, .csv, or .pdf files.');
      }

      // Upload file to storage first
      const importId = crypto.randomUUID();
      const filePath = `${projectId}/${importId}/source.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('gc_deficiency_uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL for the uploaded file (works for private buckets)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('gc_deficiency_uploads')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Failed to generate file access URL');
      }

      let rows: any[] = [];
      let headers: string[] = [];

      if (ext === 'pdf') {
        // Use AI-powered PDF parsing
        toast.info('Processing PDF with AI OCR. This may take a moment...');
        
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('parse-gc-pdf', {
          body: {
            fileUrl: signedUrlData.signedUrl,
            projectId,
            sourceName: file.name,
          },
        });

        if (pdfError) throw pdfError;
        
        if (!pdfResult?.success || !pdfResult?.rows?.length) {
          // Clean up uploaded file on failure
          await supabase.storage.from('gc_deficiency_uploads').remove([filePath]);
          throw new Error(pdfResult?.error || 'Could not extract data from PDF. Please request a CSV or Excel export from the GC.');
        }

        rows = pdfResult.rows;
        // For PDFs, we have fixed headers from AI extraction
        headers = ['gc_id', 'description', 'location', 'gc_trade', 'status', 'due_date'];
        
        toast.success(`Extracted ${rows.length} items from PDF`);
        
        // For PDFs, auto-set column mapping since AI already structured the data
        setColumnMapping({
          gc_id: 'gc_id',
          description: 'description',
          location: 'location',
          gc_trade: 'gc_trade',
          status: 'status',
          due_date: 'due_date',
        });
        
        // Skip column mapping dialog for PDFs since data is already structured
        setPendingFileData({ rows, sourceName: file.name, filePath });
        await completePdfUpload(rows, file.name, filePath);
        return;
      }

      // Parse Excel/CSV files
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        throw new Error('File appears to be empty or has no data rows.');
      }

      headers = jsonData[0].map(h => String(h || '').trim());
      rows = jsonData.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v != null && v !== ''));

      if (rows.length === 0) {
        throw new Error('No data rows found in file.');
      }

      if (rows.length > 500) {
        toast.warning(`File contains ${rows.length} rows. Only the first 500 will be processed.`);
      }

      // Store pending data and show column mapping
      setDetectedHeaders(headers);
      setPendingFileData({ rows, sourceName: file.name, filePath });
      setShowColumnMapping(true);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  }, [projectId, user]);

  // Complete PDF upload (skip column mapping since AI structured the data)
  const completePdfUpload = async (rows: any[], sourceName: string, filePath: string) => {
    if (!projectId || !user) return;

    try {
      // Create import record
      const { data: importRecord, error: createError } = await supabase
        .from('gc_deficiency_imports')
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          file_path: filePath,
          source_name: sourceName,
          status: 'uploaded',
          total_rows: rows.length,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Start parsing with pre-mapped columns
      setParsing(true);
      setSelectedImport(importRecord as GCImport);

      const pdfColumnMapping = {
        gc_id: 'gc_id',
        description: 'description',
        location: 'location',
        gc_trade: 'gc_trade',
        status: 'status',
        due_date: 'due_date',
      };

      const { error: parseError } = await supabase.functions.invoke('parse-gc-deficiency-list', {
        body: {
          importId: importRecord.id,
          rows: rows,
          projectInfo: {
            name: project?.name,
            horizonScope: project?.description,
          },
          columnMapping: pdfColumnMapping,
        },
      });

      if (parseError) throw parseError;

      toast.success('PDF parsed and processed successfully');
      queryClient.invalidateQueries({ queryKey: ['gc-imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['gc-import-items', importRecord.id] });

    } catch (error) {
      console.error('PDF processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process PDF');
    } finally {
      setParsing(false);
      setPendingFileData(null);
    }
  };

  // Complete upload after column mapping
  const completeUpload = async () => {
    if (!pendingFileData || !projectId || !user) return;

    try {
      // Create import record
      const { data: importRecord, error: createError } = await supabase
        .from('gc_deficiency_imports')
        .insert({
          project_id: projectId,
          uploaded_by: user.id,
          file_path: pendingFileData.filePath,
          source_name: pendingFileData.sourceName,
          status: 'uploaded',
          total_rows: pendingFileData.rows.length,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Save column mapping - use delete then insert to avoid type issues
      await supabase
        .from('gc_column_mappings')
        .delete()
        .eq('project_id', projectId)
        .eq('source_name', pendingFileData.sourceName);
      
      await (supabase
        .from('gc_column_mappings') as any)
        .insert({
          project_id: projectId,
          source_name: pendingFileData.sourceName,
          mapping: columnMapping,
        });

      // Start parsing
      setParsing(true);
      setShowColumnMapping(false);
      setSelectedImport(importRecord as GCImport);

      const { error: parseError } = await supabase.functions.invoke('parse-gc-deficiency-list', {
        body: {
          importId: importRecord.id,
          rows: pendingFileData.rows,
          projectInfo: {
            name: project?.name,
            horizonScope: project?.description,
          },
          columnMapping,
        },
      });

      if (parseError) throw parseError;

      toast.success('File parsed successfully');
      queryClient.invalidateQueries({ queryKey: ['gc-imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['gc-import-items', importRecord.id] });

    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setParsing(false);
      setPendingFileData(null);
    }
  };

  // Import selected items mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedImport || !user || !projectId) throw new Error('Missing data');

      const itemsToImport = items.filter(
        item => selectedItems.has(item.id) && !item.mapped_deficiency_id
      );

      if (itemsToImport.length === 0) {
        throw new Error('No items selected for import');
      }

      let imported = 0;
      let skipped = 0;

      for (const item of itemsToImport) {
        const edited = editedItems[item.id] || {};
        const description = edited.parsed_description ?? item.parsed_description;
        const location = edited.parsed_location ?? item.parsed_location;

        if (!description) {
          skipped++;
          continue;
        }

        // Create deficiency
        const { data: deficiency, error: defError } = await supabase
          .from('deficiencies')
          .insert({
            project_id: projectId,
            created_by: user.id,
            title: description.substring(0, 100),
            description: description,
            location: location,
            status: 'open',
            priority: item.parsed_priority === 'high' ? 1 : item.parsed_priority === 'low' ? 3 : 2,
          })
          .select('id')
          .single();

        if (defError) {
          console.error('Failed to create deficiency:', defError);
          skipped++;
          continue;
        }

        // Update item with mapped deficiency
        await supabase
          .from('gc_deficiency_items')
          .update({ mapped_deficiency_id: deficiency.id })
          .eq('id', item.id);

        imported++;
      }

      // Update import status
      await supabase
        .from('gc_deficiency_imports')
        .update({ 
          status: 'imported',
          imported_rows: imported,
        })
        .eq('id', selectedImport.id);

      // Log the action
      await supabase
        .from('gc_import_logs')
        .insert({
          import_id: selectedImport.id,
          user_id: user.id,
          action: 'imported',
          items_imported: imported,
          items_skipped: skipped,
        });

      return { imported, skipped };
    },
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported} deficiencies. ${result.skipped} skipped.`);
      queryClient.invalidateQueries({ queryKey: ['gc-imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['gc-import-items', selectedImport?.id] });
      setSelectedItems(new Set());
      setEditedItems({});
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === items.filter(i => !i.mapped_deficiency_id).length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.filter(i => !i.mapped_deficiency_id).map(i => i.id)));
    }
  };

  const getStatusBadge = (status: ImportStatus) => {
    switch (status) {
      case 'uploaded':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Uploaded</Badge>;
      case 'parsing':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Parsing</Badge>;
      case 'parsed':
        return <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Parsed</Badge>;
      case 'importing':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Importing</Badge>;
      case 'imported':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Imported</Badge>;
      case 'parse_failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number, belongsToHorizon: boolean) => {
    if (!belongsToHorizon) {
      return <Badge variant="outline" className="text-muted-foreground">Not Horizon</Badge>;
    }
    if (confidence >= 0.8) {
      return <Badge className="bg-green-600">High ({Math.round(confidence * 100)}%)</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge variant="secondary">Medium ({Math.round(confidence * 100)}%)</Badge>;
    }
    return <Badge variant="outline">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  return (
    <Layout>
      <div className="container py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/deficiencies`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">GC Deficiency Import</h1>
            <p className="text-muted-foreground text-sm">
              {project?.name || 'Loading...'} - Import deficiency lists from General Contractors
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left sidebar - Imports list */}
          <Card className="p-4 lg:col-span-1">
            <h2 className="font-semibold mb-4">Import History</h2>
            
            {/* Upload zone */}
            {canManage && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed rounded-lg p-6 text-center mb-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  disabled={uploadingFile || parsing}
                />
                {uploadingFile || parsing ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {parsing ? 'Parsing...' : 'Uploading...'}
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drop file here or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      .xlsx, .xls, .csv supported
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Imports list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {importsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : imports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No imports yet
                </p>
              ) : (
                imports.map((imp) => (
                  <div
                    key={imp.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedImport?.id === imp.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedImport(imp)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{imp.source_name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(imp.status as ImportStatus)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(imp.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {imp.status === 'parsed' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {imp.horizon_rows} of {imp.total_rows} items match Horizon
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Main content - Items review */}
          <Card className="p-4 lg:col-span-2">
            {!selectedImport ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">Select an import to review</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Or upload a new GC deficiency list
                </p>
              </div>
            ) : (
              <>
                {/* Import header */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <div>
                    <h2 className="font-semibold">{selectedImport.source_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedImport.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedImport.status as ImportStatus)}
                    {canManage && selectedImport.status === 'parsed' && (
                      <Button
                        onClick={() => importMutation.mutate()}
                        disabled={importing || selectedItems.size === 0}
                      >
                        {importing ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Import Selected ({selectedItems.size})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Items table */}
                {itemsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No items found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {canManage && selectedImport.status === 'parsed' && (
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedItems.size === items.filter(i => !i.mapped_deficiency_id).length}
                                onCheckedChange={toggleAll}
                              />
                            </TableHead>
                          )}
                          <TableHead>Description</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>GC Trade</TableHead>
                          <TableHead>Horizon Match</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow 
                            key={item.id}
                            className={item.is_error ? 'bg-destructive/10' : item.mapped_deficiency_id ? 'bg-muted/50' : ''}
                          >
                            {canManage && selectedImport.status === 'parsed' && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedItems.has(item.id)}
                                  onCheckedChange={() => toggleItem(item.id)}
                                  disabled={!!item.mapped_deficiency_id}
                                />
                              </TableCell>
                            )}
                            <TableCell className="max-w-[200px]">
                              {canManage && !item.mapped_deficiency_id ? (
                                <Input
                                  value={editedItems[item.id]?.parsed_description ?? item.parsed_description ?? ''}
                                  onChange={(e) => setEditedItems({
                                    ...editedItems,
                                    [item.id]: { ...editedItems[item.id], parsed_description: e.target.value }
                                  })}
                                  className="h-8 text-sm"
                                />
                              ) : (
                                <span className="text-sm truncate block">{item.parsed_description}</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[120px]">
                              {canManage && !item.mapped_deficiency_id ? (
                                <Input
                                  value={editedItems[item.id]?.parsed_location ?? item.parsed_location ?? ''}
                                  onChange={(e) => setEditedItems({
                                    ...editedItems,
                                    [item.id]: { ...editedItems[item.id], parsed_location: e.target.value }
                                  })}
                                  className="h-8 text-sm"
                                />
                              ) : (
                                <span className="text-sm truncate block">{item.parsed_location}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{item.parsed_gc_trade || '-'}</span>
                            </TableCell>
                            <TableCell>
                              {getConfidenceBadge(item.belongs_confidence, item.belongs_to_horizon)}
                            </TableCell>
                            <TableCell>
                              {item.is_error ? (
                                <Badge variant="destructive">Error</Badge>
                              ) : item.mapped_deficiency_id ? (
                                <Badge className="bg-green-600">Imported</Badge>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Column Mapping Dialog */}
        <Dialog open={showColumnMapping} onOpenChange={setShowColumnMapping}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Map Columns</DialogTitle>
              <DialogDescription>
                Tell us which columns contain the deficiency data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Description Column *</Label>
                <Select
                  value={columnMapping.description || ''}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, description: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {detectedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location Column</Label>
                <Select
                  value={columnMapping.location || ''}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, location: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {detectedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trade / Responsible Party Column</Label>
                <Select
                  value={columnMapping.gc_trade || ''}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, gc_trade: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {detectedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date Column</Label>
                <Select
                  value={columnMapping.due_date || ''}
                  onValueChange={(v) => setColumnMapping({ ...columnMapping, due_date: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {detectedHeaders.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowColumnMapping(false);
                setPendingFileData(null);
              }}>
                Cancel
              </Button>
              <Button
                onClick={completeUpload}
                disabled={!columnMapping.description}
              >
                Continue & Parse
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}