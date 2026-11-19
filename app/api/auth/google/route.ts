export async function GET() {
  return Response.json(
    { error: 'Google sign-in is not configured.' },
    { status: 501 },
  )
}
