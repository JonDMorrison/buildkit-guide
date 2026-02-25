/**
 * UI Smoke runner engine.
 * Provides a stable, deterministic list of routes to test and a runner
 * that navigates each route via React Router, capturing results.
 */
import { NAV_ROUTE_LISTS, ROUTE_WRAPPER_MAP, getNavRoutesForRole, canAccessRoute, type RoleName } from '@/lib/routeInventory';
import { startConsoleCapture, type CapturedLog } from '@/lib/consoleCapture';

// ── Route list ─────────────────────────────────────────────────────────────

/** Critical deep-link routes that must be tested even if not in nav */
const CRITICAL_DEEP_LINKS = [
  '/dashboard',
  '/executive',
  '/insights',
  '/projects',
  '/tasks',
];

/**
 * Returns a deterministic, sorted, deduplicated list of routes to smoke-test.
 * Combines admin + PM nav routes plus critical deep links.
 * Excludes parameterised routes (e.g. /projects/:projectId) and public/auth routes.
 */
export function getSmokeRoutes(): string[] {
  const adminRoutes = NAV_ROUTE_LISTS.admin;
  const pmRoutes = NAV_ROUTE_LISTS.pm;
  const combined = new Set([...adminRoutes, ...pmRoutes, ...CRITICAL_DEEP_LINKS]);

  const filtered = [...combined].filter(path => {
    if (path.includes(':')) return false;
    const wrappers = ROUTE_WRAPPER_MAP[path];
    if (!wrappers) return false;
    if (wrappers.includes('public')) return false;
    if (wrappers.length === 0) return false;
    return true;
  });

  return filtered.sort();
}

/**
 * Returns routes visible to a given role profile for testing.
 */
export function getSmokeRoutesForRole(role: RoleName): string[] {
  const roleRoutes = getNavRoutesForRole(role);
  const combined = new Set([...roleRoutes, ...CRITICAL_DEEP_LINKS]);

  const filtered = [...combined].filter(path => {
    if (path.includes(':')) return false;
    const wrappers = ROUTE_WRAPPER_MAP[path];
    if (!wrappers) return false;
    if (wrappers.includes('public')) return false;
    if (wrappers.length === 0) return false;
    return true;
  });

  return filtered.sort();
}

// ── Failure classification ────────────────────────────────────────────────

export type Severity = 'BLOCKER' | 'MAJOR' | 'MINOR' | 'INFO';

/**
 * Classify a route result into a severity level.
 */
export function classifyResult(r: RouteResult, testRole?: RoleName): Severity {
  // BLOCKER: console.error, crash, dynamic import failure, blank screen
  if (r.status === 'fail') {
    const hasImportError = r.consoleLogs.some(l =>
      l.level === 'error' && (
        l.message.includes('Failed to fetch dynamically imported module') ||
        l.message.includes('Loading chunk') ||
        l.message.includes('Unexpected token')
      )
    );
    if (hasImportError) return 'BLOCKER';
    if (r.errorMessage) return 'BLOCKER';
    const errorCount = r.consoleLogs.filter(l => l.level === 'error').length;
    if (errorCount > 0) return 'BLOCKER';
    return 'BLOCKER';
  }

  // MAJOR: redirect on a route the role should be able to access
  if (r.status === 'redirect') {
    if (testRole && canAccessRoute(r.path, testRole)) {
      return 'MAJOR';
    }
    // Probe exception
    if (r.probeResults?.some(p => p.status === 'fail')) {
      return 'MAJOR';
    }
    return 'INFO';
  }

  // MINOR: console.warn present
  if (r.consoleLogs.some(l => l.level === 'warn')) return 'MINOR';

  // MINOR: probe skip (missing element)
  if (r.probeResults?.some(p => p.status === 'skip')) return 'MINOR';

  return 'INFO';
}

// ── Runner types ───────────────────────────────────────────────────────────

export interface RouteResult {
  path: string;
  status: 'pass' | 'fail' | 'redirect';
  severity: Severity;
  durationMs: number;
  finalPathname: string;
  errorMessage?: string;
  consoleLogs: CapturedLog[];
  probeResults?: ProbeResult[];
}

export interface ProbeResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  error?: string;
}

export type NavigateFn = (path: string) => void;
export type GetPathnameFn = () => string;
export type OnProgressFn = (completed: number, total: number, current: RouteResult) => void;

export interface RunnerOptions {
  navigate: NavigateFn;
  getPathname: GetPathnameFn;
  timeoutMs?: number;
  onProgress?: OnProgressFn;
  runProbes?: (path: string) => Promise<ProbeResult[]>;
  testRole?: RoleName;
}

// ── Stabilization ─────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for the route to stabilize after navigation.
 * Uses rAF + microtask flush + optional container check.
 * Max wait: 1200ms, deterministic fallback.
 */
async function waitForRouteStable(
  getPathname: GetPathnameFn,
  targetPath: string,
  timeoutMs: number = 1200,
): Promise<{ finalPathname: string; redirected: boolean }> {
  const start = Date.now();

  // 1. Wait for animation frame (DOM commit)
  await waitForAnimationFrame();

  // 2. Small delay for React concurrent renders to flush
  await wait(150);

  // 3. Poll until pathname stabilizes or timeout
  let lastPathname = getPathname();
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    const current = getPathname();

    if (current === lastPathname) {
      stableCount++;
      // Consider stable after 2 consecutive checks (~200ms of no change)
      if (stableCount >= 2) {
        // Final rAF to ensure paint
        await waitForAnimationFrame();
        await wait(100);
        const finalPathname = getPathname();
        return {
          finalPathname,
          redirected: finalPathname !== targetPath,
        };
      }
    } else {
      stableCount = 0;
      lastPathname = current;
    }

    await wait(100);
  }

  // Timeout fallback
  const finalPathname = getPathname();
  return {
    finalPathname,
    redirected: finalPathname !== targetPath,
  };
}

// ── Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the smoke test across all routes sequentially.
 */
export async function runSmokeTest(options: RunnerOptions): Promise<RouteResult[]> {
  const { navigate, getPathname, timeoutMs = 3000, onProgress, runProbes, testRole } = options;
  const routes = testRole ? getSmokeRoutesForRole(testRole) : getSmokeRoutes();
  const results: RouteResult[] = [];

  for (let i = 0; i < routes.length; i++) {
    const path = routes[i];
    const capture = startConsoleCapture();
    const start = Date.now();
    let status: RouteResult['status'] = 'pass';
    let errorMessage: string | undefined;
    let finalPathname = path;
    let probeResults: ProbeResult[] | undefined;

    try {
      navigate(path);
      const nav = await waitForRouteStable(getPathname, path, timeoutMs);
      finalPathname = nav.finalPathname;

      if (nav.redirected) {
        status = 'redirect';
      }

      // Run probes if available and we're on the expected page
      if (runProbes && finalPathname === path) {
        try {
          probeResults = await runProbes(path);
        } catch (e: any) {
          probeResults = [{ name: 'probe-runner', status: 'fail', error: e.message }];
        }
      }
    } catch (e: any) {
      status = 'fail';
      errorMessage = e.message || String(e);
    }

    const consoleLogs = capture.stop();
    const durationMs = Date.now() - start;

    // Check for error-level console logs
    const hasConsoleErrors = consoleLogs.some(l => l.level === 'error');
    if (hasConsoleErrors && status === 'pass') {
      status = 'fail';
      errorMessage = `${consoleLogs.filter(l => l.level === 'error').length} console error(s)`;
    }

    const result: RouteResult = {
      path,
      status,
      severity: 'INFO', // placeholder, classified below
      durationMs,
      finalPathname,
      errorMessage,
      consoleLogs,
      probeResults,
    };

    // Classify severity
    result.severity = classifyResult(result, testRole);

    results.push(result);
    onProgress?.(i + 1, routes.length, result);
  }

  return results;
}

// ── Report formatting ─────────────────────────────────────────────────────

/**
 * Format results as a plain text report with severity classification.
 */
export function formatReport(results: RouteResult[], testRole?: RoleName): string {
  const lines: string[] = [];
  const date = new Date().toISOString();

  const blockers = results.filter(r => r.severity === 'BLOCKER').length;
  const majors = results.filter(r => r.severity === 'MAJOR').length;
  const minors = results.filter(r => r.severity === 'MINOR').length;

  lines.push('UI SMOKE REPORT');
  lines.push(`Date: ${date.slice(0, 10)}`);
  if (testRole) lines.push(`Test Profile: ${testRole}`);
  lines.push('');
  lines.push(`Routes tested: ${results.length}`);
  lines.push(`Blockers: ${blockers}`);
  lines.push(`Major: ${majors}`);
  lines.push(`Minor: ${minors}`);
  lines.push('');
  lines.push('='.repeat(60));

  // Group by severity for failures first
  const failures = results.filter(r => r.severity !== 'INFO');
  if (failures.length > 0) {
    lines.push('');
    lines.push('Failures:');
    lines.push('');
    for (const r of failures) {
      const icon = r.severity === 'BLOCKER' ? '🔴' : r.severity === 'MAJOR' ? '🟠' : '🟡';
      lines.push(`${icon} [${r.severity}] ${r.path}`);
      if (r.finalPathname !== r.path) {
        lines.push(`  → redirected to: ${r.finalPathname}`);
      }
      if (r.errorMessage) {
        lines.push(`  error: ${r.errorMessage}`);
      }
      if (r.consoleLogs.filter(l => l.level === 'error').length > 0) {
        for (const log of r.consoleLogs.filter(l => l.level === 'error').slice(0, 3)) {
          lines.push(`  console.error: ${log.message.slice(0, 200)}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('');
  lines.push('All Results:');
  lines.push('');

  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '→';
    lines.push(`${icon} ${r.path} [${r.status}/${r.severity}] ${r.durationMs}ms`);
    if (r.finalPathname !== r.path) {
      lines.push(`  → redirected to: ${r.finalPathname}`);
    }
    if (r.errorMessage) {
      lines.push(`  error: ${r.errorMessage}`);
    }
    if (r.consoleLogs.length > 0) {
      lines.push(`  console (${r.consoleLogs.length}):`);
      for (const log of r.consoleLogs.slice(0, 5)) {
        lines.push(`    [${log.level}] ${log.message.slice(0, 200)}`);
      }
      if (r.consoleLogs.length > 5) {
        lines.push(`    ... and ${r.consoleLogs.length - 5} more`);
      }
    }
    if (r.probeResults && r.probeResults.length > 0) {
      lines.push(`  probes:`);
      for (const p of r.probeResults) {
        const pIcon = p.status === 'pass' ? '✓' : p.status === 'fail' ? '✗' : '–';
        lines.push(`    ${pIcon} ${p.name}: ${p.status}${p.error ? ` (${p.error})` : ''}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
