/**
 * UI Smoke runner engine.
 * Provides a stable, deterministic list of routes to test and a runner
 * that navigates each route via React Router, capturing results.
 */
import { NAV_ROUTE_LISTS, ROUTE_WRAPPER_MAP } from '@/lib/routeInventory';
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

  // Filter out parameterised routes and public/auth routes
  const filtered = [...combined].filter(path => {
    if (path.includes(':')) return false;
    const wrappers = ROUTE_WRAPPER_MAP[path];
    if (!wrappers) return false;
    if (wrappers.includes('public')) return false;
    if (wrappers.length === 0) return false; // auth/accept-invite
    return true;
  });

  return filtered.sort();
}

// ── Runner types ───────────────────────────────────────────────────────────

export interface RouteResult {
  path: string;
  status: 'pass' | 'fail' | 'redirect';
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
}

// ── Runner ─────────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait until pathname matches target OR timeout. Returns actual pathname.
 */
async function waitForNavigation(
  getPathname: GetPathnameFn,
  targetPath: string,
  timeoutMs: number,
): Promise<{ finalPathname: string; timedOut: boolean }> {
  const start = Date.now();
  // Give React Router a tick to start transition
  await wait(100);

  while (Date.now() - start < timeoutMs) {
    const current = getPathname();
    // Consider navigation complete if we're on the target path
    // OR if we've been redirected (pathname differs from target)
    if (current === targetPath) {
      // Wait a bit more for renders to settle
      await wait(500);
      return { finalPathname: getPathname(), timedOut: false };
    }
    // If redirected, capture final location
    if (current !== targetPath && Date.now() - start > 800) {
      await wait(300);
      return { finalPathname: getPathname(), timedOut: false };
    }
    await wait(200);
  }

  return { finalPathname: getPathname(), timedOut: true };
}

/**
 * Run the smoke test across all routes sequentially.
 */
export async function runSmokeTest(options: RunnerOptions): Promise<RouteResult[]> {
  const { navigate, getPathname, timeoutMs = 3000, onProgress, runProbes } = options;
  const routes = getSmokeRoutes();
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
      const nav = await waitForNavigation(getPathname, path, timeoutMs);
      finalPathname = nav.finalPathname;

      if (finalPathname !== path) {
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
      durationMs,
      finalPathname,
      errorMessage,
      consoleLogs,
      probeResults,
    };

    results.push(result);
    onProgress?.(i + 1, routes.length, result);
  }

  return results;
}

/**
 * Format results as a plain text report.
 */
export function formatReport(results: RouteResult[]): string {
  const lines: string[] = [];
  const date = new Date().toISOString();
  lines.push(`UI Smoke Test Report — ${date}`);
  lines.push('='.repeat(60));
  lines.push('');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const redirected = results.filter(r => r.status === 'redirect').length;
  lines.push(`Total: ${results.length} | Pass: ${passed} | Fail: ${failed} | Redirect: ${redirected}`);
  lines.push('');

  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '→';
    lines.push(`${icon} ${r.path} [${r.status}] ${r.durationMs}ms`);
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
