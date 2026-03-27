import type { StockData } from "./yahoo"

// Interpola linealmente entre breakpoints
function lerp(v: number, bp: [number, number, number, number], out: [number, number, number, number]): number {
  if (v <= bp[0]) return out[0]
  if (v >= bp[3]) return out[3]
  for (let i = 0; i < 3; i++) {
    if (v <= bp[i + 1]) {
      const t = (v - bp[i]) / (bp[i + 1] - bp[i])
      return out[i] + t * (out[i + 1] - out[i])
    }
  }
  return out[3]
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v))
}

export type ScoreBreakdown = {
  // Pilar 1: Eficiencia del Capital (30%)
  roeScore: number         // Retorno sobre patrimonio
  roaScore: number         // Retorno sobre activos
  fcfMarginScore: number   // FCF / Revenue
  capitalScore: number     // 0-100

  // Pilar 2: Ventaja Competitiva / Moat (30%)
  grossMarginScore: number    // Margen bruto — poder de fijación de precios
  operatingMarginScore: number
  netMarginScore: number
  moatScore: number        // 0-100

  // Pilar 3: Solidez Financiera (20%)
  debtScore: number        // Nivel de deuda
  healthScore: number      // 0-100

  // Pilar 4: Precio (20%)
  pfcfScore: number
  evEbitdaScore: number
  upsideScore: number
  priceScore: number       // 0-100

  // Totales
  qualityScore: number     // Pilar 1+2+3 (0-100)
  finalScore: number       // 80% quality + 20% price (0-100)
  grade: "A+" | "A" | "B" | "C" | "D" | "F"
  verdict: string          // Resumen en una línea
  strengths: string[]      // Puntos fuertes
  weaknesses: string[]     // Puntos débiles
}

