import { analyzeForward } from "../lib/forward"
import { make } from "./fixtures"

describe("analyzeForward — Etapa de Crecimiento", () => {
  test("revenue > 20% → hypercrecimiento", () => {
    const r = analyzeForward(make({ revenueGrowth: 0.25 }))
    expect(r.growthStage).toBe("hypercrecimiento")
  })

  test("revenue 12% → expansion", () => {
    const r = analyzeForward(make({ revenueGrowth: 0.12 }))
    expect(r.growthStage).toBe("expansion")
  })

  test("revenue 6% → madurez", () => {
    const r = analyzeForward(make({ revenueGrowth: 0.06 }))
    expect(r.growthStage).toBe("madurez")
  })

  test("revenue 2% → estancamiento", () => {
    const r = analyzeForward(make({ revenueGrowth: 0.02 }))
    expect(r.growthStage).toBe("estancamiento")
  })

  test("revenue negativo → declive", () => {
    const r = analyzeForward(make({ revenueGrowth: -0.05 }))
    expect(r.growthStage).toBe("declive")
  })
})

describe("analyzeForward — Dirección de Earnings", () => {
  test("forward P/E mucho menor que trailing + crecimiento fuerte → acelerando", () => {
    const r = analyzeForward(make({
      pe: 30,
      forwardPe: 20,          // PE ratio 1.5 > 1.15
      earningsGrowth: 0.25,
      earningsQuarterlyGrowth: 0.30,
    }))
    expect(r.earningsDirection).toBe("acelerando")
  })

  test("earnings positivos moderados → creciendo", () => {
    const r = analyzeForward(make({
      pe: 22,
      forwardPe: 20,
      earningsGrowth: 0.10,
      earningsQuarterlyGrowth: 0.12,
    }))
    expect(r.earningsDirection).toBe("creciendo")
  })

  test("earnings cayendo con forward P/E mayor → contrayendo", () => {
    const r = analyzeForward(make({
      pe: 15,
      forwardPe: 22,          // forward mayor = mercado anticipa caída
      earningsGrowth: -0.15,
      earningsQuarterlyGrowth: -0.18,
    }))
    expect(r.earningsDirection).toBe("contrayendo")
  })
})

describe("analyzeForward — Apalancamiento Operativo", () => {
  test("earnings crecen más rápido que revenue → positivo", () => {
    const r = analyzeForward(make({ earningsGrowth: 0.25, revenueGrowth: 0.10 }))
    expect(r.operatingLeverage).toBe("positivo")
  })

  test("earnings crecen mucho más lento que revenue → negativo (márgenes comprimidas)", () => {
    const r = analyzeForward(make({ earningsGrowth: 0.02, revenueGrowth: 0.20 }))
    expect(r.operatingLeverage).toBe("negativo")
  })

  test("earnings y revenue crecen igual → neutro", () => {
    const r = analyzeForward(make({ earningsGrowth: 0.10, revenueGrowth: 0.10 }))
    expect(r.operatingLeverage).toBe("neutro")
  })

  test("revenue y earnings negativos → negativo", () => {
    const r = analyzeForward(make({ earningsGrowth: -0.10, revenueGrowth: -0.05 }))
    expect(r.operatingLeverage).toBe("negativo")
  })
})

describe("analyzeForward — CAP Signal", () => {
  test("ROIC alto + márgenes expandiéndose + crecimiento → fortaleciendo", () => {
    const r = analyzeForward(make({
      roic: 0.30,                   // muy por encima del threshold
      earningsGrowth: 0.25,
      revenueGrowth: 0.15,          // diff > 0.03 → marginExpanding
      sector: "Technology",
    }))
    expect(r.capSignal).toBe("fortaleciendo")
  })

  test("ROIC bajo + earnings cayendo → debilitando", () => {
    const r = analyzeForward(make({
      roic: 0.05,
      earningsGrowth: -0.10,
      revenueGrowth: 0.05,
      sector: "Technology",
    }))
    expect(r.capSignal).toBe("debilitando")
  })
})

describe("analyzeForward — Disruption Profile", () => {
  test("sector Technology → disruption profile definido", () => {
    const r = analyzeForward(make({ sector: "Technology" }))
    expect(r.disruption.threats.length).toBeGreaterThan(0)
    expect(r.disruption.opportunities.length).toBeGreaterThan(0)
  })

  test("Consumer Defensive → riesgo bajo (1 o 2)", () => {
    const r = analyzeForward(make({ sector: "Consumer Staples" }))
    expect(r.disruption.risk).toBeLessThanOrEqual(2)
  })

  test("Energy → riesgo alto (4)", () => {
    const r = analyzeForward(make({ sector: "Energy" }))
    expect(r.disruption.risk).toBeGreaterThanOrEqual(4)
  })

  test("sector desconocido → DEFAULT_DISRUPTION con risk 3", () => {
    const r = analyzeForward(make({ sector: "Alien Industry" }))
    expect(r.disruption.risk).toBe(3)
    expect(r.disruption.threats[0]).toContain("Sin datos sectoriales")
  })
})

describe("analyzeForward — Forward Score y Grade", () => {
  test("empresa en hypercrecimiento acelerando → forwardScore alto", () => {
    const r = analyzeForward(make({
      revenueGrowth: 0.30,
      earningsGrowth: 0.40,
      earningsQuarterlyGrowth: 0.45,
      pe: 35,
      forwardPe: 22,
      roic: 0.28,
      sector: "Technology",
    }))
    expect(r.forwardScore).toBeGreaterThan(75)
    expect(["A", "A+"]).toContain(r.forwardGrade)
  })

  test("empresa en declive contrayendo → forwardScore bajo", () => {
    const r = analyzeForward(make({
      revenueGrowth: -0.10,
      earningsGrowth: -0.20,
      earningsQuarterlyGrowth: -0.25,
      pe: 10,
      forwardPe: 18,
      roic: 0.04,
      sector: "Energy",
    }))
    expect(r.forwardScore).toBeLessThan(35)
    expect(r.forwardGrade).toBe("D")
  })

  test("analyzeForward no crashea con datos vacíos", () => {
    const s = make({
      revenueGrowth: 0, earningsGrowth: 0, earningsQuarterlyGrowth: 0,
      pe: 0, forwardPe: 0, roic: 0,
    })
    expect(() => analyzeForward(s)).not.toThrow()
  })

  test("forwardScore está entre 0 y 100", () => {
    const cases = [
      make({ revenueGrowth: 0.50, earningsGrowth: 0.60 }),
      make({ revenueGrowth: -0.50, earningsGrowth: -0.60 }),
      make({ revenueGrowth: 0, earningsGrowth: 0 }),
    ]
    for (const s of cases) {
      const r = analyzeForward(s)
      expect(r.forwardScore).toBeGreaterThanOrEqual(0)
      expect(r.forwardScore).toBeLessThanOrEqual(100)
    }
  })
})
