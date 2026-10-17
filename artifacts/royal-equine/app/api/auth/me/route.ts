import { GetCurrentUserResponse } from "@workspace/api-zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRoyalUser } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireRoyalUser(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json(GetCurrentUserResponse.parse(auth.user));
}
