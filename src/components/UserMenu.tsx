import { User, LogOut, Shield, Settings, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useNavigate } from 'react-router-dom';
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

export const UserMenu = () => {
  const { user, signOut } = useAuth();
  const { roles, isAdmin } = useUserRole();
  const { isGlobalAdmin, projectRoles } = useProjectRole();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = user.email?.[0].toUpperCase() || 'U';
  
  // Check if user can manage users (admin or PM on any project)
  const canManageUsers = isGlobalAdmin || isAdmin || projectRoles.some(pr => pr.role === 'project_manager');
  
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Admin',
      project_manager: 'PM',
      foreman: 'Foreman',
      internal_worker: 'Internal',
      external_trade: 'Trade',
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
        <DropdownMenuItem onClick={() => navigate('/settings/notifications')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Notification Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};