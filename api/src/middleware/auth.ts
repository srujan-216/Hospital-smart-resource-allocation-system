import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request { admin?: { username: string } }

const SECRET = () => process.env.JWT_SECRET || "change-me-in-production";

export function signAdmin(username: string) {
  return jwt.sign({ sub: username, role: "admin" }, SECRET(), { expiresIn: "8h" });
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "admin login required" });
  try {
    const payload = jwt.verify(token, SECRET()) as any;
    if (payload.role !== "admin") return res.status(403).json({ error: "admin only" });
    req.admin = { username: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
  }
}
