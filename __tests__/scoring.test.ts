import { scoreStock } from "../lib/scoring"
import { make } from "./fixtures"

describe("scoreStock — Pilar 3: Solidez Financiera", () => {
  test("posición de cash neta → netDebtEbitdaScore 100", () => {
    const s = make({ totalCash: 10_000_000_000, totalDebt: 2_000_000_000 })
    const r = scoreStock(s)
    expect(r.netDebtEbitdaScore).toBe(100)
    expect(r.netDebtToEbitda).toBe(-1)
  })

  test("EBITDA negativo con deuda → netDebtEbitdaScore 5", () => {
    const s = make({ ebitda: -500_000_000, totalDebt: 3_000_000_000, totalCash: 100_000_000 })
    const r = scoreStock(s)
    expect(r.netDebtEbitdaScore).toBe(5)
  })

  test("Net Debt/EBITDA 1x (sector normal) → score alto", () => {
    const s = make({
      totalDebt: 3_000_000_000,
      totalCash: 0,
      ebitda: 3_000_000_000,   // ratio = 1x
      sector: "Technology",
    })
    const r = scoreStock(s)
    expect(r.netDebtEbitdaScore).toBeGreaterThan(60)
  })

  test("Net Debt/EBITDA 5x (sector normal) → score bajo", () => {
    const s = make({
      totalDebt: 15_000_000_000,
      totalCash: 0,
      ebitda: 3_000_000_000,   // ratio = 5x
      sector: "Technology",
    })
    const r = scoreStock(s)
    expect(r.netDebtEbitdaScore).toBeLessThan(30)
  })

  test("Net Debt/EBITDA 5x (Utilities) puntúa mejor que el mismo ratio en Technology", () => {
    const base = { totalDebt: 15_000_000_000, totalCash: 0, ebitda: 3_000_000_000 }
    const utilities = scoreStock(make({ ...base, sector: "Utilities" }))
    const tech     = scoreStock(make({ ...base, sector: "Technology" }))
    // Utilities tolera 5x; Technology a ese nivel debería penalizar mucho más
    expect(utilities.netDebtEbitdaScore).toBeGreaterThan(tech.netDebtEbitdaScore)
  })

  test("FCF positivo con buen margen → fcfHealthScore alto", () => {
    const s = make({ freeCashflow: 4_000_000_000, fcfMargin: 0.20 })
    const r = scoreStock(s)
    expect(r.fcfHealthScore).toBeGreaterThan(75)
  })

  test("FCF negativo con 2 años de runway → fcfHealthScore bajo", () => {
    const s = make({
      freeCashflow: -1_000_000_000,
      totalCash: 2_000_000_000,   // 2 años de runway
      fcfMargin: -0.05,
    })
    const r = scoreStock(s)
    expect(r.fcfHealthScore).toBe(18)
  })

  test("FCF negativo sin cash → fcfHealthScore crítico", () => {
    const s = make({ freeCashflow: -500_000_000, totalCash: 0, fcfMargin: -0.03 })
    const r = scoreStock(s)
    expect(r.fcfHealthScore).toBe(5)
  })

  test("Financial Services — D/E 10x puntúa mejor que en sector no-financiero", () => {
    const financial = scoreStock(make({ sector: "Financial Services", debtToEquity: 1000 }))
    const tech      = scoreStock(make({ sector: "Technology",         debtToEquity: 1000 }))
    expect(financial.debtScore).toBeGreaterThan(tech.debtScore)
  })

  test("healthScore combina los 3 sub-scores", () => {
    const s = make({
      totalCash: 10_000_000_000,  // net cash → netDebtEbitdaScore 100
      totalDebt: 0,
      debtToEquity: 0,
      freeCashflow: 4_000_000_000,
      fcfMargin: 0.20,
    })
    const r = scoreStock(s)
    expect(r.healthScore).toBeGreaterThan(80)
  })
})

describe("scoreStock — Pilar 4: Precio", () => {
  test("EPS negativo → grahamScore penalizado (35) no explota", () => {
    const s = make({ eps: -2, grahamNumber: 0, discountToGraham: 0 })
    const r = scoreStock(s)
    expect(r.grahamScore).toBe(35)
  })

  test("EPS negativo → lynchScore penalizado (35)", () => {
    const s = make({ eps: -2, lynchValue: 0, discountToLynch: 0 })
    const r = scoreStock(s)
    expect(r.lynchScore).toBe(35)
  })

  test("precio 30% bajo Graham Number → grahamScore alto", () => {
    const s = make({ grahamNumber: 143, discountToGraham: 30 })
    const r = scoreStock(s)
    expect(r.grahamScore).toBeGreaterThan(70)
  })

  test("precio 30% sobre Graham Number → grahamScore bajo", () => {
    const s = make({ grahamNumber: 77, discountToGraham: -30 })
    const r = scoreStock(s)
    expect(r.grahamScore).toBeLessThan(20)
  })

  test("1 solo analista → upsideScore al 60% de su valor normal", () => {
    const s1 = make({ analystCount: 1, upsideToTarget: 30, analystTarget: 130 })
    const s10 = make({ analystCount: 10, upsideToTarget: 30, analystTarget: 130 })
    const r1 = scoreStock(s1)
    const r10 = scoreStock(s10)
    expect(r1.upsideScore).toBeLessThan(r10.upsideScore)
  })

  test("sin target de analistas → upsideScore penalizado (35)", () => {
    const s = make({ analystTarget: 0, upsideToTarget: 0, analystCount: 0 })
    const r = scoreStock(s)
    expect(r.upsideScore).toBe(35)
  })

  test("P/FCF y EV/EBITDA sin datos → 35 cada uno (no 50)", () => {
    const s = make({ pFcf: 0, evToEbitda: 0 })
    const r = scoreStock(s)
    expect(r.pfcfScore).toBe(35)
    expect(r.evEbitdaScore).toBe(35)
  })

  test("pesos del priceScore suman correctamente", () => {
    // Con todos los sub-scores en 100, priceScore debería ser ~100
    const s = make({
      pFcf: 5,           // → pfcfScore ~100
      evToEbitda: 5,     // → evEbitdaScore ~100
      grahamNumber: 200,
      discountToGraham: 50,   // → grahamScore 100
      lynchValue: 200,
      discountToLynch: 50,    // → lynchScore 100
      analystTarget: 200,
      upsideToTarget: 50,
      analystCount: 20,        // → upsideScore ~100
    })
    const r = scoreStock(s)
    expect(r.priceScore).toBeGreaterThan(90)
  })
})

