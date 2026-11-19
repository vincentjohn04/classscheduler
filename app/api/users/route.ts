import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import connectDb from "@/lib/mongodb";
import { getAuthenticatedUser } from "@/lib/auth";
import { users } from "@/model/user";

export async function GET() {
    try {
        const currentUser = await getAuthenticatedUser();
        if (!currentUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (currentUser.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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
        const currentUser = await getAuthenticatedUser();
        if (!currentUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (currentUser.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        await connectDb();

        const { id, name, password, email } = await req.json();

        if (!id || !name || !password || !email) {
            return NextResponse.json({ status: 400, message: "Name, email, password, or id are not set" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const addUsers = new users({
            name,
            email,
            password: hashedPassword,
            role: "user",
        });

        await addUsers.save();

        return NextResponse.json({ status: 201, message: "User created successfully" });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ status: 400, message: "Something went wrong" });
    }
}