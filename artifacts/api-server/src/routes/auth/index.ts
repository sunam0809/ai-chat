import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

const router = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "아이디는 3자 이상, 비밀번호는 6자 이상이어야 합니다" });
    return;
  }
  const { username, password } = parsed.data;
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "이미 사용 중인 아이디입니다" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ username, passwordHash }).returning();
    req.session.userId = user.id;
    req.session.username = user.username;
    res.status(201).json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (err) {
    logger.error({ err }, "register error");
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요" });
    return;
  }
  const { username, password } = parsed.data;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!user) {
      res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      return;
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (err) {
    logger.error({ err }, "login error");
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (err) {
    logger.error({ err }, "getMe error");
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

export default router;
