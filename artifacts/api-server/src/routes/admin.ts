import { randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import {
  CreateAdminProductBody,
  CreateAdminProductResponse,
  DeleteAdminProductParams,
  ListAdminOrdersResponse,
  ListAdminProductsResponse,
  UpdateAdminOrderBody,
  UpdateAdminOrderParams,
  UpdateAdminOrderResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireAuth } from "../middleware/require-auth.js";
import { connectMongo } from "../lib/mongodb.js";
import { ensureProductsSeeded } from "../lib/seed-products.js";
import { OrderModel, type OrderRecord } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";

const router = Router();
router.use(requireAuth, requireAdmin);

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000,
  );
}

function toPublicOrder(order: OrderRecord & { _id: mongoose.Types.ObjectId }) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    items: order.items,
    delivery: order.delivery,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}

function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

router.get("/admin/products", async (req, res): Promise<void> => {
  try {
    await connectMongo();
    await ensureProductsSeeded();
    const products = await ProductModel.find().sort({ id: 1 }).lean();
    res.status(200).json(ListAdminProductsResponse.parse(products));
  } catch (error) {
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin catalogue request failed",
    );
    res.status(503).json({ error: "The product catalogue is temporarily unavailable." });
  }
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const parsed = CreateAdminProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the product details and try again." });
    return;
  }

  const id = slugFromName(parsed.data.name) || `product-${randomBytes(5).toString("hex")}`;
  try {
    await connectMongo();
    await ProductModel.init();
    const product = await ProductModel.create({ id, ...parsed.data });
    res.status(201).json(CreateAdminProductResponse.parse(product.toObject()));
  } catch (error) {
    if (isDuplicateKey(error)) {
      res.status(409).json({ error: "A product with this name already exists." });
      return;
    }
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin product creation failed",
    );
    res.status(503).json({ error: "The product could not be saved. Please try again." });
  }
});

router.patch("/admin/products/:productId", async (req, res): Promise<void> => {
  const params = UpdateAdminProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "The product identifier is invalid." });
    return;
  }
  const parsed = UpdateAdminProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the product details and try again." });
    return;
  }

  try {
    await connectMongo();
    const product = await ProductModel.findOneAndUpdate(
      { id: params.data.productId },
      { $set: parsed.data },
      { new: true, runValidators: true },
    ).lean();
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.status(200).json(UpdateAdminProductResponse.parse(product));
  } catch (error) {
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin product update failed",
    );
    res.status(503).json({ error: "The product could not be updated. Please try again." });
  }
});

router.delete("/admin/products/:productId", async (req, res): Promise<void> => {
  const params = DeleteAdminProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "The product identifier is invalid." });
    return;
  }
  try {
    await connectMongo();
    const product = await ProductModel.findOneAndDelete({ id: params.data.productId }).lean();
    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin product deletion failed",
    );
    res.status(503).json({ error: "The product could not be removed. Please try again." });
  }
});

router.get("/admin/orders", async (req, res): Promise<void> => {
  try {
    await connectMongo();
    const documents = await OrderModel.find().sort({ createdAt: -1 }).limit(200).lean();
    const orders = documents.map((order) =>
      toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }),
    );
    res.status(200).json(ListAdminOrdersResponse.parse(orders));
  } catch (error) {
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin order list request failed",
    );
    res.status(503).json({ error: "Orders are temporarily unavailable." });
  }
});

router.patch("/admin/orders/:orderId", async (req, res): Promise<void> => {
  const params = UpdateAdminOrderParams.safeParse(req.params);
  if (!params.success || !mongoose.isValidObjectId(params.data.orderId)) {
    res.status(400).json({ error: "The order identifier is invalid." });
    return;
  }
  const parsed = UpdateAdminOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid order status." });
    return;
  }
  try {
    await connectMongo();
    const order = await OrderModel.findByIdAndUpdate(
      params.data.orderId,
      { $set: { status: parsed.data.status } },
      { new: true, runValidators: true },
    ).lean();
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    res.status(200).json(
      UpdateAdminOrderResponse.parse(
        toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }),
      ),
    );
  } catch (error) {
    req.log.error(
      { name: error instanceof Error ? error.name : "UnknownError" },
      "Admin order update failed",
    );
    res.status(503).json({ error: "The order could not be updated. Please try again." });
  }
});

export default router;
