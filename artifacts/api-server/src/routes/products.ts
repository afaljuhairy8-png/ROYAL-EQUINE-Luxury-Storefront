import { Router } from "express";
import { ListProductsResponse } from "@workspace/api-zod";
import { connectMongo, MongoConfigurationError } from "../lib/mongodb.js";
import { ensureProductsSeeded } from "../lib/seed-products.js";
import { ProductModel } from "../models/Product.js";

const router = Router();

router.get("/products", async (req, res) => {
  try {
    await connectMongo();
    await ensureProductsSeeded();
    const products = await ProductModel.find().sort({ id: 1 }).lean();
    res.status(200).json(ListProductsResponse.parse(products));
  } catch (error) {
    if (error instanceof MongoConfigurationError) {
      req.log.warn("MONGODB_URI is missing from server secrets");
    } else {
      req.log.error(
        { name: error instanceof Error ? error.name : "UnknownError" },
        "Product catalogue database request failed",
      );
    }
    res.status(503).json({ error: "The product catalogue is temporarily unavailable." });
  }
});

export default router;
