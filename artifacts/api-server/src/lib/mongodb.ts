import mongoose from "mongoose";

declare global {
  var royalEquineMongoConnection: Promise<typeof mongoose> | undefined;
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
