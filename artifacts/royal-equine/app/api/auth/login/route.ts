import {
  connectMongo,
  isAdminEmail,
  UserModel,
  verifyPassword,
} from "@workspace/royal-equine-server";
import { LogInBody, LogInResponse } from "@workspace/api-zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  attachSessionCookie,
  parseJsonBody,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = LogInBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  try {
    await connectMongo();
    const email = parsed.data.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }

    const payload = LogInResponse.parse({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: isAdminEmail(user.email),
    });
    return attachSessionCookie(NextResponse.json(payload), user._id.toString());
  } catch (error) {
    return serviceUnavailable(
      error,
      "Account sign-in failed",
      "Account services are temporarily unavailable.",
      "Account services are not configured yet.",
    );
  }
}
