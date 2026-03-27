const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Module-level crumb cache (lives for the duration of the serverless instance)
let _crumb: string | null = null
let _cookie: string | null = null

async function refreshCrumb(): Promise<boolean> {
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "follow",
    })

    // Extract A3 cookie
    const raw = cookieRes.headers.get("set-cookie") ?? ""
    const match = raw.match(/A3=[^;]+/)
    if (!match) return false
    _cookie = match[0]

    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: _cookie },
    })
    const crumb = await crumbRes.text()
    if (!crumb || crumb.includes("{")) return false

    _crumb = crumb
    return true
  } catch {
    return false
  }
}

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (_crumb && _cookie) return { crumb: _crumb, cookie: _cookie }
  const ok = await refreshCrumb()
  if (!ok || !_crumb || !_cookie) return null
  return { crumb: _crumb, cookie: _cookie }
}

export type StockData = {
  symbol: string
  company: string
  sector: string
  industry: string
  marketCap: number

  // Price
  currentPrice: number
  high52w: number
  low52w: number
  dropFrom52w: number // % negativo desde el máximo de 52 semanas

  // Ratios de valoración
  pe: number
  forwardPe: number
  pb: number
  evToEbitda: number
  dividendYield: number

  // Valor intrínseco
  eps: number
  bookValue: number
  grahamNumber: number        // sqrt(22.5 * EPS * BookValue)
  discountToGraham: number    // % descuento vs Graham Number (positivo = barato)

  // Analistas
  analystTarget: number
  upsideToTarget: number      // % upside a precio objetivo analistas
  analystCount: number

  // Calidad
  roe: number
  roa: number
  debtToEquity: number
  grossMargin: number
  operatingMargin: number
  netMargin: number

  // Crecimiento
  earningsGrowth: number
  revenueGrowth: number
}

export async function fetchStockData(symbol: string): Promise<StockData | null> {
  try {
    const auth = await getCrumb()
    if (!auth) return null

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,financialData,defaultKeyStatistics,assetProfile&crumb=${encodeURIComponent(auth.crumb)}`

    let res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: auth.cookie },
      next: { revalidate: 3600 },
    })

    // Si el crumb expiró, refrescamos y reintentamos una vez
    if (res.status === 401) {
      _crumb = null
      _cookie = null
      const newAuth = await getCrumb()
      if (!newAuth) return null
      const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,financialData,defaultKeyStatistics,assetProfile&crumb=${encodeURIComponent(newAuth.crumb)}`
      res = await fetch(retryUrl, {
        headers: { "User-Agent": UA, Cookie: newAuth.cookie },
        next: { revalidate: 3600 },
      })
    }

    if (!res.ok) return null

    const json = await res.json()
    const r = json?.quoteSummary?.result?.[0]
    if (!r) return null

    const profile   = r.assetProfile        ?? {}
    const summary   = r.summaryDetail       ?? {}
    const stats     = r.defaultKeyStatistics ?? {}
    const financial = r.financialData       ?? {}
    const price     = r.price               ?? {}

    const currentPrice = financial.currentPrice?.raw   ?? summary.regularMarketPrice?.raw ?? 0
    const high52w      = summary.fiftyTwoWeekHigh?.raw ?? 0
    const low52w       = summary.fiftyTwoWeekLow?.raw  ?? 0
    const dropFrom52w  = high52w > 0 ? ((currentPrice - high52w) / high52w) * 100 : 0

    const eps          = stats.trailingEps?.raw ?? 0
    const bookValue    = stats.bookValue?.raw    ?? 0
    const grahamNumber = (eps > 0 && bookValue > 0)
      ? Math.sqrt(22.5 * eps * bookValue)
      : 0
    const discountToGraham = (grahamNumber > 0 && currentPrice > 0)
      ? ((grahamNumber - currentPrice) / currentPrice) * 100
      : 0

    const analystTarget  = financial.targetMeanPrice?.raw        ?? 0
    const upsideToTarget = (analystTarget > 0 && currentPrice > 0)
      ? ((analystTarget - currentPrice) / currentPrice) * 100
      : 0

    return {
      symbol,
      company:   price.longName   ?? price.shortName ?? symbol,
      sector:    profile.sector   ?? "",
      industry:  profile.industry ?? "",
      marketCap: price.marketCap?.raw ?? summary.marketCap?.raw ?? 0,

      currentPrice,
      high52w,
      low52w,
      dropFrom52w,

      pe:         summary.trailingPE?.raw         ?? 0,
      forwardPe:  summary.forwardPE?.raw          ?? stats.forwardPE?.raw ?? 0,
      pb:         stats.priceToBook?.raw          ?? 0,
      evToEbitda: stats.enterpriseToEbitda?.raw   ?? 0,
      dividendYield: summary.dividendYield?.raw   ?? 0,

      eps,
      bookValue,
      grahamNumber,
      discountToGraham,

      analystTarget,
      upsideToTarget,
      analystCount: financial.numberOfAnalystOpinions?.raw ?? 0,

      roe:            financial.returnOnEquity?.raw  ?? 0,
      roa:            financial.returnOnAssets?.raw  ?? 0,
      debtToEquity:   financial.debtToEquity?.raw    ?? 0,
      grossMargin:    financial.grossMargins?.raw     ?? 0,
      operatingMargin: financial.operatingMargins?.raw ?? 0,
      netMargin:      financial.profitMargins?.raw    ?? 0,

      earningsGrowth: financial.earningsGrowth?.raw  ?? 0,
      revenueGrowth:  financial.revenueGrowth?.raw   ?? 0,
    }
  } catch {
    return null
  }
}
