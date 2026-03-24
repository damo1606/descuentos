const API_KEY = process.env.GURUFOCUS_API_KEY
const BASE = "https://api.gurufocus.com/public/user"

export interface StockSummary {
  symbol: string
  company: string
  price: number
  gf_value: number
  margin_gf_value: number
  gf_valuation: string
  gf_score: number
  rank_financial_strength: number
  rank_profitability: number
  rank_gf_value: number
  rank_growth: number
  rank_momentum: number
  discountdcf: number
  discounte: number
  discountddm: number
  pe_ratio: number
  pb_ratio: number
  roic: number
  earning_growth_5y: number
  debt2equity: number
  sector: string
  industry: string
  market_cap: number
  currency: string
}

export async function fetchStockSummary(symbol: string): Promise<StockSummary | null> {
  const res = await fetch(`${BASE}/${API_KEY}/stock/${symbol}/summary`, {
    next: { revalidate: 3600 },
  })

  if (!res.ok) return null

  const data = await res.json()
  const g = data?.summary?.general
  if (!g) return null

  return {
    symbol,
    company: g.company ?? "",
    price: parseFloat(g.price) || 0,
    gf_value: parseFloat(g.gf_value) || 0,
    margin_gf_value: parseFloat(g.margin_gf_value) || 0,
    gf_valuation: g.gf_valuation ?? "",
    gf_score: parseInt(g.gf_score) || 0,
    rank_financial_strength: parseInt(g.rank_financial_strength) || 0,
    rank_profitability: parseInt(g.rank_profitability) || 0,
    rank_gf_value: parseInt(g.rank_gf_value) || 0,
    rank_growth: parseInt(g.rank_growth) || 0,
    rank_momentum: parseInt(g.rank_momentum) || 0,
    discountdcf: parseFloat(g.discountdcf) || 0,
    discounte: parseFloat(g.discounte) || 0,
    discountddm: parseFloat(g.discountddm) || 0,
    pe_ratio: parseFloat(g.pe_ratio) || 0,
    pb_ratio: parseFloat(g.pb_ratio) || 0,
    roic: parseFloat(g.roic) || 0,
    earning_growth_5y: parseFloat(g.earning_growth_5y) || 0,
    debt2equity: parseFloat(g.debt2equity) || 0,
    sector: g.sector ?? "",
    industry: g.subindustry ?? g.group ?? "",
    market_cap: parseFloat(g.cap) || 0,
    currency: g.currency ?? "$",
  }
}
