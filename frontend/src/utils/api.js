export const API_BASE_URL = 'http://localhost:5000';

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
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

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
