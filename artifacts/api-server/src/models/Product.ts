import mongoose, { type Model } from "mongoose";
import type { Product } from "@workspace/royal-equine-catalogue";

const productSchema = new mongoose.Schema<Product>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameAr: { type: String, required: true },
    category: { type: String, required: true },
    categoryAr: { type: String, required: true },
    description: { type: String, required: true },
    descriptionAr: { type: String, required: true },
    department: { type: String, required: true, enum: ["horse", "rider", "care"] },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true },
    badge: { type: String },
    badgeAr: { type: String },
    shelf: { type: String, enum: ["supplements", "medicine"] },
  },
  { timestamps: true, versionKey: false },
);

export const ProductModel =
  (mongoose.models.Product as Model<Product> | undefined) ??
  mongoose.model<Product>("Product", productSchema);
