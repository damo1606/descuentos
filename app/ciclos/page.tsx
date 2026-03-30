"use client"

import { useState } from "react"
import Link from "next/link"

type Phase = "recovery" | "expansion" | "late" | "recession"
type Rating = "strong" | "neutral" | "weak"

const PHASES: Record<Phase, {
  label: string
  labelShort: string
  color: string
  colorDim: string
  ring: string
  text: string
  badge: string
  border: string
  bg: string
  description: string
  indicators: string[]
  duration: string
  gdp: string
  rates: string
  unemployment: string
  inflation: string
}> = {
  recovery: {
    label: "Recuperación",
    labelShort: "Recup.",
    color: "#3b82f6",
    colorDim: "#1e3a5f",
    ring: "ring-blue-500",
    text: "text-blue-300",
    badge: "bg-blue-900/60 text-blue-200 border border-blue-800",
    border: "border-blue-800",
    bg: "bg-blue-950/40",
    description: "La economía sale de la recesión. GDP crece desde niveles bajos, el desempleo está alto pero mejorando y las tasas de interés en mínimos. El mercado anticipa la recuperación antes que los datos macroeconómicos lo confirmen.",
    indicators: ["GDP acelerando desde contracción", "Tasas de interés en mínimos históricos", "Crédito comenzando a expandirse", "Confianza del consumidor subiendo"],
    duration: "12–24 meses",
    gdp: "↑ Acelerando",
    rates: "↓ Mínimos",
    unemployment: "↓ Bajando",
    inflation: "→ Baja",
  },
  expansion: {
    label: "Expansión",
    labelShort: "Expans.",
    color: "#22c55e",
    colorDim: "#14532d",
    ring: "ring-green-500",
    text: "text-green-300",
    badge: "bg-green-900/60 text-green-200 border border-green-800",
    border: "border-green-800",
    bg: "bg-green-950/40",
    description: "La fase más larga del ciclo. GDP crece por encima de tendencia, empleo pleno, consumo fuerte e inversión empresarial alta. Los bancos centrales comienzan a subir tasas para controlar la inflación.",
    indicators: ["GDP sobre tendencia histórica", "Desempleo en mínimos del ciclo", "Inversión empresarial (capex) máxima", "Bancos centrales subiendo tasas"],
    duration: "24–60 meses",
    gdp: "↑↑ Fuerte",
    rates: "↑ Subiendo",
    unemployment: "→ Mínimos",
    inflation: "↑ Moderada",
  },
  late: {
    label: "Desaceleración",
    labelShort: "Desacel.",
    color: "#f59e0b",
    colorDim: "#78350f",
    ring: "ring-amber-500",
    text: "text-amber-300",
    badge: "bg-amber-900/60 text-amber-200 border border-amber-800",
    border: "border-amber-800",
    bg: "bg-amber-950/40",
    description: "El ciclo madura. GDP crece pero desacelera, inflación en máximos, tasas de interés en techo. Las empresas comienzan a ver compresión de márgenes por costos más altos. El mercado empieza a anticipar el enfriamiento.",
    indicators: ["Inflación en máximos del ciclo", "Tasas de interés en techo", "Márgenes corporativos comprimiéndose", "Inventarios acumulándose"],
    duration: "12–18 meses",
    gdp: "→ Desacelerando",
    rates: "→ En techo",
    unemployment: "→ Bajo pero estable",
    inflation: "↑↑ Alta",
  },
  recession: {
    label: "Recesión",
    labelShort: "Recesión",
    color: "#ef4444",
    colorDim: "#7f1d1d",
    ring: "ring-red-500",
    text: "text-red-300",
    badge: "bg-red-900/60 text-red-200 border border-red-800",
    border: "border-red-800",
    bg: "bg-red-950/40",
    description: "GDP negativo dos trimestres consecutivos o más. Desempleo subiendo rápido, consumo cayendo, crédito contrayéndose. Los bancos centrales bajan tasas agresivamente para estimular la economía.",
    indicators: ["GDP negativo (dos trimestres)", "Desempleo subiendo aceleradamente", "Crédito contrayéndose", "Bancos centrales bajando tasas agresivamente"],
    duration: "6–18 meses",
    gdp: "↓ Negativo",
    rates: "↓ Bajando",
    unemployment: "↑ Subiendo",
    inflation: "↓ Cayendo",
  },
}

