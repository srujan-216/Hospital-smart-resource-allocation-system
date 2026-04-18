import { Router } from "express";
import { LoginBody } from "../types.js";
import { signAdmin } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const parse = LoginBody.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "username and password required" });
  const { username, password } = parse.data;
  const okUser = username === (process.env.ADMIN_USERNAME || "admin");
  const okPass = password === (process.env.ADMIN_PASSWORD || "hackathon2026");
  if (!okUser || !okPass) return res.status(401).json({ error: "invalid credentials" });
  res.json({ token: signAdmin(username), username });
});
