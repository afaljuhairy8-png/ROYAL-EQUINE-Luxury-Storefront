import {
  connectMongo,
  ProductModel,
} from "@workspace/royal-equine-server";
import {
  DeleteAdminProductParams,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
} from "@workspace/api-zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  parseJsonBody,
  requireRoyalAdmin,
  serviceUnavailable,
} from "@/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ productId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  const { productId } = await context.params;
  const params = UpdateAdminProductParams.safeParse({ productId });
  if (!params.success) {
    return NextResponse.json(
      { error: "The product identifier is invalid." },
      { status: 400 },
    );
  }
  const parsed = UpdateAdminProductBody.safeParse(await parseJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the product details and try again." },
      { status: 400 },
    );
  }

  try {
    await connectMongo();
    const product = await ProductModel.findOneAndUpdate(
      { id: params.data.productId },
      { $set: parsed.data },
      { new: true, runValidators: true },
    ).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json(UpdateAdminProductResponse.parse(product));
  } catch (error) {
    return serviceUnavailable(
      error,
      "Admin product update failed",
      "The product could not be updated. Please try again.",
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireRoyalAdmin(request);
  if ("response" in auth) return auth.response;

  const { productId } = await context.params;
  const params = DeleteAdminProductParams.safeParse({ productId });
  if (!params.success) {
    return NextResponse.json(
      { error: "The product identifier is invalid." },
      { status: 400 },
    );
  }

  try {
    await connectMongo();
    const product = await ProductModel.findOneAndDelete({
      id: params.data.productId,
    }).lean();
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceUnavailable(
      error,
      "Admin product deletion failed",
      "The product could not be removed. Please try again.",
    );
  }
}
