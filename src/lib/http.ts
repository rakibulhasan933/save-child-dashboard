import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request body", issues: error.flatten() }, { status: 400 });
  }

  console.error(error);
  return apiError(500, "Internal server error");
}

export function buildCorsHeaders(request: Request): Record<string, string> {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin =
    process.env.NODE_ENV !== "production" ? requestOrigin || "*" : getProductionAllowedOrigin(requestOrigin);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

function getProductionAllowedOrigin(requestOrigin: string | null) {
  if (!requestOrigin) return null;

  const allowedOrigins = [
    process.env.SAVE_GARD_ADMIN_ORIGIN,
    process.env.NEXT_PUBLIC_SAVE_GARD_ADMIN_ORIGIN,
    ...(process.env.SAVE_GARD_ADMIN_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...(process.env.NEXT_PUBLIC_SAVE_GARD_ADMIN_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ].filter(Boolean);

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}
