import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { logger } from "../../lib/logger";

const router = Router();

const workspaceRoot = process.cwd();
const PREVIEW_DIR = path.resolve(workspaceRoot, "artifacts/api-server/previews");

if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

router.post("/preview", async (req, res) => {
  const { html, title } = req.body as { html: string; title?: string };

  if (!html) {
    res.status(400).json({ error: "html 필드가 필요합니다" });
    return;
  }

  const id = uuidv4();
  const filePath = path.join(PREVIEW_DIR, `${id}.html`);

  try {
    fs.writeFileSync(filePath, html, "utf-8");
    const previewUrl = `/api/preview/${id}`;
    logger.info({ id, title }, "preview created");
    res.json({ id, previewUrl, title: title ?? "Preview" });
  } catch (err: any) {
    logger.error({ err }, "preview create error");
    res.status(500).json({ error: err?.message ?? "미리보기 생성 실패" });
  }
});

router.get("/preview/:id", (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9-]/g, "");
  const filePath = path.join(PREVIEW_DIR, `${id}.html`);

  if (!fs.existsSync(filePath)) {
    res.status(404).send("<h1>Preview not found</h1>");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.sendFile(filePath);
});

export default router;
