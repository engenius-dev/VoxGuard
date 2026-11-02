import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri =
    process.env.MONGO_URI ??
    "mongodb://127.0.0.1:27017/voxguard_audits";
  await mongoose.connect(uri);
  console.info("Connected to MongoDB");
}