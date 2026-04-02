import type { StockData } from "./yahoo"
import { getSectorConfig } from "./sectors"

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

const OUT: [number, number, number, number] = [0, 25, 65, 100]

export type ScoreBreakdown = {
  // Tamaño de empresa
  capSizeLabel: "Micro Cap" | "Small Cap" | "Mid Cap" | "Large Cap"

  // Pilar 1: Eficiencia del Capital (30%)
  roicScore: number        // ROIC — métrica principal de retorno sobre capital
  roeScore: number         // ROE — referencia secundaria
  roaScore: number         // ROA — eficiencia sin efecto apalancamiento
  fcfMarginScore: number   // FCF / Revenue
  capitalScore: number     // 0-100

  // Pilar 2: Ventaja Competitiva / Moat (30%) — breakpoints sectoriales
  grossMarginScore: number
  operatingMarginScore: number
  netMarginScore: number
  moatScore: number        // 0-100

  // Contexto sectorial del moat
  sectorLabel: string      // Nombre del sector en español
  moatType: string         // Tipo de moat dominante
  capRange: string         // Rango de CAP típico del sector

  // Pilar 3: Solidez Financiera (20%)
  debtScore: number
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
  verdict: string
  strengths: string[]
  weaknesses: string[]

  // Dividendos (null si no paga)
  dividendScore: number | null
  dividendGrade: "Excelente" | "Bueno" | "Moderado" | "Débil" | "No aplica"
}

function scaleForCapSize(bp: [number, number, number, number], factor: number): [number, number, number, number] {
  return [bp[0] * factor, bp[1] * factor, bp[2] * factor, bp[3] * factor]
}

