import { Router, type IRouter } from "express";
import healthRouter from "./health";
import growthRouter from "./growth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(growthRouter);

export default router;