type SectorCycle = {
  name: string
  emoji: string
  recovery: Rating
  expansion: Rating
  late: Rating
  recession: Rating
  note: string
}

const SECTORS: SectorCycle[] = [
  { name: "Servicios Financieros", emoji: "🏦",
    recovery: "strong",  expansion: "strong",  late: "neutral", recession: "weak",
    note: "Beneficia de tasas bajas, crédito expansivo y valuaciones de activos subiendo" },
  { name: "Consumo Discrecional",  emoji: "🛍️",
    recovery: "strong",  expansion: "strong",  late: "weak",    recession: "weak",
    note: "Directamente ligado al empleo y confianza del consumidor" },
  { name: "Industriales",          emoji: "⚙️",
    recovery: "strong",  expansion: "strong",  late: "neutral", recession: "weak",
    note: "El capex empresarial sigue al ciclo con cierto retraso" },
  { name: "Inmobiliario",          emoji: "🏢",
    recovery: "strong",  expansion: "neutral", late: "weak",    recession: "neutral",
    note: "Tasas bajas en recuperación impulsan las valuaciones inmobiliarias" },
  { name: "Tecnología",            emoji: "💻",
    recovery: "neutral", expansion: "strong",  late: "weak",    recession: "neutral",
    note: "Las valuaciones altas son vulnerables cuando las tasas suben" },
  { name: "Comunicaciones",        emoji: "📡",
    recovery: "neutral", expansion: "strong",  late: "neutral", recession: "neutral",
    note: "La publicidad digital sigue el ciclo económico" },
  { name: "Materiales",            emoji: "⛏️",
    recovery: "neutral", expansion: "strong",  late: "strong",  recession: "weak",
    note: "La demanda de commodities llega a su pico al final del ciclo" },
  { name: "Energía",               emoji: "⛽",
    recovery: "neutral", expansion: "neutral", late: "strong",  recession: "weak",
    note: "El precio del petróleo sube con la inflación en ciclo tardío" },
  { name: "Salud / Biotech",       emoji: "🧬",
    recovery: "neutral", expansion: "neutral", late: "strong",  recession: "strong",
    note: "Demanda inelástica — defensivo en cualquier entorno económico" },
  { name: "Consumo Básico",        emoji: "🛒",
    recovery: "weak",    expansion: "weak",    late: "strong",  recession: "strong",
    note: "Productos esenciales — protección en recesión y desaceleración" },
  { name: "Utilities",             emoji: "⚡",
    recovery: "weak",    expansion: "weak",    late: "neutral", recession: "strong",
    note: "Se comporta como bono largo — sube cuando las tasas bajan" },
]

const RATING = {
  strong:  { label: "Outperform", icon: "↑", cell: "bg-green-950/60 text-green-300 border-green-900/50",  dot: "bg-green-400" },
  neutral: { label: "Neutral",    icon: "→", cell: "bg-gray-900/60 text-gray-500 border-gray-800/50",      dot: "bg-gray-600" },
  weak:    { label: "Underperform",icon:"↓", cell: "bg-red-950/60 text-red-400 border-red-900/50",         dot: "bg-red-500" },
}

// SVG donut wheel — 4 segments, clockwise starting from top
// viewBox 0 0 300 300, center 150 150, R_outer=135, R_inner=70
const WHEEL_PATHS: Record<Phase, string> = {
  recovery:  "M 150 15 A 135 135 0 0 1 285 150 L 220 150 A 70 70 0 0 0 150 80 Z",
  expansion: "M 285 150 A 135 135 0 0 1 150 285 L 150 220 A 70 70 0 0 0 220 150 Z",
  late:      "M 150 285 A 135 135 0 0 1 15 150 L 80 150 A 70 70 0 0 0 150 220 Z",
  recession: "M 15 150 A 135 135 0 0 1 150 15 L 150 80 A 70 70 0 0 0 80 150 Z",
}

