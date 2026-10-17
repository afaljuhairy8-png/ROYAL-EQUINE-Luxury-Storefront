import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose, { type Model } from "mongoose";
import pino from "pino";
import { products as catalogueProducts, type Product } from "@workspace/royal-equine-catalogue";

declare global {
  // eslint-disable-next-line no-var
  var royalEquineMongoConnection: Promise<typeof mongoose> | undefined;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie"],
});

export function logSafeError(error: unknown, message: string): void {
  logger.error(
    { name: error instanceof Error ? error.name : "UnknownError" },
    message,
  );
}

export class MongoConfigurationError extends Error {
  constructor() {
    super("MongoDB is not configured.");
    this.name = "MongoConfigurationError";
  }
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new MongoConfigurationError();

  if (!globalThis.royalEquineMongoConnection) {
    const connection = mongoose.connect(uri, {
      dbName: "royal_equine",
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    globalThis.royalEquineMongoConnection = connection;
    connection.catch(() => {
      if (globalThis.royalEquineMongoConnection === connection) {
        globalThis.royalEquineMongoConnection = undefined;
      }
    });
  }

  return globalThis.royalEquineMongoConnection;
}

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true, versionKey: false },
);

export const UserModel =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema);

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

let seedPromise: Promise<void> | undefined;

export function ensureProductsSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ProductModel.init();
      await ProductModel.bulkWrite(
        catalogueProducts.map((product) => ({
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

export const AUTH_COOKIE_NAME = "royal_auth";
export const SESSION_ISSUER = "royal-equine";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured.");
    this.name = "AuthConfigurationError";
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new AuthConfigurationError();
  return secret;
}

export function createSessionToken(userId: string): string {
  return jwt.sign({}, getJwtSecret(), {
    subject: userId,
    issuer: SESSION_ISSUER,
    expiresIn: "7d",
  });
}

export function readSessionToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret(), { issuer: SESSION_ISSUER });
  if (typeof payload === "string" || !payload.sub) {
    throw new jwt.JsonWebTokenError("Invalid session payload.");
  }
  return payload;
}

export function isSessionTokenError(error: unknown): boolean {
  return error instanceof jwt.JsonWebTokenError;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api",
    maxAge: SESSION_MAX_AGE,
  };
}

export function sessionClearCookieOptions() {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  return options;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function isAdminEmail(email: string): boolean {
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(
    configuredAdminEmail &&
      email.trim().toLowerCase() === configuredAdminEmail,
  );
}
