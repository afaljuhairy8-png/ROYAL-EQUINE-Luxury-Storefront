import { products as seedProducts } from "@workspace/royal-equine-catalogue";
import { ProductModel } from "../models/Product.js";

let seedPromise: Promise<void> | undefined;

export function ensureProductsSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ProductModel.init();
      await ProductModel.bulkWrite(
        seedProducts.map((product) => ({
          updateOne: {
            filter: { id: product.id },
            update: { $setOnInsert: product },
            upsert: true,
          },
        })),
        { ordered: true },
      );
    })().catch((error: unknown) => {
      seedPromise = undefined;
      throw error;
    });
  }

  return seedPromise;
}
