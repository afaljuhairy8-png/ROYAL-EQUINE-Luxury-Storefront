import mongoose, { type Model } from "mongoose";

export type OrderLineRecord = {
  productId: string;
  name: string;
  nameAr: string;
  image: string;
  price: number;
  quantity: number;
};

export type DeliveryRecord = {
  firstName: string;
  lastName: string;
  phone: string;
  area: string;
  address: string;
  notes?: string;
  email: string;
};

export type OrderRecord = {
  user: mongoose.Types.ObjectId;
  orderNumber: string;
  items: OrderLineRecord[];
  delivery: DeliveryRecord;
  total: number;
  status: "pending" | "paid";
  createdAt: Date;
  updatedAt: Date;
};

const orderSchema = new mongoose.Schema<OrderRecord>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderNumber: { type: String, required: true, unique: true },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        nameAr: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    delivery: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String, required: true },
      area: { type: String, required: true },
      address: { type: String, required: true },
      notes: { type: String },
      email: { type: String, required: true },
    },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ["pending", "paid"], default: "pending" },
  },
  { timestamps: true, versionKey: false },
);

export const OrderModel =
  (mongoose.models.Order as Model<OrderRecord> | undefined) ??
  mongoose.model<OrderRecord>("Order", orderSchema);
