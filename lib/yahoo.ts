export type YahooData = {
  symbol: string
  currentPrice: number
  ath: number
  athDate: string
  dropFromAth: number // % negativo = caída desde ATH
}

export async function fetchYahooData(symbol: string): Promise<YahooData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1mo&includePrePost=false`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const highs: number[] = result.indicators?.quote?.[0]?.high ?? []
    const timestamps: number[] = result.timestamp ?? []
    const currentPrice: number = result.meta?.regularMarketPrice ?? 0

    if (highs.length === 0 || currentPrice === 0) return null

    // Encontrar el ATH y su fecha
    let athValue = 0
    let athIndex = 0
    highs.forEach((h, i) => {
      if (h != null && h > athValue) {
        athValue = h
        athIndex = i
      }
    })

    const athTimestamp = timestamps[athIndex]
    const athDate = athTimestamp
      ? new Date(athTimestamp * 1000).toISOString().split("T")[0]
      : ""

    const dropFromAth = athValue > 0
      ? ((currentPrice - athValue) / athValue) * 100
      : 0

    return {
      symbol,
      currentPrice,
      ath: athValue,
      athDate,
      dropFromAth,
    }
  } catch {
    return null
  }
}
