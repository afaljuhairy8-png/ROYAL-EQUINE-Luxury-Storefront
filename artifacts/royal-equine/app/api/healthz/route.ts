import { HealthCheckResponse } from "@workspace/api-zod";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(HealthCheckResponse.parse({ status: "ok" }));
}
