export async function GET() {
  const key = process.env.GURUFOCUS_API_KEY
  const url = `https://api.gurufocus.com/public/user/${key}/stock/AAPL/summary`

  try {
    const res = await fetch(url)
    const text = await res.text()
    return Response.json({
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 500),
    })
  } catch (e) {
    return Response.json({ error: String(e) })
  }
}
