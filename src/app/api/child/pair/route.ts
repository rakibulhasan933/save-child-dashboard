import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { childDevices, children } from "@/db/schema";
import { issueChildToken } from "@/lib/childToken";
import { apiError } from "@/lib/http";

const pairChildSchema = z.object({
  pairingCode: z.string().trim().min(1),
  deviceUuid: z.string().trim().min(1).optional(),
  platform: z.enum(["android", "ios", "web"]).optional(),
  osVersion: z.string().trim().min(1).max(80).optional(),
  appVersion: z.string().trim().min(1).max(80).optional()
});

export async function POST(request: Request) {
  try {
    const parsed = pairChildSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError(400, "Invalid body");
    }

    const body = parsed.data;
    const pairingCode = body.pairingCode.toUpperCase();
    const deviceUuid = body.deviceUuid ?? randomUUID();

    const [child] = await db
      .select()
      .from(children)
      .where(and(eq(children.pairingCode, pairingCode), ne(children.status, "disabled")))
      .limit(1);

    if (!child) {
      return apiError(404, "Invalid pairing code");
    }

    if (child.status === "unpaired") {
      await db
        .update(children)
        .set({ status: "paired", updatedAt: new Date() })
        .where(eq(children.id, child.id));
    }

    await db
      .insert(childDevices)
      .values({
        childId: child.id,
        deviceUuid,
        platform: body.platform ?? "android",
        osVersion: body.osVersion ?? "unknown",
        appVersion: body.appVersion ?? "unknown",
        isActive: true,
        lastOnlineAt: new Date()
      })
      .onConflictDoUpdate({
        target: childDevices.deviceUuid,
        set: {
          childId: child.id,
          platform: body.platform ?? "android",
          osVersion: body.osVersion ?? "unknown",
          appVersion: body.appVersion ?? "unknown",
          isActive: true,
          lastOnlineAt: new Date(),
          updatedAt: new Date()
        }
      });

    const childToken = await issueChildToken(child.id);

    return NextResponse.json(
      {
        childId: child.id,
        childToken,
        deviceUuid
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return apiError(500, "Internal server error");
  }
}
