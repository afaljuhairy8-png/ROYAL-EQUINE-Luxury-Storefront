import {
  connectMongo,
  ensureProductsSeeded,
  OrderModel,
  ProductModel,
  type OrderRecord,
} from "@workspace/royal-equine-server";
import { ListMyOrdersResponse, PlaceOrderBody, PlaceOrderResponse } from "@workspace/api-zod";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  parseJsonBody,
  requireRoyalUser,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

function toPublicOrder(order: OrderRecord & { _id: mongoose.Types.ObjectId }) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    items: order.items,
    delivery: order.delivery,
    total: order.total,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
  };
}

function sameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoyalUser(request);
  if ("response" in auth) return auth.response;

  try {
    await connectMongo();
    const documents = await OrderModel.find({
      user: new mongoose.Types.ObjectId(auth.user.id),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const orders = documents.map((order) =>
      toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }),
    );
    return NextResponse.json(ListMyOrdersResponse.parse(orders));
  } catch (error) {
    return serviceUnavailable(
      error,
      "Order history database request failed",
      "Your orders are temporarily unavailable.",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoyalUser(request);
  if ("response" in auth) return auth.response;
  if (!sameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This order request could not be verified." },
      { status: 403 },
    );
  }

  const parsed = PlaceOrderBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check your cart and delivery details." },
      { status: 400 },
    );
  }

  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (quantity > 99) {
      return NextResponse.json(
        { error: "A product quantity cannot exceed 99." },
        { status: 400 },
      );
    }
    quantities.set(item.productId, quantity);
  }

  try {
    await connectMongo();
    await ensureProductsSeeded();
    const products = await ProductModel.find({ id: { $in: [...quantities.keys()] } }).lean();
    const byId = new Map(products.map((product) => [product.id, product]));
    if (byId.size !== quantities.size) {
      return NextResponse.json(
        { error: "One or more products are no longer available." },
        { status: 400 },
      );
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
    const order = await OrderModel.create({
      user: new mongoose.Types.ObjectId(auth.user.id),
      orderNumber: `RE-${randomBytes(4).toString("hex").toUpperCase()}`,
      items,
      delivery: {
        ...parsed.data.delivery,
        email: auth.user.email,
      },
      total,
      status: "pending",
    });

    return NextResponse.json(
      PlaceOrderResponse.parse(
        toPublicOrder(order.toObject() as OrderRecord & { _id: mongoose.Types.ObjectId }),
      ),
      { status: 201 },
    );
  } catch (error) {
    return serviceUnavailable(
      error,
      "Order creation failed",
      "The order could not be saved. Please try again.",
    );
  }
}
