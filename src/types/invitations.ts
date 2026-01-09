/**
 * Type definitions for the Invitation feature
 */

export interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by: string;
  organization_id: string | null;
  project_id: string | null;
  role: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  fullName?: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  existingUser?: boolean;
  userId?: string;
}

export interface SendInviteRequest {
  email: string;
  fullName?: string;
  projectId?: string;
  role?: string;
}

export interface SendInviteResponse {
  success: boolean;
  message: string;
  error?: string;
}
