import { fetchGuruData } from "@/lib/gurufocus"
import { DJIA_SYMBOLS, SP500_SYMBOLS } from "@/lib/symbols"

export type StockResult = {
  symbol: string
  company: string
  sector: string
  currentPrice: number
  high52w: number
  dropFrom52w: number
  gfScore: number
  rankFinancialStrength: number
  rankProfitability: number
  rankGrowth: number
  roic: number
  debtToEquity: number
  peRatio: number
  gfValue: number
  gfValuation: string
  marginGfValue: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const universe = searchParams.get("universe") ?? "dia"
  const minDrop = parseFloat(searchParams.get("minDrop") ?? "0")
  const minGfScore = parseInt(searchParams.get("minGfScore") ?? "0")
  const limit = parseInt(searchParams.get("limit") ?? "50")

  const symbols = universe === "dia"
    ? DJIA_SYMBOLS
    : SP500_SYMBOLS.slice(0, limit)

  const results = await Promise.allSettled(
    symbols.map((symbol) => fetchGuruData(symbol))
  )

  const stocks: StockResult[] = results
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchGuruData>>>> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value)
    .filter((s) => s.dropFrom52w <= minDrop && s.gfScore >= minGfScore)
    .sort((a, b) => a.dropFrom52w - b.dropFrom52w)

  return Response.json({ stocks, total: stocks.length })
}
