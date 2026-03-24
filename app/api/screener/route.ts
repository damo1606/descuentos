import { fetchStockSummary } from "@/lib/gurufocus"
import { SP500_SYMBOLS, DJIA_SYMBOLS } from "@/lib/sp500"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const universe = searchParams.get("universe") ?? "sp500"
  const minDiscount = parseFloat(searchParams.get("minDiscount") ?? "10")
  const minGfScore = parseInt(searchParams.get("minGfScore") ?? "60")

  let symbols: string[]
  if (universe === "dia") {
    symbols = DJIA_SYMBOLS
  } else {
    const limit = parseInt(searchParams.get("limit") ?? "50")
    symbols = SP500_SYMBOLS.slice(0, limit)
  }

  const results = await Promise.allSettled(
    symbols.map((s) => fetchStockSummary(s))
  )

  const stocks = results
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchStockSummary>>>> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value)
    .filter(
      (s) =>
        s.margin_gf_value >= minDiscount &&
        s.gf_score >= minGfScore
    )
    .sort((a, b) => b.margin_gf_value - a.margin_gf_value)

  return Response.json({ stocks, total: stocks.length })
}