export function scoreStock(s: StockData): ScoreBreakdown {
  // ── Pilar 1: Eficiencia del Capital ──────────────────────────────────────
  // ROE: cuánto retorno genera por cada dólar de patrimonio
  // > 20% = excelente (Buffett exige esto consistentemente)
  const roeScore = clamp(lerp(s.roe * 100, [0, 10, 20, 35], [0, 25, 65, 100]))

  // ROA: eficiencia usando todos los activos (no inflado por deuda)
  // > 10% = muy bueno, > 15% = excepcional
  const roaScore = clamp(lerp(s.roa * 100, [0, 5, 10, 18], [0, 25, 65, 100]))

  // FCF Margin: FCF / Revenue — cuánto cash real genera por cada dólar vendido
  // > 15% = excelente, > 25% = negocio extraordinario
  const fcfMarginScore = clamp(lerp(s.fcfMargin * 100, [0, 8, 18, 28], [0, 25, 65, 100]))

  const capitalScore = clamp(
    roeScore * 0.40 +
    roaScore * 0.35 +
    fcfMarginScore * 0.25
  )

  // ── Pilar 2: Ventaja Competitiva (Moat) ──────────────────────────────────
  // Gross Margin: el indicador #1 de moat — si puedes cobrar más que tus costos
  // < 30% = commodity, 40-60% = bueno, > 60% = excepcional (Apple, MSFT, Visa)
  const grossMarginScore = clamp(lerp(s.grossMargin * 100, [15, 30, 50, 70], [0, 25, 65, 100]))

  // Operating Margin: eficiencia operativa después de G&A
  // > 20% = muy bueno, > 30% = excepcional
  const operatingMarginScore = clamp(lerp(s.operatingMargin * 100, [0, 10, 22, 35], [0, 25, 65, 100]))

  // Net Margin: resultado final
  const netMarginScore = clamp(lerp(s.netMargin * 100, [0, 8, 18, 30], [0, 25, 65, 100]))

  const moatScore = clamp(
    grossMarginScore * 0.45 +
    operatingMarginScore * 0.35 +
    netMarginScore * 0.20
  )

  // ── Pilar 3: Solidez Financiera ───────────────────────────────────────────
  // D/E ratio: deuda/patrimonio — más bajo es mejor
  // Yahoo lo reporta en %, dividimos entre 100
  const de = s.debtToEquity / 100
  const debtScore = clamp(lerp(-de, [-4, -2, -0.5, 0], [0, 20, 70, 100]))

  const healthScore = clamp(debtScore)

  // ── Pilar 4: Precio ───────────────────────────────────────────────────────
  // P/FCF: precio vs flujo de caja libre — el ratio más honesto
  // < 15 = barato, < 10 = muy barato, > 30 = caro para lo que ofrece
  const pfcfScore = s.pFcf > 0
    ? clamp(lerp(-s.pFcf, [-60, -30, -15, -5], [0, 20, 65, 100]))
    : 50 // Sin dato, neutral

  // EV/EBITDA: valoración sobre el negocio operativo sin efectos de deuda
  // < 12 = atractivo, < 8 = muy barato, > 25 = caro
  const evEbitdaScore = s.evToEbitda > 0
    ? clamp(lerp(-s.evToEbitda, [-40, -20, -10, -5], [0, 20, 65, 100]))
    : 50

  // Upside a analistas: el consenso de Wall Street
  const upsideScore = clamp(lerp(s.upsideToTarget, [-10, 0, 15, 35], [0, 20, 60, 100]))

  const priceScore = clamp(
    pfcfScore * 0.45 +
    evEbitdaScore * 0.35 +
    upsideScore * 0.20
  )

  // ── Score Final ───────────────────────────────────────────────────────────
  const qualityScore = clamp(
    capitalScore * 0.375 +   // 30% del total
    moatScore    * 0.375 +   // 30% del total
    healthScore  * 0.25      // 20% del total
  )

  const finalScore = clamp(
    qualityScore * 0.80 +    // 80% calidad
    priceScore   * 0.20      // 20% precio
  )

  // ── Grade ─────────────────────────────────────────────────────────────────
  const grade =
    finalScore >= 85 ? "A+" :
    finalScore >= 70 ? "A"  :
    finalScore >= 55 ? "B"  :
    finalScore >= 40 ? "C"  :
    finalScore >= 25 ? "D"  : "F"

  // ── Fortalezas y debilidades ──────────────────────────────────────────────
  const strengths: string[] = []
  const weaknesses: string[] = []

  if (s.roe * 100 >= 20)           strengths.push(`ROE ${(s.roe * 100).toFixed(0)}% — retorno excepcional sobre patrimonio`)
  if (s.grossMargin * 100 >= 50)   strengths.push(`Margen bruto ${(s.grossMargin * 100).toFixed(0)}% — fuerte poder de fijación de precios`)
  if (s.fcfMargin * 100 >= 18)     strengths.push(`FCF margin ${(s.fcfMargin * 100).toFixed(0)}% — genera cash de forma consistente`)
  if (s.operatingMargin * 100 >= 22) strengths.push(`Margen operativo ${(s.operatingMargin * 100).toFixed(0)}% — eficiencia operativa alta`)
  if (de <= 0.5)                   strengths.push("Balance limpio — deuda muy baja")
  if (s.pFcf > 0 && s.pFcf < 15)  strengths.push(`P/FCF ${s.pFcf.toFixed(1)}x — precio atractivo vs flujo de caja`)
  if (s.upsideToTarget >= 20)      strengths.push(`+${s.upsideToTarget.toFixed(0)}% upside según analistas`)
  if (s.earningsGrowth * 100 >= 15) strengths.push(`Crecimiento EPS ${(s.earningsGrowth * 100).toFixed(0)}% — momentum de ganancias`)

  if (s.roe * 100 < 10)            weaknesses.push(`ROE ${(s.roe * 100).toFixed(0)}% — retorno bajo sobre patrimonio`)
  if (s.grossMargin * 100 < 30)    weaknesses.push(`Margen bruto ${(s.grossMargin * 100).toFixed(0)}% — sin poder de fijación de precios`)
  if (s.fcfMargin * 100 < 5)       weaknesses.push("FCF margin bajo — el negocio consume más cash del que genera")
  if (de > 2)                      weaknesses.push(`D/E ${de.toFixed(1)}x — deuda elevada, riesgo financiero`)
  if (s.pFcf > 30)                 weaknesses.push(`P/FCF ${s.pFcf.toFixed(1)}x — precio caro relativo a su FCF`)
  if (s.earningsGrowth * 100 < 0)  weaknesses.push("EPS decreciendo — el negocio está perdiendo tracción")
  if (s.netMargin * 100 < 5)       weaknesses.push(`Margen neto ${(s.netMargin * 100).toFixed(0)}% — márgenes muy ajustados`)

  // ── Veredicto ─────────────────────────────────────────────────────────────
  const verdict = buildVerdict(grade, capitalScore, moatScore, healthScore, priceScore, s)

  return {
    roeScore:             Math.round(roeScore),
    roaScore:             Math.round(roaScore),
    fcfMarginScore:       Math.round(fcfMarginScore),
    capitalScore:         Math.round(capitalScore),
    grossMarginScore:     Math.round(grossMarginScore),
    operatingMarginScore: Math.round(operatingMarginScore),
    netMarginScore:       Math.round(netMarginScore),
    moatScore:            Math.round(moatScore),
    debtScore:            Math.round(debtScore),
    healthScore:          Math.round(healthScore),
    pfcfScore:            Math.round(pfcfScore),
    evEbitdaScore:        Math.round(evEbitdaScore),
    upsideScore:          Math.round(upsideScore),
    priceScore:           Math.round(priceScore),
    qualityScore:         Math.round(qualityScore),
    finalScore:           Math.round(finalScore),
    grade,
    verdict,
    strengths:  strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 3),
  }
}

function buildVerdict(
  grade: string,
  capital: number,
  moat: number,
  health: number,
  price: number,
  s: StockData
): string {
  if (grade === "A+" || grade === "A") {
    if (price >= 60) return "Negocio excepcional a precio atractivo — el tipo de empresa que buscan los mejores fondos."
    return "Negocio de alta calidad. El precio no es barato, pero la calidad justifica la prima."
  }
  if (grade === "B") {
    if (moat >= 65) return "Negocio sólido con ventaja competitiva visible. Esperar mejor punto de entrada."
    if (capital >= 65) return "Genera buen retorno sobre el capital. Revisar sostenibilidad del moat."
    return "Empresa decente pero sin ventajas competitivas claras. Requiere análisis más profundo."
  }
  if (grade === "C") {
    if (health < 40) return "Deuda elevada compromete la calidad del negocio. Alto riesgo."
    if (moat < 35)  return "Sin ventaja competitiva clara — vulnerable a la competencia y ciclos económicos."
    return "Métricas promedio. No cumple el estándar mínimo de calidad para un fondo serio."
  }
  if (s.earningsGrowth < -0.05) return "Negocio en deterioro — EPS cayendo. Evitar hasta ver estabilización."
  return "No cumple los criterios de calidad mínimos. El precio bajo no compensa las debilidades estructurales."
}
