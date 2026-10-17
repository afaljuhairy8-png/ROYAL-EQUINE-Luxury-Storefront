import { LogOutResponse } from "@workspace/api-zod";
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/http";

export const runtime = "nodejs";

export function POST() {
  return clearSessionCookie(
    NextResponse.json(LogOutResponse.parse({ success: true })),
  );
}
