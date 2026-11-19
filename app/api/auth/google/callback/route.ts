export async function GET() {
  return Response.json(
    { error: 'Google sign-in callback is not configured.' },
    { status: 501 },
  )
}
