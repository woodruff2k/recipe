import type { AuthResponse, Recipe, RecipeInput } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "recipe.token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(options.headers);

  // Don't force JSON content-type for FormData (browser sets the boundary).
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (err) {
    // Network-level failure (server down, CORS, offline).
    throw new ApiError(0, "네트워크 오류가 발생했습니다. 서버 상태를 확인하세요.", err);
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `요청 실패 (HTTP ${res.status})`;
    throw new ApiError(res.status, message, (data as { details?: unknown })?.details);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: { email: string; password: string; name: string }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<{ user: AuthResponse["user"] }>("/api/auth/me"),

  updateMe: (body: { name?: string; email?: string }) =>
    request<{ user: AuthResponse["user"] }>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Recipes
  listRecipes: (params?: { q?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set("q", params.q);
    if (params?.page) sp.set("page", String(params.page));
    const qs = sp.toString();
    return request<{
      recipes: Recipe[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/recipes${qs ? `?${qs}` : ""}`);
  },
  listMyRecipes: () => request<{ recipes: Recipe[] }>("/api/recipes/mine"),
  getRecipe: (id: string) => request<{ recipe: Recipe }>(`/api/recipes/${id}`),
  createRecipe: (body: RecipeInput) =>
    request<{ recipe: Recipe }>("/api/recipes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRecipe: (id: string, body: RecipeInput) =>
    request<{ recipe: Recipe }>(`/api/recipes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteRecipe: (id: string) => request<void>(`/api/recipes/${id}`, { method: "DELETE" }),

  // Uploads
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<{ key: string; url: string }>("/api/uploads/image", {
      method: "POST",
      body: form,
    });
  },
};
