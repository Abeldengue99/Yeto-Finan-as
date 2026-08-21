const configuredApiUrl = import.meta.env?.VITE_API_URL?.trim();

function getDefaultApiUrl() {
  if (typeof window === 'undefined') return '';

  const { protocol, hostname } = window.location;
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  if (localHosts.has(hostname)) {
    return 'http://localhost:5000';
  }

  return '';
}

function normalizeApiBaseUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === '/' || normalized === 'same-origin' || normalized === 'self') return '';
  return normalized.replace(/\/+$/, '');
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiUrl || getDefaultApiUrl());
export const API_OFFLINE_MESSAGE = 'Servidor temporariamente indisponível. Tente novamente em alguns segundos.';

export function getStoredUser() {
  try {
    const savedUser = localStorage.getItem('yeto_user');
    return savedUser ? JSON.parse(savedUser) : null;
  } catch (error) {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem('yeto_token') || getStoredUser()?.token || '';
}

export function saveSession(userData) {
  localStorage.setItem('yeto_user', JSON.stringify(userData));
  localStorage.setItem('yeto_session_time', String(Date.now()));

  if (userData?.token) {
    localStorage.setItem('yeto_token', userData.token);
  }
}

export function clearSession() {
  localStorage.removeItem('yeto_user');
  localStorage.removeItem('yeto_token');
  localStorage.removeItem('yeto_session_time');
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = API_BASE_URL.endsWith('/api') && path.startsWith('/api/')
    ? path.slice(4)
    : path;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${normalizedPath}`;
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
      break;
    } catch (error) {
      if (attempt === 2) {
        throw new Error(API_OFFLINE_MESSAGE);
      }

      await wait(350 * (attempt + 1));
    }
  }

  if (response.status === 401) {
    clearSession();
  }

  return response;
}

export async function readJsonResponse(response, fallbackMessage = 'Resposta inesperada do servidor.') {
  const contentType = response.headers.get('Content-Type') || '';

  if (!contentType.includes('application/json')) {
    await response.text().catch(() => '');
    throw new Error(
      response.status === 404
        ? 'Esta funcionalidade ainda não está ativa no servidor. Reinicie o backend e tente novamente.'
        : fallbackMessage
    );
  }

  return response.json();
}
