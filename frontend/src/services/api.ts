import type { AuthResponse, Email, ScheduleRequest } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Custom wrapper around fetch to automatically include credentials and handle JSON.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include", // Ensure session cookies are sent
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.error) errMsg = data.error;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

export const apiService = {
  /**
   * Verify session authenticity and retrieve identity.
   */
  async checkAuth(): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/me");
  },

  /**
   * Login using email ID and password.
   */
  async login(email: string, password: string): Promise<{ success: boolean; user: any }> {
    return request<{ success: boolean; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Terminate user session.
   */
  async logout(): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/logout", { method: "POST" });
  },

  /**
   * Fetch currently scheduled emails.
   */
  async getScheduledEmails(): Promise<{ success: boolean; emails: Email[] }> {
    return request<{ success: boolean; emails: Email[] }>("/api/emails/scheduled");
  },

  /**
   * Fetch sent/failed email history.
   */
  async getSentEmails(): Promise<{ success: boolean; emails: Email[] }> {
    return request<{ success: boolean; emails: Email[] }>("/api/emails/sent");
  },

  /**
   * Dispatch a schedule request to the backend.
   */
  async scheduleEmails(data: ScheduleRequest): Promise<{ success: boolean; emails: Partial<Email>[] }> {
    return request<{ success: boolean; emails: Partial<Email>[] }>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteEmail(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/emails/${id}`, {
      method: "DELETE",
    });
  },

  async updateEmail(id: string, updates: { isStarred?: boolean; isArchived?: boolean }): Promise<{ success: boolean; email: Email }> {
    return request<{ success: boolean; email: Email }>(`/api/emails/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },
};
export default apiService;
