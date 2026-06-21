import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app: Express = express();

app.set("trust proxy", 1);

app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  // process.cwd() is the repo root when started via `node artifacts/api-server/dist/index.mjs`
  const staticDir = path.join(process.cwd(), "artifacts/chat-ui/dist");
  app.use(express.static(staticDir));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) {
        res.status(200).send("<!DOCTYPE html><html><body><div id=\"root\"></div></body></html>");
      }
    });
  });
}

export default app;
