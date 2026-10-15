import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth.js";
import productsRouter from "./products.js";
import ordersRouter from "./orders.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(adminRouter);

export default router;
