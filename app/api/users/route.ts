import { NextRequest, NextResponse } from "next/server";
import connectDb from "@/lib/mongodb";
import { users } from "@/model/user";

export async function GET() {
    try {
        await connectDb();
        const fetchUser = await users.find({}).select("-password");
        return NextResponse.json({ data: fetchUser });
    } catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ status: 400, message: "Users not found" });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectDb();

        const { id, name, password, email } = await req.json();

        if (!id || !name || !password || !email) {
            return NextResponse.json({ status: 400, message: "Name, email, password, or id are not set" });
        }

        const addUsers = new users({
            id: Number(id),
            name,
            email,
            password,
        });

        await addUsers.save();

        return NextResponse.json({ status: 201, message: "User created successfully" });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ status: 400, message: "Something went wrong" });
    }
}