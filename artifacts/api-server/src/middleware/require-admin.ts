import type { RequestHandler } from "express";
import { isAdminEmail } from "../lib/admin.js";

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!process.env.ADMIN_EMAIL?.trim()) {
    res.status(503).json({ error: "Admin access is not configured yet." });
    return;
  }
  if (!req.royalUser || !isAdminEmail(req.royalUser.email)) {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }
  next();
};
