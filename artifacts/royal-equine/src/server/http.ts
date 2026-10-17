import {
  AUTH_COOKIE_NAME,
  AuthConfigurationError,
  createSessionToken,
  connectMongo,
  isAdminEmail,
  isSessionTokenError,
  logSafeError,
  MongoConfigurationError,
  readSessionToken,
  SESSION_MAX_AGE,
  sessionClearCookieOptions,
  sessionCookieOptions,
  UserModel,
} from "@workspace/royal-equine-server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RoyalUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

type AuthSuccess = { user: RoyalUser };
type AuthFailure = { response: NextResponse };
export type AuthResult = AuthSuccess | AuthFailure;

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function requireRoyalUser(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return { response: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) };
  }

  try {
    const payload = readSessionToken(token);
    await connectMongo();
    const user = await UserModel.findById(payload.sub).select("_id name email").lean();
    if (!user) {
      return {
        response: clearSessionCookie(
          NextResponse.json(
            { error: "Your session is no longer valid. Please sign in again." },
            { status: 401 },
          ),
        ),
      };
    }

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        isAdmin: isAdminEmail(user.email),
      },
    };
  } catch (error) {
    if (error instanceof AuthConfigurationError || error instanceof MongoConfigurationError) {
      return {
        response: NextResponse.json(
          { error: "Account services are not configured yet." },
          { status: 503 },
        ),
      };
    }
    if (isSessionTokenError(error)) {
      return {
        response: clearSessionCookie(
          NextResponse.json(
            { error: "Your session has expired. Please sign in again." },
            { status: 401 },
          ),
        ),
      };
    }

    logSafeError(error, "Account lookup failed");
    return {
      response: NextResponse.json(
        { error: "Account services are temporarily unavailable." },
        { status: 503 },
      ),
    };
  }
}

export async function requireRoyalAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireRoyalUser(request);
  if ("response" in auth) return auth;

  if (!process.env.ADMIN_EMAIL?.trim()) {
    return {
      response: NextResponse.json(
        { error: "Admin access is not configured yet." },
        { status: 503 },
      ),
    };
  }
  if (!isAdminEmail(auth.user.email)) {
    return {
      response: NextResponse.json({ error: "Admin access is required." }, { status: 403 }),
    };
  }

  return auth;
}

export function attachSessionCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(userId), {
    ...sessionCookieOptions(),
    maxAge: Math.floor(SESSION_MAX_AGE / 1000),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...sessionClearCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function serviceUnavailable(
  error: unknown,
  logMessage: string,
  publicMessage: string,
  configuredMessage = publicMessage,
): NextResponse {
  if (error instanceof AuthConfigurationError || error instanceof MongoConfigurationError) {
    return NextResponse.json({ error: configuredMessage }, { status: 503 });
  }
  logSafeError(error, logMessage);
  return NextResponse.json({ error: publicMessage }, { status: 503 });
}

export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}
