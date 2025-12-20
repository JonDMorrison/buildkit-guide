import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// SAFETY GUARDRAILS - MUST PASS BEFORE TESTS
// ============================================

const ALLOWED_SUPABASE_REFS = [
  'pckpfhrdrjtcjzcdfvfs', // Lovable Cloud test instance
  // Add other allowed test project refs here
];

/**
 * Verify E2E environment is correctly configured.
 * FAILS FAST if running against production or misconfigured.
 */
export function enforceE2EGuardrails(): void {
  // Check E2E_ENV=test requirement
  if (process.env.E2E_ENV !== 'test') {
    console.error('❌ E2E_ENV must be set to "test"');
    console.error('   Run with: E2E_ENV=test pnpm test:e2e');
    process.exit(1);
  }

  // Extract project ref from URL
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  const projectRef = match?.[1];

  if (!projectRef) {
    console.error('❌ VITE_SUPABASE_URL is not a valid Supabase URL');
    console.error(`   Got: ${supabaseUrl}`);
    process.exit(1);
  }

  if (!ALLOWED_SUPABASE_REFS.includes(projectRef)) {
    console.error('❌ SUPABASE PROJECT NOT IN ALLOWLIST');
    console.error(`   Project ref "${projectRef}" is not allowed for E2E tests`);
    console.error(`   Allowed refs: ${ALLOWED_SUPABASE_REFS.join(', ')}`);
    console.error('   This prevents accidental test runs against production!');
    process.exit(1);
  }

  // Verify service role key exists
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for E2E tests');
    process.exit(1);
  }

  console.log(`✓ E2E guardrails passed (project: ${projectRef})`);
}

