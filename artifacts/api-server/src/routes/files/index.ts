import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../lib/logger";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

router.post("/files/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
  const fullId = req.file.filename;
  res.status(201).json({
    fileId: fullId,
    fileName: req.file.originalname,
    fileUrl: `/api/files/${fullId}/download`,
    size: req.file.size,
  });
});

router.get("/files/:fileId/download", (req, res) => {
  const fileId = req.params.fileId;
  const safeName = path.basename(fileId);
  const filePath = path.join(uploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const originalName = req.query.name as string | undefined;
  const downloadName = originalName ?? safeName;

  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  logger.info({ fileId }, "file download");
  res.sendFile(filePath);
});

export default router;
