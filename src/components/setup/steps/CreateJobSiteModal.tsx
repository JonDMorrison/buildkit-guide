import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';

interface CreateJobSiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess?: () => void;
  onCreated?: (jobSiteId: string) => void;
}

interface Project {
  id: string;
  name: string;
}

export function CreateJobSiteModal({
  open,
  onOpenChange,
  projectId: initialProjectId,
  onSuccess,
  onCreated,
}: CreateJobSiteModalProps) {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState([150]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');

  // Fetch projects
  useEffect(() => {
    if (!open || !activeOrganizationId) return;

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name')
        .eq('organization_id', activeOrganizationId)
        .eq('is_deleted', false)
        .order('name');

      if (!error && data) {
        setProjects(data);
        if (!selectedProjectId && data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      }
    };

    fetchProjects();
  }, [open, activeOrganizationId, selectedProjectId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setGeofenceRadius([150]);
      if (!initialProjectId) {
        setSelectedProjectId('');
      }
    }
  }, [open, initialProjectId]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsGettingLocation(false);
        toast({
          title: 'Location captured',
          description: 'GPS coordinates have been set.',
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: 'Location error',
          description: error.message,
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the job site.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedProjectId) {
      toast({
        title: 'Project required',
        description: 'Please select a project for this job site.',
        variant: 'destructive',
      });
      return;
    }

    if (!activeOrganizationId) {
      toast({
        title: 'Error',
        description: 'No organization selected.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.from('job_sites').insert({
        name: name.trim(),
        address: address.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geofence_radius_meters: geofenceRadius[0],
        project_id: selectedProjectId,
        organization_id: activeOrganizationId,
        is_active: true,
      }).select('id').single();

      if (error) throw error;

      toast({
        title: 'Job site created',
        description: `${name} has been added successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ['job-sites'] });
      queryClient.invalidateQueries({ queryKey: ['setup-progress'] });
      onSuccess?.();
      if (data?.id) onCreated?.(data.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating job site:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create job site.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Add Job Site
          </DialogTitle>
          <DialogDescription>
            Create a new job site with location details for time tracking and geofencing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
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

          {/* Site Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Site Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Main Building, North Tower"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="123 Construction Ave, City, State"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* GPS Coordinates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>GPS Coordinates</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4 mr-2" />
                )}
                Use Current Location
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                  Latitude
                </Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="e.g., 40.7128"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                  Longitude
                </Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="e.g., -74.0060"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Geofence Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Geofence Radius</Label>
              <span className="text-sm text-muted-foreground">{geofenceRadius[0]}m</span>
            </div>
            <Slider
              value={geofenceRadius}
              onValueChange={setGeofenceRadius}
              min={50}
              max={2000}
              step={50}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Workers must be within this radius to check in at this site.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Job Site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