export function scoreStock(s: StockData): ScoreBreakdown {
  const sector = getSectorConfig(s.sector)

  // Cap size factor — small/micro caps tienen menos escala; reducimos exigencia de breakpoints
  const capFactor =
    s.marketCap > 0 && s.marketCap < 300e6  ? 0.70 :
    s.marketCap > 0 && s.marketCap < 2e9    ? 0.85 : 1.0

  const capSizeLabel: ScoreBreakdown["capSizeLabel"] =
    s.marketCap < 300e6  ? "Micro Cap" :
    s.marketCap < 2e9    ? "Small Cap" :
    s.marketCap < 10e9   ? "Mid Cap"   : "Large Cap"

  // Ajustar breakpoints de márgenes y ROIC para small/micro cap
  const adjSector = capFactor < 1 ? {
    ...sector,
    grossMarginBp:     scaleForCapSize(sector.grossMarginBp,     capFactor),
    operatingMarginBp: scaleForCapSize(sector.operatingMarginBp, capFactor),
    netMarginBp:       scaleForCapSize(sector.netMarginBp,       capFactor),
    roicBp:            scaleForCapSize(sector.roicBp,            capFactor),
    roeBp:             scaleForCapSize(sector.roeBp,             capFactor),
  } : sector

  // ── Pilar 1: Eficiencia del Capital ──────────────────────────────────────
  // ROIC: el mejor indicador de si el negocio crea valor económico real
  // ROIC > WACC → moat real. Breakpoints según sector (Damodaran)
  const roicScore = s.hasROIC ? clamp(lerp(s.roic * 100, adjSector.roicBp, OUT)) : 50

  // ROE: referencia secundaria — puede inflarse con deuda, por eso ROIC es primario
  const roeScore = clamp(lerp(s.roe * 100, adjSector.roeBp, OUT))

  // ROA: eficiencia usando todos los activos, sin trampa del apalancamiento
  const roaScore = clamp(lerp(s.roa * 100, [0, 5, 10, 18], OUT))

  // FCF Margin: cuánto cash real genera por cada dólar vendido
  const fcfMarginScore = clamp(lerp(s.fcfMargin * 100, [0, 8, 18, 28], OUT))

  const capitalScore = clamp(
    roicScore    * 0.45 +   // ROIC es el driver principal
    roaScore     * 0.30 +
    fcfMarginScore * 0.25
  )

  // ── Pilar 2: Ventaja Competitiva (Moat) — breakpoints sectoriales ─────────
  // Gross Margin: pricing power. Breakpoints distintos por sector (Damodaran)
  // Un retailer con 35% es excelente. Un SaaS con 35% es mediocre.
  const grossMarginScore = clamp(lerp(s.grossMargin * 100, adjSector.grossMarginBp, OUT))

  // Operating Margin: eficiencia operativa después de G&A y R&D
  const operatingMarginScore = clamp(lerp(s.operatingMargin * 100, adjSector.operatingMarginBp, OUT))

  // Net Margin: resultado final después de impuestos e intereses
  const netMarginScore = clamp(lerp(s.netMargin * 100, adjSector.netMarginBp, OUT))

  // Pesos también sectoriales — financieros: gross margin casi no importa
  const moatScore = clamp(
    grossMarginScore    * adjSector.grossMarginWeight +
    operatingMarginScore * adjSector.operatingMarginWeight +
    netMarginScore      * adjSector.netMarginWeight
  )

  // ── Pilar 3: Solidez Financiera ───────────────────────────────────────────
  const de = s.debtToEquity / 100
  const debtScore = clamp(lerp(-de, [-4, -2, -0.5, 0], [0, 20, 70, 100]))
  const healthScore = clamp(debtScore)

  // ── Pilar 4: Precio ───────────────────────────────────────────────────────
  const pfcfScore = s.pFcf > 0
    ? clamp(lerp(-s.pFcf, [-60, -30, -15, -5], [0, 20, 65, 100]))
    : 50

  const evEbitdaScore = s.evToEbitda > 0
    ? clamp(lerp(-s.evToEbitda, [-40, -20, -10, -5], [0, 20, 65, 100]))
    : 50

  const upsideScore = s.analystTarget > 0
    ? clamp(lerp(s.upsideToTarget, [-10, 0, 15, 35], [0, 20, 60, 100]))
    : 50

  const priceScore = clamp(
    pfcfScore    * 0.45 +
    evEbitdaScore * 0.35 +
    upsideScore  * 0.20
  )

  // ── Score Final ───────────────────────────────────────────────────────────
  const qualityScore = clamp(
    capitalScore * 0.375 +   // 30% del total
    moatScore    * 0.375 +   // 30% del total
    healthScore  * 0.25      // 20% del total
  )

  const finalScore = clamp(
    qualityScore * 0.80 +
    priceScore   * 0.20
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

  if (s.roic * 100 >= 15)          strengths.push(`ROIC ${(s.roic * 100).toFixed(0)}% — genera valor económico real por encima del costo de capital`)
  if (s.roe * 100 >= 20)           strengths.push(`ROE ${(s.roe * 100).toFixed(0)}% — retorno excepcional sobre patrimonio`)
  if (s.grossMargin * 100 >= 50)   strengths.push(`Margen bruto ${(s.grossMargin * 100).toFixed(0)}% — fuerte pricing power vs su sector`)
  if (s.fcfMargin * 100 >= 18)     strengths.push(`FCF margin ${(s.fcfMargin * 100).toFixed(0)}% — genera cash de forma consistente`)
  if (s.operatingMargin * 100 >= 22) strengths.push(`Margen operativo ${(s.operatingMargin * 100).toFixed(0)}% — eficiencia operativa alta`)
  if (de <= 0.5)                   strengths.push("Balance limpio — deuda muy baja")
  if (s.pFcf > 0 && s.pFcf < 15)  strengths.push(`P/FCF ${s.pFcf.toFixed(1)}x — precio atractivo vs flujo de caja`)
  if (s.upsideToTarget >= 20)      strengths.push(`+${s.upsideToTarget.toFixed(0)}% upside según analistas`)
  if (s.earningsGrowth * 100 >= 15) strengths.push(`Crecimiento EPS ${(s.earningsGrowth * 100).toFixed(0)}% — momentum de ganancias`)

  if (s.roic * 100 < 8 && s.roic > 0) weaknesses.push(`ROIC ${(s.roic * 100).toFixed(0)}% — posiblemente por debajo del costo de capital`)
  if (s.roe * 100 < 10)            weaknesses.push(`ROE ${(s.roe * 100).toFixed(0)}% — retorno bajo sobre patrimonio`)
  if (s.grossMargin * 100 < 30)    weaknesses.push(`Margen bruto ${(s.grossMargin * 100).toFixed(0)}% — sin poder de fijación de precios`)
  if (s.fcfMargin * 100 < 5)       weaknesses.push("FCF margin bajo — el negocio consume más cash del que genera")
  if (de > 2)                      weaknesses.push(`D/E ${de.toFixed(1)}x — deuda elevada, riesgo financiero`)
  if (s.pFcf > 30)                 weaknesses.push(`P/FCF ${s.pFcf.toFixed(1)}x — precio caro relativo a su FCF`)
  if (s.earningsGrowth * 100 < 0)  weaknesses.push("EPS decreciendo — el negocio está perdiendo tracción")
  if (s.netMargin * 100 < 5)       weaknesses.push(`Margen neto ${(s.netMargin * 100).toFixed(0)}% — márgenes muy ajustados`)

  // ── Dividendos ────────────────────────────────────────────────────────────
  let dividendScore: number | null = null
  let dividendGrade: ScoreBreakdown["dividendGrade"] = "No aplica"

  if (s.isDividendPayer) {
    const yieldVsAvg = s.fiveYearAvgYield > 0
      ? clamp(lerp(s.dividendYield / (s.fiveYearAvgYield / 100), [0.7, 0.9, 1.1, 1.4], OUT))
      : 50

    const payoutSafe = clamp(lerp(s.payoutRatio, [0, 0.35, 0.60, 0.85], [100, 75, 35, 0]))

    const fcfPayout = s.fcfPayoutRatio > 0
      ? clamp(lerp(s.fcfPayoutRatio, [0, 0.30, 0.60, 0.90], [100, 75, 35, 0]))
      : 50

    const ddmSignal = s.ddmValue > 0
      ? clamp(lerp(s.ddmDiscount, [-30, 0, 20, 50], OUT))
      : 50

    dividendScore = Math.round(clamp(
      yieldVsAvg * 0.20 +
      payoutSafe * 0.30 +
      fcfPayout  * 0.30 +
      ddmSignal  * 0.20
    ))

    dividendGrade =
      dividendScore >= 75 ? "Excelente" :
      dividendScore >= 55 ? "Bueno" :
      dividendScore >= 35 ? "Moderado" : "Débil"
  }

  // ── Veredicto ─────────────────────────────────────────────────────────────
  const verdict = buildVerdict(grade, capitalScore, moatScore, healthScore, priceScore, s)

  return {
    roicScore:            Math.round(roicScore),
    roeScore:             Math.round(roeScore),
    roaScore:             Math.round(roaScore),
    fcfMarginScore:       Math.round(fcfMarginScore),
    capitalScore:         Math.round(capitalScore),
    grossMarginScore:     Math.round(grossMarginScore),
    operatingMarginScore: Math.round(operatingMarginScore),
    netMarginScore:       Math.round(netMarginScore),
    moatScore:            Math.round(moatScore),
    capSizeLabel,
    sectorLabel:          sector.label,
    moatType:             sector.moatType,
    capRange:             sector.capRange,
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
    dividendScore,
    dividendGrade,
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