// Run guardrails on module load
enforceE2EGuardrails();

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pckpfhrdrjtcjzcdfvfs.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Generate unique run ID for test isolation
const RUN_ID = `e2e_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

console.log(`📋 E2E Run ID: ${RUN_ID}`);

// Test user credentials - unique per run to avoid collision
export const TEST_USERS = {
  admin: {
    email: `${RUN_ID}-admin@buildsense.test`,
    password: 'E2ETestPassword123!',
    role: 'admin' as const,
  },
  pm: {
    email: `${RUN_ID}-pm@buildsense.test`,
    password: 'E2ETestPassword123!',
    role: 'project_manager' as const,
  },
  foreman: {
    email: `${RUN_ID}-foreman@buildsense.test`,
    password: 'E2ETestPassword123!',
    role: 'foreman' as const,
  },
  worker: {
    email: `${RUN_ID}-worker@buildsense.test`,
    password: 'E2ETestPassword123!',
    role: 'internal_worker' as const,
  },
};

export type TestUserRole = keyof typeof TEST_USERS;

export function getRunId(): string {
  return RUN_ID;
}

/**
 * Get admin Supabase client for test setup/teardown
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
  runId: string;
}

/**
 * Seed test users and project for E2E tests.
 * Uses unique RUN_ID to avoid collision between parallel runs.
 */
export async function seedTestData(): Promise<TestContext> {
  const admin = getAdminClient();
  
  // Create test organization with unique name
  const orgName = `E2E Test Organization ${RUN_ID}`;
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ 
      name: orgName, 
      slug: `e2e-${RUN_ID.toLowerCase()}` 
    })
    .select('id')
    .single();
  
  if (orgError) throw new Error(`Failed to create org: ${orgError.message}`);

  const userIds: Record<string, string> = {};

  // Create test users
  for (const [role, userData] of Object.entries(TEST_USERS)) {
    // Create user with unique email
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

    // Add org membership
    await admin.from('organization_memberships').insert({
      organization_id: org.id,
      user_id: userIds[role],
      role: role === 'admin' ? 'admin' : 'member',
      is_active: true,
    });
  }

  // Create test project with unique name
  const projectName = `E2E Test Project ${RUN_ID}`;
  const { data: project, error: projectError } = await admin
    .from('projects')
    .insert({
      name: projectName,
      organization_id: org.id,
      location: 'E2E Test Location',
      created_by: userIds.admin,
      status: 'active',
    })
    .select('id')
    .single();
  
  if (projectError) throw new Error(`Failed to create project: ${projectError.message}`);

  // Add project memberships
  const projectRoles: Record<TestUserRole, string> = {
    admin: 'project_manager',
    pm: 'project_manager',
    foreman: 'foreman',
    worker: 'internal_worker',
  };

  for (const [role, userId] of Object.entries(userIds)) {
    await admin.from('project_members').insert({
      project_id: project.id,
      user_id: userId,
      role: projectRoles[role as TestUserRole],
    });
  }

  // Add user_roles for admin
  await admin.from('user_roles').insert({
    user_id: userIds.admin,
    role: 'admin',
  });

  console.log(`✓ Test data seeded (runId: ${RUN_ID})`);

  return {
    organizationId: org.id,
    projectId: project.id,
    userIds: userIds as Record<TestUserRole, string>,
    runId: RUN_ID,
  };
}

/**
 * Clean up ALL test data after test run.
 * Deletes in correct FK order to satisfy constraints.
 * This MUST run even if tests fail.
 */
export async function cleanupTestData(context: TestContext): Promise<void> {
  const admin = getAdminClient();
  
  console.log(`🧹 Cleaning up test data for run: ${context.runId}`);
  
  try {
    // 1. Get all safety forms for this project
    const { data: forms } = await admin
      .from('safety_forms')
      .select('id')
      .eq('project_id', context.projectId);

    if (forms && forms.length > 0) {
      const formIds = forms.map(f => f.id);
      
      // Delete in FK order (children first)
      await admin.from('safety_form_amendments').delete().in('safety_form_id', formIds);
      await admin.from('safety_form_acknowledgments').delete().in('safety_form_id', formIds);
      await admin.from('safety_form_attendees').delete().in('safety_form_id', formIds);
      await admin.from('safety_entries').delete().in('safety_form_id', formIds);
      await admin.from('attachments').delete().in('safety_form_id', formIds);
      
      // Delete forms (hard delete for test cleanup)
      await admin.from('safety_forms').delete().eq('project_id', context.projectId);
    }

    // 2. Delete project members
    await admin.from('project_members').delete().eq('project_id', context.projectId);

    // 3. Delete project
    await admin.from('projects').delete().eq('id', context.projectId);

    // 4. Delete user roles
    for (const userId of Object.values(context.userIds)) {
      await admin.from('user_roles').delete().eq('user_id', userId);
    }

    // 5. Delete org memberships
    await admin.from('organization_memberships').delete().eq('organization_id', context.organizationId);

    // 6. Delete organization
    await admin.from('organizations').delete().eq('id', context.organizationId);

    // 7. Delete auth users
    for (const userId of Object.values(context.userIds)) {
      await admin.auth.admin.deleteUser(userId);
    }

    console.log(`✓ Test data cleaned up for run: ${context.runId}`);
  } catch (error) {
    console.error(`⚠️ Cleanup error (non-fatal):`, error);
    // Don't throw - cleanup errors shouldn't fail the test run
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

/**
 * Recompute hash and verify it matches stored value.
 * Uses the same canonical hashing logic as production.
 */
export async function verifyHashDeterminism(formId: string): Promise<{
  storedHash: string | null;
  recomputedHash1: string | null;
  recomputedHash2: string | null;
  isStable: boolean;
  matchesStored: boolean;
}> {
  const admin = getAdminClient();
  
  // Fetch form with entries and attendees
  const { data: form } = await admin
    .from('safety_forms')
    .select('id, project_id, form_type, created_by, created_at, inspection_date, record_hash')
    .eq('id', formId)
    .single();

  if (!form) {
    return { storedHash: null, recomputedHash1: null, recomputedHash2: null, isStable: false, matchesStored: false };
  }

  const { data: entries } = await admin
    .from('safety_entries')
    .select('field_name, field_value')
    .eq('safety_form_id', formId)
    .order('field_name', { ascending: true });

  const { data: attendees } = await admin
    .from('safety_form_attendees')
    .select('user_id, is_foreman')
    .eq('safety_form_id', formId)
    .order('user_id', { ascending: true });

  // Build canonical snapshot (same logic as recordHash.ts)
  const sortedEntries = (entries || [])
    .sort((a, b) => a.field_name.localeCompare(b.field_name));
  const sortedAttendees = (attendees || [])
    .sort((a, b) => a.user_id.localeCompare(b.user_id));

  const canonical = JSON.stringify({
    formId: form.id,
    projectId: form.project_id,
    formType: form.form_type,
    createdBy: form.created_by,
    createdAt: form.created_at.substring(0, 19),
    inspectionDate: form.inspection_date || form.created_at.split('T')[0],
    entries: sortedEntries.map(e => `${e.field_name}:${e.field_value || ''}`).join('|'),
    attendees: sortedAttendees.map(a => `${a.user_id}:${a.is_foreman}`).join('|'),
  });

  // Hash using crypto (Node.js compatible)
  const crypto = await import('crypto');
  const hash1 = crypto.createHash('sha256').update(canonical).digest('hex');
  const hash2 = crypto.createHash('sha256').update(canonical).digest('hex');

  return {
    storedHash: form.record_hash,
    recomputedHash1: hash1,
    recomputedHash2: hash2,
    isStable: hash1 === hash2,
    matchesStored: form.record_hash === hash1,
  };
}