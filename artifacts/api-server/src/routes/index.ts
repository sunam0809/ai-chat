import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import conversationsRouter from "./conversations";
import filesRouter from "./files";
import modelsRouter from "./models";
import compileRouter from "./compile";
import previewRouter from "./preview";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(conversationsRouter);
router.use(filesRouter);
router.use(modelsRouter);
router.use(compileRouter);
router.use(previewRouter);

export default router;
