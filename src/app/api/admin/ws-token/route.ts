import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenFromRequest, isAuthenticatedRequest } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  if (!(await isAuthenticatedRequest(request))) {
    return apiError(401, "Unauthorized");
  }

  const token = getSessionTokenFromRequest(request);
  if (!token) return apiError(401, "Unauthorized");

  return NextResponse.json({ token });
}
