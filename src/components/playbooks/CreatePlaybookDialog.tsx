import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CreatePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; job_type: string; description: string }) => void;
  isCreating: boolean;
}

export function CreatePlaybookDialog({ open, onOpenChange, onCreate, isCreating }: CreatePlaybookDialogProps) {
  const [name, setName] = useState('');
  const [jobType, setJobType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), job_type: jobType.trim(), description: description.trim() });
    setName('');
    setJobType('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Playbook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pb-name">Name</Label>
            <Input
              id="pb-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Retail TI Standard"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pb-type">Job Type</Label>
            <Input
              id="pb-type"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              placeholder="e.g. Tenant Improvement"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pb-desc">Description</Label>
            <Textarea
              id="pb-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Operational playbook for..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