// Label positions at mid-radius (105) of each segment
const WHEEL_LABELS: Record<Phase, { x: number; y: number; anchor: string }> = {
  recovery:  { x: 224, y: 76,  anchor: "middle" },
  expansion: { x: 224, y: 224, anchor: "middle" },
  late:      { x: 76,  y: 224, anchor: "middle" },
  recession: { x: 76,  y: 76,  anchor: "middle" },
}

// Sector counts per phase for the wheel
function phaseSectorCount(phase: Phase, rating: Rating) {
  return SECTORS.filter(s => s[phase] === rating).length
}

export default function Ciclos() {
  const [active, setActive] = useState<Phase>("recovery")
  const phase = PHASES[active]

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Ciclos Económicos</h1>
            <p className="text-gray-400 text-sm mt-1">Rotación sectorial según la fase del ciclo — modelo Fidelity / Goldman Sachs</p>
          </div>
          <div className="flex gap-3 shrink-0 text-sm">
            <Link href="/sectores" className="text-gray-500 hover:text-gray-300 transition-colors">Sectores →</Link>
            <Link href="/parte1"   className="text-gray-500 hover:text-gray-300 transition-colors">Valoración →</Link>
            <Link href="/"         className="text-gray-500 hover:text-gray-300 transition-colors">Screener →</Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Wheel + Phase detail */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Wheel */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-4 text-center">Haz click en una fase para ver los detalles</p>

            <svg viewBox="0 0 300 300" className="w-full max-w-[260px]">
              {(["recovery","expansion","late","recession"] as Phase[]).map((p) => (
                <path
                  key={p}
                  d={WHEEL_PATHS[p]}
                  fill={active === p ? PHASES[p].color : PHASES[p].colorDim}
                  stroke="#030712"
                  strokeWidth="4"
                  className="cursor-pointer transition-all duration-200 hover:opacity-90"
                  onClick={() => setActive(p)}
                />
              ))}

              {/* Divider lines */}
              <line x1="150" y1="15"  x2="150" y2="80"  stroke="#030712" strokeWidth="4"/>
              <line x1="285" y1="150" x2="220" y2="150" stroke="#030712" strokeWidth="4"/>
              <line x1="150" y1="285" x2="150" y2="220" stroke="#030712" strokeWidth="4"/>
              <line x1="15"  y1="150" x2="80"  y2="150" stroke="#030712" strokeWidth="4"/>

              {/* Center circle */}
              <circle cx="150" cy="150" r="68" fill="#030712" stroke="#1f2937" strokeWidth="1"/>
              <text x="150" y="142" textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="monospace">CICLO</text>
              <text x="150" y="157" textAnchor="middle" fill="#374151" fontSize="22">↻</text>
              <text x="150" y="172" textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="monospace">ECONÓMICO</text>

              {/* Phase labels inside wheel */}
              {(["recovery","expansion","late","recession"] as Phase[]).map((p) => {
                const pos = WHEEL_LABELS[p]
                return (
                  <text
                    key={p}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    fill={active === p ? "#ffffff" : "#9ca3af"}
                    fontSize="9"
                    fontWeight={active === p ? "bold" : "normal"}
                    fontFamily="sans-serif"
                    className="cursor-pointer select-none"
                    onClick={() => setActive(p)}
                  >
                    {PHASES[p].labelShort}
                  </text>
                )
              })}
            </svg>

            {/* Phase buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4 w-full">
              {(["recovery","expansion","late","recession"] as Phase[]).map(p => (
                <button
                  key={p}
                  onClick={() => setActive(p)}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg transition-all border ${
                    active === p
                      ? `${PHASES[p].badge} ring-1 ring-offset-1 ring-offset-gray-900 ${PHASES[p].ring}`
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
                  }`}
                >
                  {PHASES[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Phase detail */}
          <div className={`lg:col-span-3 rounded-xl border p-5 space-y-4 ${phase.bg} ${phase.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-xl font-bold ${phase.text}`}>{phase.label}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Duración típica: {phase.duration}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${phase.badge}`}>
                {phaseSectorCount(active, "strong")} sectores outperform
              </span>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">{phase.description}</p>

            {/* Macro indicators */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "GDP",          value: phase.gdp },
                { label: "Tasas",        value: phase.rates },
                { label: "Desempleo",    value: phase.unemployment },
                { label: "Inflación",    value: phase.inflation },
              ].map(ind => (
                <div key={ind.label} className="bg-gray-900/60 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-600">{ind.label}</div>
                  <div className="text-sm font-semibold text-gray-200 mt-0.5">{ind.value}</div>
                </div>
              ))}
            </div>

            {/* Indicators list */}
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Señales clave</div>
              <ul className="space-y-1.5">
                {phase.indicators.map((ind, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className={`${phase.text} shrink-0 font-bold`}>▸</span>
                    {ind}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sectors en esta fase */}
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Sectores en esta fase</div>
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.filter(s => s[active] === "strong").map(s => (
                  <span key={s.name} className="text-xs bg-green-950/60 border border-green-900/50 text-green-300 px-2 py-0.5 rounded-full">
                    {s.emoji} {s.name}
                  </span>
                ))}
                {SECTORS.filter(s => s[active] === "weak").map(s => (
                  <span key={s.name} className="text-xs bg-red-950/60 border border-red-900/50 text-red-400 px-2 py-0.5 rounded-full">
                    {s.emoji} {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sector rotation matrix */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Matriz de Rotación Sectorial</h2>
            <p className="text-xs text-gray-500 mt-0.5">Comportamiento relativo de cada sector a lo largo del ciclo completo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold w-52">Sector</th>
                  {(["recovery","expansion","late","recession"] as Phase[]).map(p => (
                    <th key={p}
                      className={`px-4 py-3 text-xs font-semibold text-center cursor-pointer transition-colors ${
                        active === p ? PHASES[p].text : "text-gray-500 hover:text-gray-300"
                      }`}
                      onClick={() => setActive(p)}
                    >
                      {PHASES[p].label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold hidden lg:table-cell">
                    Por qué
                  </th>
                </tr>
              </thead>
              <tbody>
                {SECTORS.map(s => (
                  <tr key={s.name} className="border-b border-gray-800/60 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-200">{s.emoji} {s.name}</span>
                    </td>
                    {(["recovery","expansion","late","recession"] as Phase[]).map(p => {
                      const r = RATING[s[p]]
                      return (
                        <td key={p} className="px-2 py-3 text-center">
                          <span className={`inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1 rounded border ${r.cell} ${
                            active === p ? "ring-1 ring-offset-1 ring-offset-gray-900 ring-white/20" : ""
                          }`}>
                            <span>{r.icon}</span>
                            <span className="hidden sm:inline">{r.label}</span>
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell max-w-xs">
                      {s.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-800 flex flex-wrap gap-4">
            {Object.entries(RATING).map(([key, r]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${r.dot}`}/>
                <span>{r.icon} {r.label}</span>
              </div>
            ))}
            <span className="text-xs text-gray-700 ml-auto hidden lg:block">
              Basado en el modelo de rotación sectorial de Fidelity Investments / Goldman Sachs
            </span>
          </div>
        </div>

        {/* Nota metodológica */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">Nota metodológica:</strong> Este modelo representa el comportamiento <em>promedio</em> histórico de los sectores en cada fase del ciclo. Los ciclos no son idénticos — la duración, la intensidad y las condiciones específicas varían. En ciclos dominados por eventos exógenos (pandemias, guerras, crisis financieras) los patrones pueden desviarse significativamente. Usar como contexto general, no como señal de trading.
          </p>
        </div>

      </div>
    </main>
  )
}