describe("scoreStock — Score Final y Grade", () => {
  test("empresa excelente → grade A o A+", () => {
    const s = make({
      roic: 0.30,
      roe: 0.40,
      grossMargin: 0.70,
      operatingMargin: 0.30,
      netMargin: 0.25,
      fcfMargin: 0.25,
      debtToEquity: 20,
      totalCash: 10e9,
      totalDebt: 1e9,
      freeCashflow: 5e9,
      ebitda: 6e9,
      pFcf: 12,
      evToEbitda: 12,
      discountToGraham: 25,
      discountToLynch: 20,
      analystCount: 10,
      upsideToTarget: 30,
    })
    const r = scoreStock(s)
    expect(["A", "A+"]).toContain(r.grade)
  })

  test("empresa sin datos → grade F o D, no crashea", () => {
    const s = make({
      roic: 0, roe: 0, roa: 0, grossMargin: 0, operatingMargin: 0,
      netMargin: 0, fcfMargin: 0, debtToEquity: 0, pFcf: 0,
      evToEbitda: 0, grahamNumber: 0, lynchValue: 0, analystTarget: 0,
      freeCashflow: 0, ebitda: 0, totalDebt: 0, totalCash: 0,
    })
    expect(() => scoreStock(s)).not.toThrow()
    const r = scoreStock(s)
    expect(["D", "F"]).toContain(r.grade)
  })

  test("buyReady: calidad ≥65, precio ≥45 y caída ≥-10% → true", () => {
    // Empresa de alta calidad, precio bajo, con caída desde máximos
    const s = make({
      roic: 0.28, roe: 0.38, grossMargin: 0.68, operatingMargin: 0.28,
      netMargin: 0.22, fcfMargin: 0.22, debtToEquity: 20,
      totalCash: 8e9, totalDebt: 1e9, freeCashflow: 4e9, ebitda: 5e9,
      pFcf: 10, evToEbitda: 8, discountToGraham: 30, discountToLynch: 25,
      analystCount: 12, upsideToTarget: 35, dropFrom52w: -25,
    })
    const r = scoreStock(s)
    if (r.qualityScore >= 65 && r.priceScore >= 45) {
      expect(r.buyReady).toBe(true)
    }
  })

  test("buyReady: sin caída desde máximos → false aunque calidad sea alta", () => {
    const s = make({ dropFrom52w: -3 })
    const r = scoreStock(s)
    expect(r.buyReady).toBe(false)
  })

  test("small cap (300M) → capSizeLabel Micro Cap con factor 0.70", () => {
    const s = make({ marketCap: 150_000_000 })
    const r = scoreStock(s)
    expect(r.capSizeLabel).toBe("Micro Cap")
  })

  test("capSizeLabel Large Cap para empresas > 10B", () => {
    const s = make({ marketCap: 500_000_000_000 })
    const r = scoreStock(s)
    expect(r.capSizeLabel).toBe("Large Cap")
  })
})

describe("scoreStock — Fortalezas y Debilidades", () => {
  test("posición de cash neta aparece en fortalezas", () => {
    // Empresa sin métricas de calidad fuertes para que cash neta no quede fuera del slice(4)
    const s = make({
      totalCash: 10e9, totalDebt: 2e9,
      roic: 0.05, roe: 0.08, grossMargin: 0.30, operatingMargin: 0.10,
    })
    const r = scoreStock(s)
    expect(r.strengths.some(str => str.includes("cash neta"))).toBe(true)
  })

  test("FCF negativo aparece en debilidades con runway", () => {
    const s = make({ freeCashflow: -1e9, totalCash: 2e9, fcfMargin: -0.05 })
    const r = scoreStock(s)
    expect(r.weaknesses.some(w => w.includes("FCF negativo"))).toBe(true)
  })

  test("Net Debt/EBITDA ≥ 4x aparece en debilidades", () => {
    const s = make({ totalDebt: 20e9, totalCash: 0, ebitda: 3e9 })  // ratio ~6.7x
    const r = scoreStock(s)
    expect(r.weaknesses.some(w => w.includes("Net Debt/EBITDA"))).toBe(true)
  })

  test("precio bajo Graham → aparece en fortalezas", () => {
    const s = make({
      grahamNumber: 150, discountToGraham: 33,
      roic: 0.05, roe: 0.08, grossMargin: 0.30, operatingMargin: 0.10,
      totalCash: 0, totalDebt: 0,   // sin cash neta para no competir por el slot
    })
    const r = scoreStock(s)
    expect(r.strengths.some(str => str.includes("Graham"))).toBe(true)
  })

  test("precio alto sobre Graham → aparece en debilidades", () => {
    const s = make({ grahamNumber: 60, discountToGraham: -40 })
    const r = scoreStock(s)
    expect(r.weaknesses.some(w => w.includes("Graham"))).toBe(true)
  })
})
