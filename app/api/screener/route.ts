import { fetchGuruData } from "@/lib/gurufocus"
import { fetchYahooData } from "@/lib/yahoo"
import { DJIA_SYMBOLS, SP500_SYMBOLS } from "@/lib/symbols"

export type StockResult = {
  symbol: string
  company: string
  sector: string
  // Precio
  currentPrice: number
  ath: number
  athDate: string
  dropFromAth: number
  // Calidad (GuruFocus)
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
  const minDrop = parseFloat(searchParams.get("minDrop") ?? "-100")
  const minGfScore = parseInt(searchParams.get("minGfScore") ?? "0")
  const limit = parseInt(searchParams.get("limit") ?? "50")

  const symbols = universe === "dia"
    ? DJIA_SYMBOLS
    : SP500_SYMBOLS.slice(0, limit)

  // Fetch ambas fuentes en paralelo por empresa
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const [guru, yahoo] = await Promise.all([
        fetchGuruData(symbol),
        fetchYahooData(symbol),
      ])
      if (!guru || !yahoo) return null

      return {
        symbol,
        company: guru.company,
        sector: guru.sector,
        currentPrice: yahoo.currentPrice,
        ath: yahoo.ath,
        athDate: yahoo.athDate,
        dropFromAth: yahoo.dropFromAth,
        gfScore: guru.gfScore,
        rankFinancialStrength: guru.rankFinancialStrength,
        rankProfitability: guru.rankProfitability,
        rankGrowth: guru.rankGrowth,
        roic: guru.roic,
        debtToEquity: guru.debtToEquity,
        peRatio: guru.peRatio,
        gfValue: guru.gfValue,
        gfValuation: guru.gfValuation,
        marginGfValue: guru.marginGfValue,
      } satisfies StockResult
    })
  )

  const stocks: StockResult[] = results
    .filter(
      (r): r is PromiseFulfilledResult<StockResult> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value)
    .filter((s) => s.dropFromAth <= minDrop && s.gfScore >= minGfScore)
    .sort((a, b) => a.dropFromAth - b.dropFromAth) // más caída primero

  return Response.json({ stocks, total: stocks.length })
}
