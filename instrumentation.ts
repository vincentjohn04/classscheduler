import connectDb from "./lib/mongodb";

export async function register() {
  await connectDb();
}