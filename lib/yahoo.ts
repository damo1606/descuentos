const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Interpola linealmente un valor en un rango de breakpoints → output
function score(value: number, bp: [number, number, number, number], out: [number, number, number, number]): number {
  if (value <= bp[0]) return out[0]
  if (value >= bp[3]) return out[3]
  for (let i = 0; i < 3; i++) {
    if (value <= bp[i + 1]) {
      const t = (value - bp[i]) / (bp[i + 1] - bp[i])
      return out[i] + t * (out[i + 1] - out[i])
    }
  }
  return out[3]
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

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
  beta: number

  // Price
  currentPrice: number
  high52w: number
  low52w: number
  dropFrom52w: number

  // Ratios de valoración
  pe: number
  forwardPe: number
  pb: number
  evToEbitda: number
  dividendYield: number
  peg: number

  // FCF
  freeCashflow: number
  sharesOutstanding: number
  pFcf: number                // Price / FCF per share

  // Enterprise Value
  enterpriseValue: number
  ebitda: number
  earningsYield: number       // EBIT / EV — proxy con EBITDA

  // Valor intrínseco
  eps: number
  bookValue: number
  grahamNumber: number        // sqrt(22.5 * EPS * BookValue)
  discountToGraham: number    // % descuento vs Graham Number (positivo = barato)

  // Peter Lynch Fair Value
  lynchValue: number          // EPS * 15
  discountToLynch: number

  // Analistas
  analystTarget: number
  upsideToTarget: number
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

  // Score compuesto (0-100)
  valueScore: number
  qualityScore: number
  compositeScore: number
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

    const eps          = stats.trailingEps?.raw   ?? 0
    const bookValue    = stats.bookValue?.raw      ?? 0
    const grahamNumber = (eps > 0 && bookValue > 0) ? Math.sqrt(22.5 * eps * bookValue) : 0
    const discountToGraham = grahamNumber > 0 && currentPrice > 0
      ? ((grahamNumber - currentPrice) / currentPrice) * 100 : 0

    const lynchValue       = eps > 0 ? eps * 15 : 0
    const discountToLynch  = lynchValue > 0 && currentPrice > 0
      ? ((lynchValue - currentPrice) / currentPrice) * 100 : 0

    const analystTarget  = financial.targetMeanPrice?.raw ?? 0
    const upsideToTarget = analystTarget > 0 && currentPrice > 0
      ? ((analystTarget - currentPrice) / currentPrice) * 100 : 0

    const freeCashflow     = financial.freeCashflow?.raw      ?? 0
    const sharesOutstanding = stats.sharesOutstanding?.raw    ?? 0
    const fcfPerShare       = sharesOutstanding > 0 ? freeCashflow / sharesOutstanding : 0
    const pFcf              = fcfPerShare > 0 ? currentPrice / fcfPerShare : 0

    const enterpriseValue  = stats.enterpriseValue?.raw       ?? 0
    const ebitda           = stats.ebitda?.raw ?? financial.ebitda?.raw ?? 0
    // Earnings Yield = EBITDA / EV (proxy — idealmente sería EBIT)
    const earningsYield    = enterpriseValue > 0 && ebitda > 0
      ? (ebitda / enterpriseValue) * 100 : 0

    const roe = financial.returnOnEquity?.raw ?? 0
    const roa = financial.returnOnAssets?.raw ?? 0
    const operatingMargin = financial.operatingMargins?.raw ?? 0
    const debtToEquity    = financial.debtToEquity?.raw     ?? 0

    // Value Score (0-100): premia ratios bajos y descuentos altos
    const valueScore = clamp(
      score(discountToGraham,  [-50, 0, 20, 50],  [0, 30, 70, 100]) * 0.30 +
      score(pFcf > 0 ? -pFcf : 0, [-60, -30, -15, 0], [0, 30, 70, 100]) * 0.25 +
      score(upsideToTarget,    [0, 10, 25, 50],   [0, 20, 60, 100]) * 0.25 +
      score(earningsYield,     [0, 4, 8, 15],     [0, 20, 60, 100]) * 0.20,
      0, 100
    )

    // Quality Score (0-100): premia rentabilidad alta y deuda baja
    const qualityScore = clamp(
      score(roe * 100,          [0, 10, 20, 40],   [0, 20, 60, 100]) * 0.40 +
      score(roa * 100,          [0, 5, 10, 20],    [0, 20, 60, 100]) * 0.30 +
      score(operatingMargin * 100, [0, 10, 20, 35], [0, 20, 60, 100]) * 0.20 +
      score(debtToEquity > 0 ? -debtToEquity / 100 : 0, [-3, -1.5, -0.5, 0], [0, 20, 60, 100]) * 0.10,
      0, 100
    )

    const compositeScore = Math.round(valueScore * 0.55 + qualityScore * 0.45)

    return {
      symbol,
      company:   price.longName ?? price.shortName ?? symbol,
      sector:    profile.sector   ?? "",
      industry:  profile.industry ?? "",
      marketCap: price.marketCap?.raw ?? summary.marketCap?.raw ?? 0,
      beta:      summary.beta?.raw ?? 0,

      currentPrice,
      high52w,
      low52w,
      dropFrom52w,

      pe:           summary.trailingPE?.raw       ?? 0,
      forwardPe:    summary.forwardPE?.raw        ?? stats.forwardPE?.raw ?? 0,
      pb:           stats.priceToBook?.raw        ?? 0,
      evToEbitda:   stats.enterpriseToEbitda?.raw ?? 0,
      dividendYield: summary.dividendYield?.raw   ?? 0,
      peg:          stats.pegRatio?.raw           ?? 0,

      freeCashflow,
      sharesOutstanding,
      pFcf,

      enterpriseValue,
      ebitda,
      earningsYield,

      eps,
      bookValue,
      grahamNumber,
      discountToGraham,

      lynchValue,
      discountToLynch,

      analystTarget,
      upsideToTarget,
      analystCount: financial.numberOfAnalystOpinions?.raw ?? 0,

      roe,
      roa,
      debtToEquity,
      grossMargin:     financial.grossMargins?.raw    ?? 0,
      operatingMargin,
      netMargin:       financial.profitMargins?.raw   ?? 0,

      earningsGrowth: financial.earningsGrowth?.raw ?? 0,
      revenueGrowth:  financial.revenueGrowth?.raw  ?? 0,

      valueScore:     Math.round(valueScore),
      qualityScore:   Math.round(qualityScore),
      compositeScore,
    }
  } catch {
    return null
  }
}
