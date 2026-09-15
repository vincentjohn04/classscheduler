import { model, models, Schema } from "mongoose";

const userSchema = new Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

export const users = models.User || model("User", userSchema);

