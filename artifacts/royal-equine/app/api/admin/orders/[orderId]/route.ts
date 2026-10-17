import {
  connectMongo,
  OrderModel,
  type OrderRecord,
} from "@workspace/royal-equine-server";
import {
  UpdateAdminOrderBody,
  UpdateAdminOrderParams,
  UpdateAdminOrderResponse,
} from "@workspace/api-zod";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  parseJsonBody,
  requireRoyalAdmin,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orderId: string }> };

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  const { orderId } = await context.params;
  const params = UpdateAdminOrderParams.safeParse({ orderId });
  if (!params.success || !mongoose.isValidObjectId(params.data.orderId)) {
    return NextResponse.json(
      { error: "The order identifier is invalid." },
      { status: 400 },
    );
  }
  const parsed = UpdateAdminOrderBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a valid order status." },
      { status: 400 },
    );
  }

  try {
    await connectMongo();
    const order = await OrderModel.findByIdAndUpdate(
      params.data.orderId,
      { $set: { status: parsed.data.status } },
      { new: true, runValidators: true },
    ).lean();
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json(
      UpdateAdminOrderResponse.parse(
        toPublicOrder(order as OrderRecord & { _id: mongoose.Types.ObjectId }),
      ),
    );
  } catch (error) {
    return serviceUnavailable(
      error,
      "Admin order update failed",
      "The order could not be updated. Please try again.",
    );
  }
}
