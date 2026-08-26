 import mongoose from "mongoose";

const mongodb_URI = process.env.MONGODB_URI as string;
const mongodbName = process.env.MONGODB_DB_NAME as string;

if(!mongodbName){
    throw new Error("MONGODB_URI is not defined");
}
if(!mongodbName){
    throw new Error("MONGODB_NAME is not defined");
}

export default async function connectDB(){
    try{
        mongoose.connect(mongodbName, {dbName: mongodbName});
        console.log("Connected to MongoDB");
    }catch(err){
        console.log("Error connecting to MongoDB:", err);
    }
}