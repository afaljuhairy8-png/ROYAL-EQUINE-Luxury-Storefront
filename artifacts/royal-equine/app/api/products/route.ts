import { ListProductsResponse } from "@workspace/api-zod";
import {
  connectMongo,
  ensureProductsSeeded,
  MongoConfigurationError,
  ProductModel,
} from "@workspace/royal-equine-server";
import { NextResponse } from "next/server";
import { serviceUnavailable } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectMongo();
    await ensureProductsSeeded();
    const products = await ProductModel.find().sort({ id: 1 }).lean();
    return NextResponse.json(ListProductsResponse.parse(products));
  } catch (error) {
    const missingConfiguration =
      error instanceof MongoConfigurationError
        ? "The product catalogue is not configured yet."
        : "The product catalogue is temporarily unavailable.";
    return serviceUnavailable(
      error,
      "Product catalogue database request failed",
      "The product catalogue is temporarily unavailable.",
      missingConfiguration,
    );
  }
}
