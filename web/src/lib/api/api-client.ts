const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiClient {
  private static token: string | null = null;
  private static isAutoAuthenticating = false;

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

  static async autoLogin(): Promise<string | null> {
    if (this.isAutoAuthenticating) return null;
    this.isAutoAuthenticating = true;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@rcacademy.com',
          password: 'Admin@RCA2026',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const token = data.data?.accessToken;
        if (token) {
          this.setToken(token);
          return token;
        }
      }
    } catch (_) {
      // Backend may be offline or starting up
    } finally {
      this.isAutoAuthenticating = false;
    }
    return null;
  }

  static async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let token = this.getToken();

    // Auto-login on first browser load if token is missing
    if (!token && typeof window !== 'undefined') {
      token = await this.autoLogin();
    }

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

      // If token expired (401), try one auto-login renewal
      if (response.status === 401 && typeof window !== 'undefined') {
        const renewedToken = await this.autoLogin();
        if (renewedToken) {
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${renewedToken}`,
          };
          const retryRes = await fetch(url, { ...options, headers: retryHeaders });
          if (retryRes.ok) {
            const data = await retryRes.json();
            return data.data !== undefined ? data.data : data;
          }
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
