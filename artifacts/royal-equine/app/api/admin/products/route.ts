import {
  connectMongo,
  ensureProductsSeeded,
  ProductModel,
} from "@workspace/royal-equine-server";
import {
  CreateAdminProductBody,
  CreateAdminProductResponse,
  ListAdminProductsResponse,
} from "@workspace/api-zod";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isDuplicateKeyError,
  parseJsonBody,
  requireRoyalAdmin,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    await connectMongo();
    await ensureProductsSeeded();
    const products = await ProductModel.find().sort({ id: 1 }).lean();
    return NextResponse.json(ListAdminProductsResponse.parse(products));
  } catch (error) {
    return serviceUnavailable(
      error,
      "Admin catalogue request failed",
      "The product catalogue is temporarily unavailable.",
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  const parsed = CreateAdminProductBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the product details and try again." },
      { status: 400 },
    );
  }

  const id = slugFromName(parsed.data.name) || `product-${randomBytes(5).toString("hex")}`;
  try {
    await connectMongo();
    await ProductModel.init();
    const product = await ProductModel.create({ id, ...parsed.data });
    return NextResponse.json(
      CreateAdminProductResponse.parse(product.toObject()),
      { status: 201 },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "A product with this name already exists." },
        { status: 409 },
      );
    }
    return serviceUnavailable(
      error,
      "Admin product creation failed",
      "The product could not be saved. Please try again.",
    );
  }
}
