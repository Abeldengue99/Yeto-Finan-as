const DB_NAME = 'yeto-offline-v1';
const DB_VERSION = 1;
const STORE_NAME = 'offline_store';
const SNAPSHOT_PREFIX = 'finance-snapshot:';
const QUEUE_PREFIX = 'sync-queue:';
const DEVICE_ID_KEY = 'yeto-offline-device-id';
const SYNC_HISTORY_PREFIX = 'sync-history:';

let dbPromise = null;

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function idbGet(key) {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ key, value });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

function localGet(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function localSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

async function storageGet(key) {
  try {
    return await idbGet(key);
  } catch (error) {
    return localGet(key);
  }
}

async function storageSet(key, value) {
  try {
    return await idbSet(key, value);
  } catch (error) {
    return localSet(key, value);
  }
}

function userKey(prefix, userId) {
  return `${prefix}${userId}`;
}

export function getBrowserOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function isOfflineError(error) {
  if (!getBrowserOnlineStatus()) return true;

  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('servidor do yeto') ||
    message.includes('conexao') ||
    message.includes('conexão')
  );
}

export function makeOfflineId(prefix = 'item') {
  return `offline_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getOfflineDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const cryptoId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : makeOfflineId('device');
    const deviceId = `device_${cryptoId}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch (error) {
    return makeOfflineId('device');
  }
}

export async function saveFinanceSnapshot(userId, snapshot) {
  if (!userId) return false;
  return storageSet(userKey(SNAPSHOT_PREFIX, userId), {
    ...snapshot,
    savedAt: new Date().toISOString()
  });
}

export async function loadFinanceSnapshot(userId) {
  if (!userId) return null;
  return storageGet(userKey(SNAPSHOT_PREFIX, userId));
}

export async function getOfflineQueue(userId) {
  if (!userId) return [];
  const queue = await storageGet(userKey(QUEUE_PREFIX, userId));
  return Array.isArray(queue) ? queue : [];
}

export async function replaceOfflineQueue(userId, queue) {
  if (!userId) return false;
  return storageSet(userKey(QUEUE_PREFIX, userId), Array.isArray(queue) ? queue : []);
}

export async function removeOfflineOperations(userId, shouldRemove) {
  if (!userId || typeof shouldRemove !== 'function') return 0;

  const queue = await getOfflineQueue(userId);
  const nextQueue = queue.filter(operation => !shouldRemove(operation));
  await replaceOfflineQueue(userId, nextQueue);
  return queue.length - nextQueue.length;
}

export async function enqueueOfflineOperation(userId, operation) {
  if (!userId) return null;

  const queue = await getOfflineQueue(userId);
  const queuedOperation = {
    id: operation.id || makeOfflineId('operation'),
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...operation
  };

  await replaceOfflineQueue(userId, [...queue, queuedOperation]);
  return queuedOperation;
}

export async function getOfflineQueueCount(userId) {
  const queue = await getOfflineQueue(userId);
  return queue.length;
}

export async function getSyncHistory(userId) {
  if (!userId) return [];
  const history = await storageGet(userKey(SYNC_HISTORY_PREFIX, userId));
  return Array.isArray(history) ? history : [];
}

export async function addSyncHistory(userId, entry) {
  if (!userId) return [];

  const history = await getSyncHistory(userId);
  const nextHistory = [
    {
      id: makeOfflineId('sync_event'),
      createdAt: new Date().toISOString(),
      ...entry
    },
    ...history
  ].slice(0, 30);

  await storageSet(userKey(SYNC_HISTORY_PREFIX, userId), nextHistory);
  return nextHistory;
}
