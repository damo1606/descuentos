import { fetchGuruData } from "@/lib/gurufocus"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const data = await fetchGuruData(symbol.toUpperCase())

  if (!data) {
    return Response.json({ error: "Stock not found or API key missing" }, { status: 404 })
  }

  return Response.json(data)
}
