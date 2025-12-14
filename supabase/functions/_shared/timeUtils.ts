import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CORS Headers
// ============================================
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Response Helpers
// ============================================
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function badRequest(code: string, message: string, details?: unknown): Response {
  return json({ error: { code, message, details } }, 400);
}

export function forbidden(code: string, message: string, details?: unknown): Response {
  return json({ error: { code, message, details } }, 403);
}

export function notFound(code: string, message: string, details?: unknown): Response {
  return json({ error: { code, message, details } }, 404);
}

export function serverError(code: string, message: string, details?: unknown): Response {
  return json({ error: { code, message, details } }, 500);
}

// ============================================
// Supabase Clients
// ============================================
export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function authedClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// ============================================
// Auth Helpers
// ============================================
export async function requireAuthUser(req: Request): Promise<{ userId: string; authHeader: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return forbidden('UNAUTHORIZED', 'Missing authorization header');
  }

  const client = authedClient(authHeader);
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    console.error('Auth error:', error);
    return forbidden('UNAUTHORIZED', 'Invalid or expired token');
  }
  
  return { userId: user.id, authHeader };
}

// ============================================
// Project & Org Helpers
// ============================================
export async function getProjectAndOrg(projectId: string): Promise<{ 
  project: { id: string; name: string; organization_id: string } | null; 
  error?: string 
}> {
  const supabase = serviceClient();
  
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, organization_id')
    .eq('id', projectId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching project:', error);
    return { project: null, error: 'Failed to fetch project' };
  }
  
  if (!project) {
    return { project: null, error: 'Project not found' };
  }
  
  return { project };
}

export async function getOrgRole(orgId: string, userId: string): Promise<string | null> {
  const supabase = serviceClient();
  
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching org role:', error);
    return null;
  }
  
  return data?.role || null;
}

export async function assertOrgMember(orgId: string, userId: string): Promise<{ role: string } | Response> {
  const role = await getOrgRole(orgId, userId);
  
  if (!role) {
    return forbidden('NOT_ORG_MEMBER', 'User is not an active member of this organization');
  }
  
  return { role };
}

export async function assertProjectMember(projectId: string, userId: string): Promise<true | Response> {
  const supabase = serviceClient();
  
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error checking project membership:', error);
    return serverError('DB_ERROR', 'Failed to check project membership');
  }
  
  if (!data) {
    return forbidden('NOT_PROJECT_MEMBER', 'User is not a member of this project');
  }
  
  return true;
}

export async function assertTimeTrackingEnabled(orgId: string): Promise<true | Response> {
  const supabase = serviceClient();
  
  const { data, error } = await supabase
    .from('organization_settings')
    .select('time_tracking_enabled')
    .eq('organization_id', orgId)
    .maybeSingle();
  
  if (error) {
    console.error('Error checking time tracking settings:', error);
    return serverError('DB_ERROR', 'Failed to check time tracking settings');
  }
  
  if (!data?.time_tracking_enabled) {
    return forbidden('TIME_TRACKING_DISABLED', 'Time tracking is not enabled for this organization');
  }
  
  return true;
}

export async function getOrgSettings(orgId: string): Promise<{ 
  default_timezone: string; 
  time_tracking_enabled: boolean 
} | null> {
  const supabase = serviceClient();
  
  const { data, error } = await supabase
    .from('organization_settings')
    .select('default_timezone, time_tracking_enabled')
    .eq('organization_id', orgId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching org settings:', error);
    return null;
  }
  
  return data || { default_timezone: 'America/Vancouver', time_tracking_enabled: false };
}

// ============================================
// Job Site Helpers
// ============================================
export async function getJobSite(jobSiteId: string, orgId: string, projectId: string): Promise<{
  jobSite: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
    is_active: boolean;
  } | null;
  error?: string;
}> {
  const supabase = serviceClient();
  
  const { data, error } = await supabase
    .from('job_sites')
    .select('id, name, latitude, longitude, geofence_radius_meters, is_active')
    .eq('id', jobSiteId)
    .eq('organization_id', orgId)
    .eq('project_id', projectId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching job site:', error);
    return { jobSite: null, error: 'Failed to fetch job site' };
  }
  
  if (!data) {
    return { jobSite: null, error: 'Job site not found or does not belong to this project' };
  }
  
  if (!data.is_active) {
    return { jobSite: null, error: 'Job site is not active' };
  }
  
  return { jobSite: data };
}

// ============================================
// Time Entry Helpers
// ============================================
export async function getOpenEntry(orgId: string, userId: string, projectId?: string): Promise<{
  entry: any | null;
  error?: string;
}> {
  const supabase = serviceClient();
  
  let query = supabase
    .from('time_entries')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .is('check_out_at', null);
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching open entry:', error);
    return { entry: null, error: 'Failed to check for open entries' };
  }
  
  if (data && data.length > 1) {
    return { entry: null, error: 'MULTIPLE_OPEN_ENTRIES' };
  }
  
  return { entry: data?.[0] || null };
}

export async function findOpenEntryAcrossOrgs(userId: string): Promise<{
  entry: any | null;
  orgId: string | null;
  error?: string;
}> {
  const supabase = serviceClient();
  
  // Get all orgs user belongs to
  const { data: memberships, error: memError } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  if (memError || !memberships?.length) {
    return { entry: null, orgId: null, error: 'User has no active organization memberships' };
  }
  
  const orgIds = memberships.map(m => m.organization_id);
  
  // Find open entries
  const { data: entries, error } = await supabase
    .from('time_entries')
    .select('*')
    .in('organization_id', orgIds)
    .eq('user_id', userId)
    .is('check_out_at', null);
  
  if (error) {
    console.error('Error finding open entries:', error);
    return { entry: null, orgId: null, error: 'Failed to check for open entries' };
  }
  
  if (!entries?.length) {
    return { entry: null, orgId: null };
  }
  
  if (entries.length > 1) {
    return { entry: null, orgId: null, error: 'MULTIPLE_OPEN_ENTRIES' };
  }
  
  return { entry: entries[0], orgId: entries[0].organization_id };
}

// ============================================
// Geo Helpers (Haversine formula)
// ============================================
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ============================================
// Duration Helpers
// ============================================
export function computeDuration(checkInAt: string, checkOutAt: string): { 
  duration_minutes: number; 
  duration_hours: number 
} {
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  const diffMs = end - start;
  const duration_minutes = Math.round(diffMs / 60000);
  const duration_hours = Math.round((diffMs / 3600000) * 100) / 100;
  return { duration_minutes, duration_hours };
}
