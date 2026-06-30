"use client";

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const source =
      typeof data.source === "string" ? ` (${data.source})` : "";
    const upstreamStatus =
      typeof data.upstreamStatus === "number" ? ` upstream=${data.upstreamStatus}` : "";
    throw new Error(`${data.error ?? "Request failed"}${source}${upstreamStatus}`);
  }

  return data as T;
}
