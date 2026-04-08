import type { StockData } from "../lib/yahoo"

// StockData base — empresa tecnológica sana de referencia
export const BASE: StockData = {
  symbol: "TEST",
  company: "Test Corp",
  sector: "Technology",
  industry: "Software",
  marketCap: 50_000_000_000,  // 50B — Large Cap
  beta: 1.1,

  currentPrice: 100,
  high52w: 130,
  low52w: 75,
  dropFrom52w: -23,

  pe: 22,
  forwardPe: 18,
  pb: 4,
  evToEbitda: 18,
  dividendYield: 0,
  peg: 1.5,

  freeCashflow: 4_000_000_000,
  sharesOutstanding: 1_000_000_000,
  pFcf: 25,

  enterpriseValue: 55_000_000_000,
  ebitda: 3_000_000_000,
  earningsYield: 5.5,

  eps: 5,
  bookValue: 20,
  grahamNumber: Math.sqrt(22.5 * 5 * 20),  // ~47.4
  discountToGraham: ((Math.sqrt(22.5 * 5 * 20) - 100) / 100) * 100,  // negativo — más caro que graham

  lynchValue: 75,
  discountToLynch: -25,

  analystTarget: 140,
  upsideToTarget: 40,
  analystCount: 15,

  roe: 0.35,
  roa: 0.12,
  debtToEquity: 60,   // 0.6x
  grossMargin: 0.65,
  operatingMargin: 0.25,
  netMargin: 0.20,

  earningsGrowth: 0.18,
  revenueGrowth: 0.14,
  earningsQuarterlyGrowth: 0.22,

  totalRevenue: 20_000_000_000,
  fcfMargin: 0.20,
  totalDebt: 5_000_000_000,
  totalCash: 8_000_000_000,   // net cash position
  roic: 0.22,
  hasROIC: true,

  dividendRate: 0,
  payoutRatio: 0,
  fiveYearAvgYield: 0,
  fcfPayoutRatio: 0,
  ddmGrowthRate: 0,
  ddmValue: 0,
  ddmDiscount: 0,
  isDividendPayer: false,

  valueScore: 70,
  qualityScore: 80,
  compositeScore: 75,
}

export function make(overrides: Partial<StockData>): StockData {
  return { ...BASE, ...overrides }
}
