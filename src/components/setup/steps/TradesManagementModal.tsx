import { useState, useEffect } from 'react';
import { Hammer, Plus, Pencil, Trash2, Loader2, Building2, Phone, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TradesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onTradeCountChange?: (count: number) => void;
}

interface Trade {
  id: string;
  name: string;
  trade_type: string | null;
  company_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  organization_id: string;
  is_active: boolean;
}

interface Project {
  id: string;
  name: string;
}

const TRADE_TYPES = [
  'General',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Carpentry',
  'Masonry',
  'Roofing',
  'Painting',
  'Flooring',
  'Drywall',
  'Concrete',
  'Steel',
  'Glazing',
  'Landscaping',
  'Fire Protection',
  'Elevator',
  'Other',
];

export function TradesManagementModal({
  open,
  onOpenChange,
  projectId: initialProjectId,
  onTradeCountChange,
}: TradesManagementModalProps) {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  
  // Form state for new/edit trade
  const [isEditing, setIsEditing] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeName, setTradeName] = useState('');
  const [tradeType, setTradeType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Fetch projects and trades
  useEffect(() => {
    if (!open || !activeOrganizationId) return;

    const fetchData = async () => {
      setIsLoading(true);

      // Fetch projects
      const { data: projectData } = await supabase
        .from('projects')
        .select('id,name')
        .eq('organization_id', activeOrganizationId)
        .eq('is_deleted', false)
        .order('name');

      if (projectData) {
        setProjects(projectData);
        if (!selectedProjectId && projectData.length > 0) {
          setSelectedProjectId(projectData[0].id);
        }
      }

      setIsLoading(false);
    };

    fetchData();
  }, [open, activeOrganizationId]);

  // Fetch trades for the organization
  useEffect(() => {
    if (!activeOrganizationId || !open) return;

    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .order('name');

      if (!error && data) {
        setTrades(data as unknown as Trade[]);
        onTradeCountChange?.(data.length);
      }
    };

    fetchTrades();
  }, [activeOrganizationId, open, onTradeCountChange]);

  const resetForm = () => {
    setIsEditing(false);
    setEditingTradeId(null);
    setTradeName('');
    setTradeType('');
    setCompanyName('');
    setContactPhone('');
    setContactEmail('');
  };

  const handleEdit = (trade: Trade) => {
    setIsEditing(true);
    setEditingTradeId(trade.id);
    setTradeName(trade.name);
    setTradeType(trade.trade_type || '');
    setCompanyName(trade.company_name || '');
    setContactPhone(trade.contact_phone || '');
    setContactEmail(trade.contact_email || '');
  };

  const handleSave = async () => {
    if (!tradeName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a trade name.',
        variant: 'destructive',
      });
      return;
    }

    if (!activeOrganizationId) {
      toast({
        title: 'Organization required',
        description: 'No active organization found.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const tradeData = {
        name: tradeName.trim(),
        trade_type: tradeType || 'General',
        company_name: companyName.trim() || '',
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        organization_id: activeOrganizationId,
      };

      if (editingTradeId) {
        const { error } = await supabase
          .from('trades')
          .update(tradeData)
          .eq('id', editingTradeId);
        
        if (error) throw error;
        
        setTrades(trades.map(t => t.id === editingTradeId ? { ...t, ...tradeData, id: t.id, is_active: t.is_active } : t));
        toast({ title: 'Trade updated' });
      } else {
        const { data, error } = await supabase
          .from('trades')
          .insert(tradeData)
          .select()
          .single();
        
        if (error) throw error;
        
        const newTrades = [...trades, data as unknown as Trade];
        setTrades(newTrades);
        onTradeCountChange?.(newTrades.length);
        toast({ title: 'Trade added' });
      }

      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['setup-progress'] });
      resetForm();
    } catch (error: any) {
      console.error('Error saving trade:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save trade.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tradeId: string) => {
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId);

      if (error) throw error;

      const newTrades = trades.filter(t => t.id !== tradeId);
      setTrades(newTrades);
      onTradeCountChange?.(newTrades.length);
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      toast({ title: 'Trade deleted' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete trade.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Manage Trades
          </DialogTitle>
          <DialogDescription>
            Add and manage trades/subcontractors for your projects. Add at least 3 trades to complete this setup step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Form */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium mb-3">
              {isEditing ? 'Edit Trade' : 'Add New Trade'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tradeName">Trade Name *</Label>
                <Input
                  id="tradeName"
                  placeholder="e.g., ABC Electric"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tradeType">Trade Type</Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Full company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="contact@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Trade' : 'Add Trade'}
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Trades List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Current Trades ({trades.length})</Label>
              {trades.length < 3 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Add {3 - trades.length} more to complete
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[200px] border rounded-lg">
              {trades.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Hammer className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No trades added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium">{trade.name}</TableCell>
                        <TableCell>
                          {trade.trade_type && (
                            <Badge variant="secondary">{trade.trade_type}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {trade.company_name || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(trade)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(trade.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
