/**
 * Console capture utility for UI smoke tests.
 * Intercepts console.error and console.warn, restores originals on stop.
 */

export interface CapturedLog {
  level: 'error' | 'warn';
  message: string;
  ts: number;
}

export interface ConsoleCapture {
  stop: () => CapturedLog[];
  getLogs: () => CapturedLog[];
}

export function startConsoleCapture(): ConsoleCapture {
  const logs: CapturedLog[] = [];
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    logs.push({
      level: 'error',
      message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      ts: Date.now(),
    });
    originalError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    logs.push({
      level: 'warn',
      message: args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      ts: Date.now(),
    });
    originalWarn.apply(console, args);
  };

  const stop = (): CapturedLog[] => {
    console.error = originalError;
    console.warn = originalWarn;
    return [...logs];
  };

  const getLogs = (): CapturedLog[] => [...logs];

  return { stop, getLogs };
}
