import React, { lazy, ComponentType } from 'react';

/**
 * Utility to wrap lazy imports with a retry mechanism.
 * Helps with "Failed to fetch dynamically imported module" errors
 * usually caused by network hiccups or new deployments (stale bundles).
 */
export function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retriesLeft = 2,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      if (retriesLeft <= 0) {
        console.error('Lazy load failed after retries:', error);
        throw error;
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(safeLazy(factory, retriesLeft - 1, interval * 2));
        }, interval);
      }) as Promise<{ default: T }>;
    })
  );
}
