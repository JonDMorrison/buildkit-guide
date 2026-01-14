import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bug, Lightbulb, HelpCircle, AlertTriangle } from 'lucide-react';

interface ReportIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, description: 'Something is broken or not working correctly' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, description: 'Suggest a new feature or improvement' },
  { value: 'question', label: 'Question', icon: HelpCircle, description: 'Need help understanding something' },
  { value: 'urgent', label: 'Urgent Issue', icon: AlertTriangle, description: 'Critical problem affecting work' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const ReportIssueModal = ({ open, onOpenChange }: ReportIssueModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const { currentProjectId } = useCurrentProject();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState('normal');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide a title and description.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Collect browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('support_issues')
        .insert({
          user_id: user?.id,
          organization_id: activeOrganizationId,
          project_id: currentProjectId,
          current_route: location.pathname + location.search,
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          browser_info: browserInfo,
        });

      if (error) throw error;

      toast({
        title: 'Issue reported',
        description: 'Thank you for your feedback. We\'ll look into this.',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('bug');
      setPriority('normal');
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error submitting issue',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = CATEGORIES.find(c => c.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs or suggesting features.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-4 w-4" />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <p className="text-xs text-muted-foreground">{selectedCategory.description}</p>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen? Include steps to reproduce if applicable."
              rows={4}
              required
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Context Info */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
            <p><strong>Current Page:</strong> {location.pathname}</p>
            {currentProjectId && <p><strong>Project ID:</strong> {currentProjectId.slice(0, 8)}...</p>}
            <p className="text-muted-foreground/70">Browser info will be included automatically.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Issue'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};