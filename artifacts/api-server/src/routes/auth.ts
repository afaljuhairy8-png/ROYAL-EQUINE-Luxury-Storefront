import { Router } from "express";
import { hashPassword, verifyPassword } from "@workspace/royal-equine-server";
import { AuthConfigurationError, AUTH_COOKIE_NAME, createSessionToken, getJwtSecret, sessionClearCookieOptions, sessionCookieOptions } from "../lib/auth.js";
import { connectMongo, MongoConfigurationError } from "../lib/mongodb.js";
import { UserModel } from "../models/User.js";
import { requireAuth } from "../middleware/require-auth.js";
import { isAdminEmail } from "../lib/admin.js";
import { LogInBody, LogInResponse, LogOutResponse, GetCurrentUserResponse, SignUpBody, SignUpResponse } from "@workspace/api-zod";

const router = Router();

function duplicateEmail(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

function unavailable(error: unknown, label: string, req: Parameters<Parameters<typeof router.post>[1]>[0], res: Parameters<Parameters<typeof router.post>[1]>[1]): void {
  if (error instanceof AuthConfigurationError) {
    res.status(503).json({ error: "Account services are not configured yet." });
    return;
  }
  if (error instanceof MongoConfigurationError) {
    res.status(503).json({ error: "Account services are not configured yet." });
    return;
  }
  req.log.error(
    { name: error instanceof Error ? error.name : "UnknownError" },
    label,
  );
  res.status(503).json({ error: "Account services are temporarily unavailable." });
}

router.post("/auth/sign-up", async (req, res) => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid name, email, and password of at least 8 characters." });
    return;
  }

  const name = parsed.data.name.trim();
  if (name.length < 2) {
    res.status(400).json({ error: "Enter your full name." });
    return;
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
    res.cookie(AUTH_COOKIE_NAME, createSessionToken(user._id.toString()), sessionCookieOptions());
    res.status(201).json(payload);
  } catch (error) {
    if (duplicateEmail(error)) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    unavailable(error, "Account registration failed", req, res);
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LogInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  try {
    getJwtSecret();
    await connectMongo();
    const email = parsed.data.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    const payload = LogInResponse.parse({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: isAdminEmail(user.email),
    });
    res.cookie(AUTH_COOKIE_NAME, createSessionToken(user._id.toString()), sessionCookieOptions());
    res.status(200).json(payload);
  } catch (error) {
    unavailable(error, "Account sign-in failed", req, res);
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  if (!req.royalUser) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }
  res.status(200).json(GetCurrentUserResponse.parse(req.royalUser));
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, sessionClearCookieOptions());
  res.status(200).json(LogOutResponse.parse({ success: true }));
});

export default router;
