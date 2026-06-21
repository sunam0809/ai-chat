import { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "../lib/jwt";

export interface AuthenticatedRequest extends Request {
  user?: { userId: number; username: string };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.user = { userId: payload.userId, username: payload.username };
  next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = { userId: payload.userId, username: payload.username };
  }
  next();
}
