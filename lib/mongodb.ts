import mongoose from "mongoose";

const mongodbUri = process.env.MONGODB_URI ?? "";
const mongodbName = process.env.MONGODB_DB_NAME ?? "chronyx";

const connectionState = {
    isConnected: false,
};

export default async function connectDb() {
    if (mongoose.connection.readyState === 1) {
        connectionState.isConnected = true;
        return;
    }

    if (!mongodbUri) {
        throw new Error("MONGODB_URI is not defined");
    }

    try {
        await mongoose.connect(mongodbUri, {
            dbName: mongodbName,
            serverSelectionTimeoutMS: 5000,
        });
        connectionState.isConnected = true;
        console.log("Connected to MongoDB");
    } catch (error) {
        connectionState.isConnected = false;
        console.error("MongoDB connection failed:", error);
        throw error;
    }
}