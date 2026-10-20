const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiClient {
  private static token: string | null = null;

  static setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('rca_token', token);
        sessionStorage.setItem('rca_token', token);
      } catch (_) {}
    }
  }

  static getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('rca_token') || sessionStorage.getItem('rca_token');
        if (stored) {
          this.token = stored;
          return stored;
        }
      } catch (_) {}
    }
    return null;
  }

  static clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('rca_token');
        sessionStorage.removeItem('rca_token');
      } catch (_) {}
    }
  }

  static async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // On a 401 from a protected authenticated request, clear the invalid session
      // and redirect to /login without creating redirect loops.
      // Do not globally redirect on an invalid password submitted to /auth/login.
      // Do not treat a 403 Forbidden response as an expired login session.
      const isAuthLoginEndpoint = endpoint.includes('/auth/login');
      if (response.status === 401 && !isAuthLoginEndpoint) {
        this.clearToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let msg = data.message;
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          msg = data.message ? `${data.message}: ${data.errors.join(', ')}` : data.errors.join(', ');
        }
        throw new Error(msg || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data.data !== undefined ? data.data : data;
    } catch (err) {
      throw err;
    }
  }
}
