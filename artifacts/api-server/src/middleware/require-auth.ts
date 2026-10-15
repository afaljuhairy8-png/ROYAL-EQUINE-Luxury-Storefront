import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { AuthConfigurationError, AUTH_COOKIE_NAME, readSessionToken, sessionClearCookieOptions } from "../lib/auth.js";
import { connectMongo, MongoConfigurationError } from "../lib/mongodb.js";
import { UserModel } from "../models/User.js";
import { isAdminEmail } from "../lib/admin.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }

  try {
    const payload = readSessionToken(token);
    await connectMongo();
    const user = await UserModel.findById(payload.sub).select("_id name email").lean();
    if (!user) {
      res.clearCookie(AUTH_COOKIE_NAME, sessionClearCookieOptions());
      res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
      return;
    }
    req.royalUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: isAdminEmail(user.email),
    };
    next();
  } catch (error) {
    if (error instanceof AuthConfigurationError || error instanceof MongoConfigurationError) {
      res.status(503).json({ error: "Account services are not configured yet." });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.clearCookie(AUTH_COOKIE_NAME, sessionClearCookieOptions());
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    req.log.error({ name: error instanceof Error ? error.name : "UnknownError" }, "Account lookup failed");
    res.status(503).json({ error: "Account services are temporarily unavailable." });
  }
};
