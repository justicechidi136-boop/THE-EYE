export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

import { resolveServerApiBaseUrl } from "../public-env";

export function resolveApiBaseUrl() {
  return resolveServerApiBaseUrl();
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { token?: string; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `API ${response.status} for ${path}`;
    throw new ApiError(message, response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
