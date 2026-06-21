import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
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
