// Datos macroeconómicos reales desde FRED (Federal Reserve Economic Data)
// CSV endpoint público — no requiere API key
// https://fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES_ID

export type MacroIndicator = {
  value: number
  prev: number          // valor hace ~3 meses
  trend: "up" | "down" | "stable"
  label: string
  unit: string
  date: string
}

export type MacroData = {
  gdpGrowth:      MacroIndicator | null   // PIB YoY %
  inflation:      MacroIndicator | null   // CPI YoY %
  unemployment:   MacroIndicator | null   // Tasa de desempleo %
  fedRate:        MacroIndicator | null   // Fed Funds Rate %
  yieldCurve:     MacroIndicator | null   // T10Y2Y spread %
  fetchedAt:      string
}

export type Phase = "recovery" | "expansion" | "late" | "recession"

export type PhaseDetection = {
  phase: Phase
  confidence: number          // 0-100
  signals: string[]           // señales que determinaron la fase
  breakdown: Record<Phase, number>  // puntos por fase
}

async function fetchFredCsv(id: string): Promise<Array<{ date: string; value: number }>> {
  try {
    const since = new Date()
    since.setFullYear(since.getFullYear() - 3)
    const start = since.toISOString().split("T")[0]

    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&observation_start=${start}`,
      { next: { revalidate: 43200 } } // 12 horas
    )
    if (!res.ok) return []

    const text = await res.text()
    return text
      .trim()
      .split("\n")
      .slice(1)                           // saltar header
      .map(line => {
        const [date, raw] = line.split(",")
        const value = parseFloat(raw)
        return isNaN(value) ? null : { date: date.trim(), value }
      })
      .filter(Boolean) as Array<{ date: string; value: number }>
  } catch {
    return []
  }
}

function toIndicator(
  series: Array<{ date: string; value: number }>,
  label: string,
  unit: string
): MacroIndicator | null {
  if (series.length < 4) return null
  const last  = series[series.length - 1]
  const prev  = series[series.length - 4]  // ~3 meses atrás
  const delta = last.value - prev.value
  return {
    value:  last.value,
    prev:   prev.value,
    trend:  delta > 0.15 ? "up" : delta < -0.15 ? "down" : "stable",
    label,
    unit,
    date:   last.date,
  }
}

function yoyGrowth(series: Array<{ date: string; value: number }>): MacroIndicator | null {
  // GDP y CPI vienen en niveles — calculamos crecimiento YoY
  if (series.length < 13) return null
  const last     = series[series.length - 1]
  const yearAgo  = series[series.length - 5]   // 5 obs atrás para quarterly GDP
  const prevLast = series[series.length - 4]
  const prevYA   = series[series.length - 8]

  const current  = ((last.value - yearAgo.value) / yearAgo.value) * 100
  const previous = ((prevLast.value - prevYA.value) / prevYA.value) * 100
  const delta    = current - previous

  return {
    value:  parseFloat(current.toFixed(2)),
    prev:   parseFloat(previous.toFixed(2)),
    trend:  delta > 0.2 ? "up" : delta < -0.2 ? "down" : "stable",
    label:  "PIB Real",
    unit:   "% YoY",
    date:   last.date,
  }
}

function cpiYoy(series: Array<{ date: string; value: number }>): MacroIndicator | null {
  if (series.length < 14) return null
  const last     = series[series.length - 1]
  const yearAgo  = series[series.length - 13]
  const prevLast = series[series.length - 4]
  const prevYA   = series[series.length - 16] ?? series[0]

  const current  = ((last.value - yearAgo.value) / yearAgo.value) * 100
  const previous = ((prevLast.value - prevYA.value) / prevYA.value) * 100
  const delta    = current - previous

  return {
    value:  parseFloat(current.toFixed(2)),
    prev:   parseFloat(previous.toFixed(2)),
    trend:  delta > 0.2 ? "up" : delta < -0.2 ? "down" : "stable",
    label:  "Inflación (CPI)",
    unit:   "% YoY",
    date:   last.date,
  }
}

export async function fetchMacroData(): Promise<MacroData> {
  const [gdpSeries, cpiSeries, unrateSeries, fedSeries, t10y2ySeries] =
    await Promise.all([
      fetchFredCsv("GDPC1"),       // PIB real trimestral
      fetchFredCsv("CPIAUCSL"),    // CPI mensual
      fetchFredCsv("UNRATE"),      // Desempleo mensual
      fetchFredCsv("FEDFUNDS"),    // Fed Funds Rate mensual
      fetchFredCsv("T10Y2Y"),      // Yield curve diaria
    ])

  return {
    gdpGrowth:    yoyGrowth(gdpSeries),
    inflation:    cpiYoy(cpiSeries),
    unemployment: toIndicator(unrateSeries, "Desempleo", "%"),
    fedRate:      toIndicator(fedSeries,    "Fed Funds Rate", "%"),
    yieldCurve:   toIndicator(t10y2ySeries, "Curva 10Y-2Y", "%"),
    fetchedAt:    new Date().toISOString(),
  }
}

export function detectPhase(data: MacroData): PhaseDetection {
  const pts: Record<Phase, number> = { recovery: 0, expansion: 0, late: 0, recession: 0 }
  const signals: string[] = []

  const gdp   = data.gdpGrowth?.value   ?? null
  const cpi   = data.inflation?.value   ?? null
  const unemp = data.unemployment?.value ?? null
  const fed   = data.fedRate?.value     ?? null
  const yc    = data.yieldCurve?.value  ?? null

  // ── PIB ──────────────────────────────────────────────────────────────────
  if (gdp !== null) {
    if (gdp < 0)   { pts.recession += 3; signals.push(`PIB negativo ${gdp.toFixed(1)}% — contracción`) }
    else if (gdp < 1.5) { pts.recovery += 2; signals.push(`PIB bajo ${gdp.toFixed(1)}% — expansión débil`) }
    else if (gdp >= 2.5 && gdp < 4) { pts.expansion += 2; signals.push(`PIB sólido ${gdp.toFixed(1)}%`) }
    else if (gdp >= 4) { pts.late += 1; pts.expansion += 1; signals.push(`PIB muy fuerte ${gdp.toFixed(1)}% — posible sobrecalentamiento`) }
    else { pts.recovery += 1 }

    if (data.gdpGrowth?.trend === "down") { pts.late += 1; signals.push("PIB desacelerando — señal de ciclo tardío") }
    if (data.gdpGrowth?.trend === "up")   { pts.recovery += 1 }
  }

  // ── INFLACIÓN ────────────────────────────────────────────────────────────
  if (cpi !== null) {
    if (cpi > 5)   { pts.late += 3; signals.push(`Inflación alta ${cpi.toFixed(1)}% — señal de ciclo tardío`) }
    else if (cpi > 3) { pts.late += 1; pts.expansion += 1; signals.push(`Inflación moderada-alta ${cpi.toFixed(1)}%`) }
    else if (cpi < 1.5) { pts.recovery += 2; signals.push(`Inflación baja ${cpi.toFixed(1)}% — economía fría`) }
    else { pts.expansion += 1 }
  }

  // ── DESEMPLEO ────────────────────────────────────────────────────────────
  if (unemp !== null) {
    if (unemp > 6 && data.unemployment?.trend === "up")
      { pts.recession += 2; signals.push(`Desempleo ${unemp.toFixed(1)}% y subiendo`) }
    else if (unemp < 4.5 && data.unemployment?.trend !== "up")
      { pts.expansion += 2; signals.push(`Desempleo bajo ${unemp.toFixed(1)}% — mercado laboral fuerte`) }
    else if (data.unemployment?.trend === "down")
      { pts.recovery += 2; signals.push(`Desempleo mejorando ${unemp.toFixed(1)}% — recuperación en marcha`) }
    else if (unemp > 5)
      { pts.recession += 1 }
  }

  // ── FED RATE ─────────────────────────────────────────────────────────────
  if (fed !== null) {
    if (fed > 4.5) { pts.late += 2; signals.push(`Tasas altas ${fed.toFixed(2)}% — banco central restrictivo`) }
    else if (fed > 3) { pts.late += 1; pts.expansion += 1 }
    else if (fed < 1) { pts.recovery += 2; signals.push(`Tasas en mínimos ${fed.toFixed(2)}% — estímulo monetario`) }
    else if (data.fedRate?.trend === "down")
      { pts.recession += 1; signals.push("Fed bajando tasas — señal de alerta") }
    else if (data.fedRate?.trend === "up")
      { pts.expansion += 1; pts.late += 1 }
  }

  // ── YIELD CURVE ──────────────────────────────────────────────────────────
  if (yc !== null) {
    if (yc < -1.0) { pts.recession += 3; signals.push(`Curva fuertemente invertida ${yc.toFixed(2)}% — señal histórica de recesión`) }
    else if (yc < 0) { pts.late += 2; signals.push(`Curva invertida ${yc.toFixed(2)}% — mercado anticipa desaceleración`) }
    else if (yc < 0.5) { pts.late += 1; signals.push(`Curva plana ${yc.toFixed(2)}%`) }
    else if (yc > 1.5) { pts.recovery += 1; pts.expansion += 1; signals.push(`Curva positiva ${yc.toFixed(2)}% — entorno normal`) }
    else { pts.expansion += 1 }
  }

  // ── Determinar fase ───────────────────────────────────────────────────────
  const sorted = Object.entries(pts).sort(([, a], [, b]) => b - a) as [Phase, number][]
  const winner = sorted[0][0]
  const total  = Object.values(pts).reduce((a, b) => a + b, 0)
  const confidence = total > 0 ? Math.round((sorted[0][1] / total) * 100) : 50

  return { phase: winner, confidence, signals, breakdown: pts }
}
