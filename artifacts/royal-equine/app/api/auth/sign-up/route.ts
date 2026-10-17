import {
  AuthConfigurationError,
  connectMongo,
  getJwtSecret,
  hashPassword,
  isAdminEmail,
  MongoConfigurationError,
  UserModel,
} from "@workspace/royal-equine-server";
import { SignUpBody, SignUpResponse } from "@workspace/api-zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  attachSessionCookie,
  isDuplicateKeyError,
  parseJsonBody,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = SignUpBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, email, and password of at least 8 characters." },
      { status: 400 },
    );
  }

  const name = parsed.data.name.trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }

  try {
    getJwtSecret();
    await connectMongo();
    await UserModel.init();
    const email = parsed.data.email.trim().toLowerCase();
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await UserModel.create({ name, email, passwordHash });
    const payload = SignUpResponse.parse({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: isAdminEmail(user.email),
    });
    return attachSessionCookie(NextResponse.json(payload, { status: 201 }), user._id.toString());
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    return serviceUnavailable(
      error,
      "Account registration failed",
      "Account services are temporarily unavailable.",
      error instanceof AuthConfigurationError || error instanceof MongoConfigurationError
        ? "Account services are not configured yet."
        : "Account services are temporarily unavailable.",
    );
  }
}
