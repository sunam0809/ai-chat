import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/debug-headers", (req, res) => {
  res.json({
    secure: req.secure,
    protocol: req.protocol,
    xForwardedProto: req.headers["x-forwarded-proto"],
    xForwardedFor: req.headers["x-forwarded-for"],
    host: req.headers["host"],
    ip: req.ip,
    trustProxy: req.app.get("trust proxy"),
  });
});

export default router;
