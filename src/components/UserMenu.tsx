import { useState } from 'react';
import { User, LogOut, Shield, Settings, Users, FileText, Receipt, Rocket, Bug, Sun, Moon, LayoutDashboard, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { ReportIssueModal } from './ReportIssueModal';
import { EODReportModal } from './ai-assist/EODReportModal';

export const UserMenu = () => {
  const { user, signOut } = useAuth();
  const { roles, isAdmin } = useUserRole();
  const { isGlobalAdmin, projectRoles } = useProjectRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [eodReportOpen, setEodReportOpen] = useState(false);
  const { currentProjectId } = useCurrentProject();

  const { data: currentProject } = useQuery({
    queryKey: ['project-details', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('name,job_number')
        .eq('id', currentProjectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProjectId,
  });

  if (!user) return null;

  const initials = user.email?.[0].toUpperCase() || 'U';
  
  // Check if user can manage users (admin or PM on any project)
  const canManageUsers = isGlobalAdmin || isAdmin || projectRoles.some(pr => pr.role === 'project_manager');
  
  // Check if user can access accounting (admin or accounting role)
  const isAccounting = (roles as string[]).includes('accounting');
  const canAccessAccounting = isAdmin || isAccounting;
  
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      project_manager: 'PM',
      foreman: 'Foreman',
      internal_worker: 'Internal',
      external_trade: 'Trade',
      accounting: 'Accounting',
    };
    return labels[role] || role;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-xs">
                  {isAdmin && role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canManageUsers && (
          <>
            <DropdownMenuItem onClick={() => navigate('/users')}>
              <Users className="mr-2 h-4 w-4" />
              <span>User Management</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => navigate('/setup')}>
              <Rocket className="mr-2 h-4 w-4" />
              <span>Setup Wizard</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/audit')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Audit Log</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {canAccessAccounting && (
          <>
            <DropdownMenuItem onClick={() => navigate('/accounting/receipts')}>
              <Receipt className="mr-2 h-4 w-4" />
              <span>Accounting Receipts</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {currentProjectId && (
          <>
            <DropdownMenuItem onClick={() => setEodReportOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              <span>Generate EOD Report</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => navigate('/settings/notifications')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Notification Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setReportIssueOpen(true)}>
          <Bug className="mr-2 h-4 w-4" />
          <span>Report an Issue</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTimeout(() => signOut(), 0);
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ReportIssueModal
        open={reportIssueOpen}
        onOpenChange={setReportIssueOpen}
      />

      {currentProjectId && (
        <EODReportModal
          open={eodReportOpen}
          onOpenChange={setEodReportOpen}
          projectId={currentProjectId}
          projectName={currentProject?.name || ''}
          jobNumber={currentProject?.job_number}
        />
      )}
    </DropdownMenu>
  );
};