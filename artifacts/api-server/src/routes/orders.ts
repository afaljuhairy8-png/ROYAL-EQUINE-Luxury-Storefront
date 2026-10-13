import { randomBytes } from "node:crypto";
import { Router } from "express";
import { ListMyOrdersResponse, PlaceOrderBody, PlaceOrderResponse } from "@workspace/api-zod";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/require-auth.js";
import { connectMongo, MongoConfigurationError } from "../lib/mongodb.js";
import { OrderModel, type OrderRecord } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";

const router = Router();

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

function sameOriginRequest(req: Parameters<Parameters<typeof router.post>[1]>[0]): boolean {
  const origin = req.get("origin");
  const host = req.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

router.get("/orders", requireAuth, async (req, res) => {
  if (!req.royalUser) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }

  try {
    await connectMongo();
    const documents = await OrderModel.find({ user: new mongoose.Types.ObjectId(req.royalUser.id) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const orders = documents.map((order) => toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }));
    res.status(200).json(ListMyOrdersResponse.parse(orders));
  } catch (error) {
    if (error instanceof MongoConfigurationError) {
      req.log.warn("MONGODB_URI is missing from server secrets");
    } else {
      req.log.error(
        { name: error instanceof Error ? error.name : "UnknownError" },
        "Order history database request failed",
      );
    }
    res.status(503).json({ error: "Your orders are temporarily unavailable." });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  if (!req.royalUser) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "This order request could not be verified." });
    return;
  }

  const parsed = PlaceOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check your cart and delivery details." });
    return;
  }

  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (quantity > 99) {
      res.status(400).json({ error: "A product quantity cannot exceed 99." });
      return;
    }
    quantities.set(item.productId, quantity);
  }

  try {
    await connectMongo();
    const products = await ProductModel.find({ id: { $in: [...quantities.keys()] } }).lean();
    const byId = new Map(products.map((product) => [product.id, product]));
    if (byId.size !== quantities.size) {
      res.status(400).json({ error: "One or more products are no longer available." });
      return;
    }

    const items = [...quantities].map(([productId, quantity]) => {
      const product = byId.get(productId);
      if (!product) throw new Error("Product disappeared while building the order.");
      return {
        productId: product.id,
        name: product.name,
        nameAr: product.nameAr,
        image: product.image,
        price: product.price,
        quantity,
      };
    });
    const total = Number(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(3),
    );
    const orderNumber = `RE-${randomBytes(4).toString("hex").toUpperCase()}`;
    const order = await OrderModel.create({
      user: new mongoose.Types.ObjectId(req.royalUser.id),
      orderNumber,
      items,
      delivery: {
        ...parsed.data.delivery,
        email: req.royalUser.email,
      },
      total,
      status: "pending",
    });

    res.status(201).json(PlaceOrderResponse.parse(toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId })));
  } catch (error) {
    if (error instanceof MongoConfigurationError) {
      req.log.warn("MONGODB_URI is missing from server secrets");
    } else {
      req.log.error(
        { name: error instanceof Error ? error.name : "UnknownError" },
        "Order creation failed",
      );
    }
    res.status(503).json({ error: "The order could not be saved. Please try again." });
  }
});

export default router;
