import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SAVE_GARD_HTTP_BASE_URL } from "@/config/saveGard";
import { apiError, handleRouteError } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request:NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const adminSession = cookieStore.get("admin_session")?.value;
    if (!adminSession) return apiError(401, "Unauthorized");

    const body = await _request.text();
    const contentType = _request.headers.get("content-type") ?? "application/json";
    const upstreamResponse = await fetch(
      `${SAVE_GARD_HTTP_BASE_URL}/api/children/${id}/live-screen/request`,
      {
        method: _request.method,
        headers: {
          "Content-Type": contentType,
          Cookie: `admin_session=${encodeURIComponent(adminSession)}`
        },
        body: body.length > 0 ? body : undefined,
        cache: "no-store"
      }
    ); 

    const data = await upstreamResponse.json().catch(() => ({}));
    const headers = {
      "X-SaveGard-Proxy": "live-screen-request",
      "X-SaveGard-Upstream-Status": String(upstreamResponse.status)
    };

    console.info("[live-screen-proxy] upstream response", {
      childId: id,
      status: upstreamResponse.status,
      ok: upstreamResponse.ok
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          error: typeof data.error === "string" ? data.error : "Unable to request live screen",
          source: "external_backend",
          upstreamStatus: upstreamResponse.status
        },
        { status: upstreamResponse.status, headers }
      );
    }

    return NextResponse.json(data, { status: upstreamResponse.status, headers });
  } catch (error) {
    return handleRouteError(error);
  }
}
