import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pckpfhrdrjtcjzcdfvfs.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test user credentials - these should be seeded in test environment
export const TEST_USERS = {
  admin: {
    email: 'e2e-admin@buildsense.test',
    password: 'E2ETestPassword123!',
    role: 'admin' as const,
  },
  pm: {
    email: 'e2e-pm@buildsense.test',
    password: 'E2ETestPassword123!',
    role: 'project_manager' as const,
  },
  foreman: {
    email: 'e2e-foreman@buildsense.test',
    password: 'E2ETestPassword123!',
    role: 'foreman' as const,
  },
  worker: {
    email: 'e2e-worker@buildsense.test',
    password: 'E2ETestPassword123!',
    role: 'internal_worker' as const,
  },
};

export type TestUserRole = keyof typeof TEST_USERS;

/**
 * Get admin Supabase client for test setup/teardown
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable
 */
export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for E2E tests');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get user client for testing authenticated flows
 */
export function getUserClient(): SupabaseClient {
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja3BmaHJkcmp0Y2p6Y2RmdmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNzA0MzQsImV4cCI6MjA3OTk0NjQzNH0.QokdFYKlMT-5h_2rpqUCdRKsmUSwnR9Iota5ld5oWQE';
  
  return createClient(SUPABASE_URL, anonKey);
}

export interface TestContext {
  organizationId: string;
  projectId: string;
  userIds: Record<TestUserRole, string>;
}

/**
 * Seed test users and project for E2E tests
 */
export async function seedTestData(): Promise<TestContext> {
  const admin = getAdminClient();
  
  // Create or get test organization
  let { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('name', 'E2E Test Organization')
    .single();

  if (!org) {
    const { data: newOrg, error: orgError } = await admin
      .from('organizations')
      .insert({ name: 'E2E Test Organization', slug: 'e2e-test-org' })
      .select('id')
      .single();
    
    if (orgError) throw new Error(`Failed to create org: ${orgError.message}`);
    org = newOrg;
  }

  const userIds: Record<string, string> = {};

  // Create test users
  for (const [role, userData] of Object.entries(TEST_USERS)) {
    // Check if user exists
    const { data: existingUser } = await admin.auth.admin.listUsers();
    const existing = existingUser?.users.find(u => u.email === userData.email);
    
    if (existing) {
      userIds[role] = existing.id;
    } else {
      // Create user
      const { data: newUser, error: userError } = await admin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });
      
      if (userError) throw new Error(`Failed to create user ${role}: ${userError.message}`);
      userIds[role] = newUser.user.id;

      // Create profile
      await admin.from('profiles').upsert({
        id: newUser.user.id,
        email: userData.email,
        full_name: `E2E Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      });
    }

    // Add org membership
    await admin.from('organization_memberships').upsert({
      organization_id: org.id,
      user_id: userIds[role],
      role: role === 'admin' ? 'admin' : 'member',
      is_active: true,
    }, { onConflict: 'organization_id,user_id' });
  }

  // Create or get test project
  let { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('name', 'E2E Test Project')
    .eq('organization_id', org.id)
    .single();

  if (!project) {
    const { data: newProject, error: projectError } = await admin
      .from('projects')
      .insert({
        name: 'E2E Test Project',
        organization_id: org.id,
        location: 'E2E Test Location',
        created_by: userIds.admin,
        status: 'active',
      })
      .select('id')
      .single();
    
    if (projectError) throw new Error(`Failed to create project: ${projectError.message}`);
    project = newProject;
  }

  // Add project memberships
  const projectRoles: Record<TestUserRole, string> = {
    admin: 'project_manager',
    pm: 'project_manager',
    foreman: 'foreman',
    worker: 'internal_worker',
  };

  for (const [role, userId] of Object.entries(userIds)) {
    await admin.from('project_members').upsert({
      project_id: project.id,
      user_id: userId,
      role: projectRoles[role as TestUserRole],
    }, { onConflict: 'project_id,user_id' });
  }

  // Add user_roles for admin
  await admin.from('user_roles').upsert({
    user_id: userIds.admin,
    role: 'admin',
  }, { onConflict: 'user_id,role' });

  return {
    organizationId: org.id,
    projectId: project.id,
    userIds: userIds as Record<TestUserRole, string>,
  };
}

/**
 * Clean up test safety forms after test run
 */
export async function cleanupTestData(context: TestContext): Promise<void> {
  const admin = getAdminClient();
  
  // Delete test safety forms and related data
  const { data: forms } = await admin
    .from('safety_forms')
    .select('id')
    .eq('project_id', context.projectId);

  if (forms) {
    for (const form of forms) {
      // Delete related records first
      await admin.from('safety_form_amendments').delete().eq('safety_form_id', form.id);
      await admin.from('safety_form_acknowledgments').delete().eq('safety_form_id', form.id);
      await admin.from('safety_form_attendees').delete().eq('safety_form_id', form.id);
      await admin.from('safety_entries').delete().eq('safety_form_id', form.id);
      await admin.from('attachments').delete().eq('safety_form_id', form.id);
    }
    
    // Soft delete safety forms (or hard delete if testing)
    await admin
      .from('safety_forms')
      .update({ is_deleted: true })
      .eq('project_id', context.projectId);
  }
}

/**
 * Query safety form from DB for verification
 */
export async function getSafetyForm(formId: string) {
  const admin = getAdminClient();
  return admin
    .from('safety_forms')
    .select('*, safety_entries(*), safety_form_attendees(*), safety_form_amendments(*)')
    .eq('id', formId)
    .single();
}

/**
 * Attempt direct update to test immutability (should fail)
 */
export async function attemptDirectUpdate(formId: string) {
  const client = getUserClient();
  return client
    .from('safety_entries')
    .update({ field_value: 'TAMPERED VALUE' })
    .eq('safety_form_id', formId);
}
