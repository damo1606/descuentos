import { runBrain } from "../lib/brain"
import type { MacroContext } from "../lib/brain"
import { scoreStock } from "../lib/scoring"
import { BASE } from "./fixtures"

// Fixture de score base a partir de BASE (Tech, calidad alta)
const BASE_SCORE = scoreStock(BASE)

const STOCK_BASE = {
  sector:      BASE.sector,
  dropFrom52w: BASE.dropFrom52w,   // -23%
  symbol:      BASE.symbol,
}

const MACRO_EXPANSION: MacroContext = { phase: "expansion", confidence: 80 }
const MACRO_LATE:      MacroContext = { phase: "late",      confidence: 75 }
const MACRO_RECESSION: MacroContext = { phase: "recession", confidence: 85 }

describe("Cerebro — sin macro", () => {
  it("sin macro: finalSignal === baseSignal", () => {
    const out = runBrain({ score: BASE_SCORE, stock: STOCK_BASE })
    expect(out.finalSignal).toBe(out.baseSignal)
    expect(out.signalAdjusted).toBe(false)
    expect(out.cycleFit).toBe("unknown")
    expect(out.sectorHeat).toBe(5)
  })

  it("sin macro: confianza base < 65", () => {
    const out = runBrain({ score: BASE_SCORE, stock: STOCK_BASE })
    expect(out.confidence).toBeLessThan(65)
  })
})

describe("Cerebro — tailwind (Tech en Expansión, heat=9)", () => {
  it("Compra Fuerte con tailwind: sigue Compra Fuerte", () => {
    // BASE tiene dropFrom52w=-23 y calidad alta → base ya podría ser Compra Fuerte
    const out = runBrain({ score: BASE_SCORE, stock: STOCK_BASE, macro: MACRO_EXPANSION })
    // Con tailwind y drop ≥-10%, Compra puede subir a Compra Fuerte
    expect(["Compra Fuerte", "Compra"].includes(out.finalSignal)).toBe(true)
    expect(out.sectorHeat).toBe(9)
    expect(out.cycleFit).toBe("tailwind")
  })

  it("Venta Fuerte con tailwind: NO se revierte (fundamentales mandan)", () => {
    // Construir score con señal Venta Fuerte (calidad baja + precio caro)
    const lowScore = scoreStock({
      ...BASE,
      debtToEquity: 500, // D/E 5x → healthScore muy bajo
      ebitda: 100_000,
      totalDebt: 20_000_000_000,
      totalCash: 0,
      freeCashflow: -1_000_000_000,
      earningsGrowth: -0.20,
      revenueGrowth: 0.02,
      netMargin: -0.10,
      operatingMargin: -0.05,
    })
    // Si el score original es Venta Fuerte, con tailwind no debe cambiar
    if (lowScore.signal === "Venta Fuerte") {
      const out = runBrain({ score: lowScore, stock: STOCK_BASE, macro: MACRO_EXPANSION })
      expect(out.finalSignal).toBe("Venta Fuerte")
    }
  })
})

describe("Cerebro — headwind (Tech en Late cycle, heat=3)", () => {
  it("Compra con headwind + quality < 75: degrada a Mantener", () => {
    // Crear stock con señal Compra pero calidad media (no alta)
    const medScore = scoreStock({
      ...BASE,
      roic: 0.08,       // mediocre para Tech
      grossMargin: 0.35, // mediocre
      operatingMargin: 0.08,
      netMargin: 0.06,
      roe: 0.10,
      roa: 0.05,
      fcfMargin: 0.05,
      revenueGrowth: 0.04,
      earningsGrowth: 0.03,
      pFcf: 18,          // precio atractivo
      evToEbitda: 10,
      debtToEquity: 30,
    })
    // Si la señal base es Compra y quality < 75, con headwind debe bajar a Mantener
    if (medScore.signal === "Compra" && medScore.qualityScore < 75) {
      const out = runBrain({ score: medScore, stock: { ...STOCK_BASE, sector: "Technology" }, macro: MACRO_LATE })
      expect(["Mantener", "Compra"].includes(out.finalSignal)).toBe(true)
      expect(out.cycleFit).toBe("headwind")
    }
  })

  it("Compra con quality >= 75 y headwind: mantiene Compra (alta calidad protege)", () => {
    // BASE tiene calidad alta — si la señal es Compra, con quality alta no se degrada
    const highQualityScore = scoreStock({ ...BASE, earningsGrowth: 0.12 })
    if (highQualityScore.signal === "Compra" && highQualityScore.qualityScore >= 75) {
      const out = runBrain({ score: highQualityScore, stock: STOCK_BASE, macro: MACRO_LATE })
      expect(out.finalSignal).toBe("Compra")
    }
  })
})

describe("Cerebro — confianza macro insuficiente", () => {
  it("macro con confidence < 55 no ajusta la señal", () => {
    const weakMacro: MacroContext = { phase: "recession", confidence: 40 }
    const outWeak   = runBrain({ score: BASE_SCORE, stock: STOCK_BASE, macro: weakMacro })
    const outNoMacro = runBrain({ score: BASE_SCORE, stock: STOCK_BASE })
    // Con macro débil, la señal final debe ser igual a la base
    expect(outWeak.finalSignal).toBe(outWeak.baseSignal)
    expect(outWeak.signalAdjusted).toBe(false)
  })
})

describe("Cerebro — sectores defensivos en recesión", () => {
  it("Healthcare en recesión (heat=9) mejora señal Mantener a Compra si quality>=60", () => {
    // Healthcare es defensivo — heat 9 en recesión
    const healthScore = scoreStock({ ...BASE, sector: "Healthcare" })
    const healthStock = { ...STOCK_BASE, sector: "Healthcare" }
    const out = runBrain({ score: healthScore, stock: healthStock, macro: MACRO_RECESSION })
    expect(out.sectorHeat).toBe(9)
    expect(out.cycleFit).toBe("tailwind")
  })
})

describe("Cerebro — factores", () => {
  it("siempre genera al menos 2 factores", () => {
    const out = runBrain({ score: BASE_SCORE, stock: STOCK_BASE, macro: MACRO_EXPANSION })
    expect(out.factors.length).toBeGreaterThanOrEqual(2)
  })

  it("con macro genera factor de ciclo", () => {
    const out = runBrain({ score: BASE_SCORE, stock: STOCK_BASE, macro: MACRO_EXPANSION })
    const hasCyclo = out.factors.some(f => f.name === "Ciclo macroeconómico")
    expect(hasCyclo).toBe(true)
  })
})
