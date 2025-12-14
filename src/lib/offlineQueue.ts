/**
 * Offline Time Tracking Queue
 * 
 * Provides true offline support for time tracking actions.
 * Uses IndexedDB with localStorage fallback.
 * 
 * Rules:
 * - One outstanding queued action per user per project for time tracking
 * - FIFO replay order
 * - Exponential backoff retry (5s, 15s, 60s, 5m)
 * - Idempotency key per action prevents duplicates
 */

const DB_NAME = 'horizon_time_queue';
const DB_VERSION = 1;
const STORE_NAME = 'queued_actions';
const FALLBACK_KEY = 'horizon_time_queue_fallback_v1';

export type ActionType = 'check_in' | 'check_out';

export interface QueuedTimeAction {
  id: string;
  createdAt: string;
  actionType: ActionType;
  projectId: string;
  jobSiteId: string | null;
  payload: {
    latitude?: number;
    longitude?: number;
    accuracy_meters?: number;
    location_source?: string;
    notes?: string;
  };
  idempotencyKey: string;
  /**
   * Flags to request the server apply on replay.
   * Only safe subset allowed: offline_replayed, location_unverified, gps_accuracy_low
   */
  pendingFlags: string[];
  status: 'queued' | 'replaying' | 'succeeded' | 'failed';
  lastError?: string;
  retryCount: number;
  nextRetryAt?: string;
}

// Allowed flags that can be requested from client
const ALLOWED_CLIENT_FLAGS = ['offline_replayed', 'location_unverified', 'gps_accuracy_low'];

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// IndexedDB helpers
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_project', 'projectId', { unique: false });
        store.createIndex('by_created', 'createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

async function useIndexedDB(): Promise<boolean> {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}

// LocalStorage fallback helpers
function loadFromLocalStorage(): QueuedTimeAction[] {
  try {
    const stored = localStorage.getItem(FALLBACK_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(actions: QueuedTimeAction[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(actions));
  } catch (e) {
    console.error('Failed to save offline queue to localStorage:', e);
  }
}

/**
 * OfflineQueue class - manages the offline action queue
 */
export class OfflineQueue {
  private useIDB: boolean | null = null;

  private async init(): Promise<void> {
    if (this.useIDB === null) {
      this.useIDB = await useIndexedDB();
    }
  }

  async getAll(): Promise<QueuedTimeAction[]> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const actions = request.result as QueuedTimeAction[];
          // Sort by createdAt (FIFO)
          resolve(actions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
        };
        request.onerror = () => reject(request.error);
      });
    }

    return loadFromLocalStorage();
  }

  async get(id: string): Promise<QueuedTimeAction | null> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }

    const actions = loadFromLocalStorage();
    return actions.find((a) => a.id === id) || null;
  }

  async add(action: QueuedTimeAction): Promise<void> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    const actions = loadFromLocalStorage();
    actions.push(action);
    saveToLocalStorage(actions);
  }

  async update(action: QueuedTimeAction): Promise<void> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    const actions = loadFromLocalStorage();
    const index = actions.findIndex((a) => a.id === action.id);
    if (index >= 0) {
      actions[index] = action;
      saveToLocalStorage(actions);
    }
  }

  async remove(id: string): Promise<void> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    const actions = loadFromLocalStorage();
    saveToLocalStorage(actions.filter((a) => a.id !== id));
  }

  async clear(): Promise<void> {
    await this.init();

    if (this.useIDB) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    localStorage.removeItem(FALLBACK_KEY);
  }

  async getPending(): Promise<QueuedTimeAction[]> {
    const all = await this.getAll();
    return all.filter((a) => a.status === 'queued' || a.status === 'failed');
  }

  async hasPendingForProject(projectId: string): Promise<boolean> {
    const pending = await this.getPending();
    return pending.some((a) => a.projectId === projectId);
  }

  async getConflictingAction(projectId: string, actionType: ActionType): Promise<QueuedTimeAction | null> {
    const pending = await this.getPending();
    // For time tracking, only one outstanding action per project
    return pending.find((a) => a.projectId === projectId) || null;
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

/**
 * Create a check-in action to be queued
 */
export function createCheckInAction(
  projectId: string,
  jobSiteId: string | null,
  location: { lat?: number; lng?: number; accuracy?: number } | null,
  notes?: string
): QueuedTimeAction {
  const pendingFlags: string[] = ['offline_replayed'];

  // If location is missing, add flag
  if (!location || location.lat === undefined || location.lng === undefined) {
    pendingFlags.push('location_unverified');
  } else if (location.accuracy && location.accuracy > 100) {
    pendingFlags.push('gps_accuracy_low');
  }

  // Filter to only allowed flags
  const safeFlags = pendingFlags.filter((f) => ALLOWED_CLIENT_FLAGS.includes(f));

  return {
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    actionType: 'check_in',
    projectId,
    jobSiteId,
    payload: {
      latitude: location?.lat,
      longitude: location?.lng,
      accuracy_meters: location?.accuracy,
      notes,
    },
    idempotencyKey: generateUUID(),
    pendingFlags: safeFlags,
    status: 'queued',
    retryCount: 0,
  };
}

/**
 * Create a check-out action to be queued
 */
export function createCheckOutAction(
  projectId: string,
  location: { lat?: number; lng?: number; accuracy?: number } | null
): QueuedTimeAction {
  const pendingFlags: string[] = ['offline_replayed'];

  if (!location || location.lat === undefined || location.lng === undefined) {
    pendingFlags.push('location_unverified');
  } else if (location.accuracy && location.accuracy > 100) {
    pendingFlags.push('gps_accuracy_low');
  }

  const safeFlags = pendingFlags.filter((f) => ALLOWED_CLIENT_FLAGS.includes(f));

  return {
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    actionType: 'check_out',
    projectId,
    jobSiteId: null,
    payload: {
      latitude: location?.lat,
      longitude: location?.lng,
      accuracy_meters: location?.accuracy,
    },
    idempotencyKey: generateUUID(),
    pendingFlags: safeFlags,
    status: 'queued',
    retryCount: 0,
  };
}

/**
 * Calculate next retry time with exponential backoff
 */
export function calculateNextRetry(retryCount: number): Date {
  // Backoff: 5s, 15s, 60s, 5m, 15m, then cap at 15m
  const delays = [5000, 15000, 60000, 300000, 900000];
  const delay = delays[Math.min(retryCount, delays.length - 1)];
  return new Date(Date.now() + delay);
}
