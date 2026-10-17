import {
  connectMongo,
  OrderModel,
  type OrderRecord,
} from "@workspace/royal-equine-server";
import { ListAdminOrdersResponse } from "@workspace/api-zod";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireRoyalAdmin,
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

export async function GET(request: NextRequest) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    await connectMongo();
    const documents = await OrderModel.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const orders = documents.map((order) =>
      toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }),
    );
    return NextResponse.json(ListAdminOrdersResponse.parse(orders));
  } catch (error) {
    return serviceUnavailable(
      error,
      "Admin order list request failed",
      "Orders are temporarily unavailable.",
    );
  }
}
