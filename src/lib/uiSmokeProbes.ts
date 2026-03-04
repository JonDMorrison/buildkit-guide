/**
 * Safe button probes for the UI smoke runner.
 * Each probe clicks a non-destructive UI element and verifies no throw.
 * Returns results per probe; skips if selector not found.
 */
import type { ProbeResult } from '@/lib/uiSmokeRunner';

interface ProbeDefinition {
  route: string;
  name: string;
  /** CSS selector to find the element */
  selector: string;
  /** Action: 'click' (default) */
  action?: 'click';
}

/**
 * Registry of safe button probes.
 * Rules:
 * - No destructive actions (delete, import, submit forms)
 * - Click-only on toggles, tabs, copy buttons
 * - Selectors must match real DOM elements
 */
const PROBE_REGISTRY: ProbeDefinition[] = [
  // Dashboard — ops tab switching (Site Status / Project Health / Planning)
  {
    route: '/dashboard',
    name: 'dashboard-ops-tab-1',
    selector: '[role="tablist"] [role="tab"]:nth-child(2)',
  },
  {
    route: '/dashboard',
    name: 'dashboard-ops-tab-2',
    selector: '[role="tablist"] [role="tab"]:nth-child(3)',
  },
  // Dashboard — View Full Report button
  {
    route: '/dashboard',
    name: 'dashboard-full-report',
    selector: 'a[href="/executive-report"], button:contains("Full Report")',
  },
  // Executive Dashboard — toggle Simple/Detailed view
  {
    route: '/executive',
    name: 'executive-view-toggle',
    selector: '[data-testid="view-toggle"], button:has(svg.lucide-list), button:has(svg.lucide-layout-grid)',
  },
  // Executive — Copy Summary button
  {
    route: '/executive',
    name: 'executive-copy-summary',
    selector: 'button:contains("Copy Summary"), button:contains("Copied")',
  },
  // Insights — expand/collapse section
  {
    route: '/insights',
    name: 'insights-collapsible',
    selector: '[data-state="closed"] button, [role="button"][aria-expanded="false"]',
  },
  // Tasks — view mode toggle (list/kanban/calendar)
  {
    route: '/tasks',
    name: 'tasks-view-toggle',
    selector: 'button:has(svg.lucide-layout-grid)',
  },
  // Project drilldown — click first project link
  {
    route: '/projects',
    name: 'project-drilldown',
    selector: '[data-project-id], a[href*="/projects/"]',
  },
  // Safety — New Inspection button (check existence)
  {
    route: '/safety',
    name: 'safety-new-button',
    selector: 'button:contains("New Inspection"), button:has(svg.lucide-plus)',
  },
  // Intelligence — Ask AI input
  {
    route: '/intelligence',
    name: 'ai-input-focus',
    selector: 'textarea[placeholder*="Ask AI"], input[placeholder*="Ask AI"]',
    action: 'click',
  },
];

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run safe probes for a given route path.
 * Returns results for each matching probe.
 */
export async function runProbesForRoute(path: string): Promise<ProbeResult[]> {
  const probes = PROBE_REGISTRY.filter(p => p.route === path);
  if (probes.length === 0) return [];

  const results: ProbeResult[] = [];

  for (const probe of probes) {
    try {
      const el = document.querySelector<HTMLElement>(probe.selector);
      if (!el) {
        results.push({ name: probe.name, status: 'skip', error: 'selector not found' });
        continue;
      }

      // Special handling for project drilldown probe
      if (probe.name === 'project-drilldown') {
        // Just verify the element exists and is clickable, don't actually navigate
        const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href');
        if (href && href.includes('/projects/')) {
          results.push({ name: probe.name, status: 'pass', error: `found: ${href}` });
        } else {
          results.push({ name: probe.name, status: 'skip', error: 'no project href found' });
        }
        continue;
      }

      el.click();
      await wait(300); // let React re-render

      results.push({ name: probe.name, status: 'pass' });
    } catch (e: any) {
      results.push({ name: probe.name, status: 'fail', error: e.message });
    }
  }

  return results;
}
