"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { StockData } from "@/lib/yahoo"
import { scoreStock } from "@/lib/scoring"
import type { ScoreBreakdown } from "@/lib/scoring"
import { analyzeForward } from "@/lib/forward"
import type { ForwardAnalysis } from "@/lib/forward"

type FullData = StockData & { score: ScoreBreakdown; forward: ForwardAnalysis }

function pct(v: number, dec = 1) { return `${v >= 0 ? "+" : ""}${v.toFixed(dec)}%` }
function usd(v: number) { return v > 0 ? `$${v.toFixed(2)}` : "—" }
function fmt(v: number, dec = 1) { return v !== 0 ? v.toFixed(dec) : "—" }

function GradeBadge({ grade }: { grade: string }) {
  const color =
    grade === "A+" ? "bg-emerald-500" :
    grade === "A"  ? "bg-green-600" :
    grade === "B"  ? "bg-blue-600" :
    grade === "C"  ? "bg-yellow-600" :
    grade === "D"  ? "bg-orange-600" :
    "bg-red-800"
  return <span className={`${color} text-white text-sm font-black px-3 py-1 rounded-lg`}>{grade}</span>
}

function PillarBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const color = value >= 70 ? "bg-green-500" : value >= 45 ? "bg-yellow-500" : "bg-red-500"
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label} <span className="text-gray-600">({weight})</span></span>
        <span className={`font-bold ${value >= 70 ? "text-green-400" : value >= 45 ? "text-yellow-400" : "text-red-400"}`}>{value}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function MetricRow({ label, value, good }: { label: string; value: string; good?: boolean | null }) {
  const color = good == null ? "text-gray-300" : good ? "text-green-400" : "text-red-400"
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

export default function EmpresaPage() {
  const params = useParams()
  const symbol = (params.symbol as string).toUpperCase()
  const [data, setData] = useState<FullData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/stock/${symbol}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: StockData) => setData({ ...d, score: scoreStock(d), forward: analyzeForward(d) }))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 flex items-center justify-center">
      <div className="text-gray-400">Cargando {symbol}...</div>
    </main>
  )

  if (error || !data) return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 flex items-center justify-center">
      <div className="text-red-400">No se pudo obtener datos para {symbol}.</div>
    </main>
  )

  const { score, forward } = data
  const de = data.debtToEquity / 100

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-white">{data.symbol}</h1>
                <GradeBadge grade={score.grade} />
              </div>
              <div className="text-gray-300 text-lg">{data.company}</div>
              <div className="text-gray-500 text-sm mt-1">{data.sector} · {data.industry}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-white">${data.currentPrice.toFixed(2)}</div>
              <div className="text-sm text-gray-400 font-mono mt-1">
                Máx 52w: ${data.high52w.toFixed(2)}
                <span className={`ml-2 font-bold ${data.dropFrom52w <= -20 ? "text-green-400" : "text-yellow-300"}`}>
                  {data.dropFrom52w.toFixed(1)}%
                </span>
              </div>
              {data.analystTarget > 0 && (
                <div className="text-sm text-gray-400 mt-0.5">
                  Target: ${data.analystTarget.toFixed(2)}
                  <span className={`ml-2 font-bold ${data.upsideToTarget >= 20 ? "text-green-400" : "text-yellow-300"}`}>
                    {pct(data.upsideToTarget)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buy Ready banner */}
        {score.buyReady && (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-emerald-400 text-lg font-black">Compra</span>
            <span className="text-emerald-300 text-sm">Buy Score <strong>{score.buyScore}</strong> — calidad, precio y descuento de mercado confluyen</span>
          </div>
        )}

        {/* Veredicto */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <p className="text-gray-300 text-sm">{score.verdict}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {score.strengths.map((s, i) => (
              <span key={i} className="text-xs bg-green-900/40 text-green-300 border border-green-800/50 px-2 py-1 rounded">✓ {s}</span>
            ))}
            {score.weaknesses.map((w, i) => (
              <span key={i} className="text-xs bg-red-900/40 text-red-300 border border-red-800/50 px-2 py-1 rounded">✗ {w}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Scoring de calidad */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Calidad del Negocio</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">{score.finalScore}</span>
                <GradeBadge grade={score.grade} />
              </div>
            </div>
            <div className="space-y-3">
              <PillarBar label="Eficiencia del Capital" value={score.capitalScore} weight="30%" />
              <PillarBar label="Ventaja Competitiva" value={score.moatScore} weight="30%" />
              <PillarBar label="Solidez Financiera" value={score.healthScore} weight="20%" />
              <PillarBar label="Precio / Valoración" value={score.priceScore} weight="20%" />
            </div>
            <div className="mt-3 text-xs text-gray-600">{score.sectorLabel} · {score.moatType} · CAP {score.capRange}</div>
            {(score.capSizeLabel === "Micro Cap" || score.capSizeLabel === "Small Cap") && (
              <div className="mt-1 text-xs font-semibold text-yellow-400">{score.capSizeLabel} — breakpoints ajustados</div>
            )}
          </div>

          {/* Prospectiva */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Prospectiva</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">{forward.forwardScore}</span>
                <span className={`text-sm font-black px-2 py-0.5 rounded ${
                  forward.forwardGrade === "A+" ? "bg-emerald-500 text-white" :
                  forward.forwardGrade === "A"  ? "bg-green-600 text-white" :
                  forward.forwardGrade === "B"  ? "bg-blue-600 text-white" :
                  forward.forwardGrade === "C"  ? "bg-yellow-600 text-white" :
                  "bg-orange-600 text-white"
                }`}>{forward.forwardGrade}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Etapa</span>
                <span style={{ color: forward.growthStageColor }} className="font-semibold">{forward.growthStageLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Earnings</span>
                <span style={{ color: forward.earningsDirectionColor }} className="font-semibold">{forward.earningsDirectionLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Apal. operativo</span>
                <span className="text-gray-300 font-semibold">{forward.operatingLeverageLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Señal moat</span>
                <span style={{ color: forward.capSignalColor }} className="font-semibold">{forward.capSignalLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Riesgo disrupción</span>
                <span className={`font-semibold ${forward.disruption.risk >= 4 ? "text-red-400" : forward.disruption.risk >= 3 ? "text-yellow-400" : "text-green-400"}`}>
                  {forward.disruption.label} ({forward.disruption.risk}/5)
                </span>
              </div>
            </div>
            {forward.signals.length > 0 && (
              <div className="mt-3 space-y-1">
                {forward.signals.slice(0, 3).map((s, i) => (
                  <div key={i} className="text-xs text-gray-500">· {s}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Métricas clave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Valoración */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Valoración</h2>
            <MetricRow label="P/E (trailing)" value={data.pe > 0 ? data.pe.toFixed(1) : "—"} />
            <MetricRow label="P/E (forward)" value={data.forwardPe > 0 ? data.forwardPe.toFixed(1) : "—"} />
            <MetricRow label="P/B" value={data.pb > 0 ? data.pb.toFixed(1) : "—"} />
            <MetricRow label="EV/EBITDA" value={data.evToEbitda > 0 ? data.evToEbitda.toFixed(1) : "—"} />
            <MetricRow label="P/FCF" value={data.pFcf > 0 ? data.pFcf.toFixed(1) : "—"} good={data.pFcf > 0 && data.pFcf < 20} />
            <MetricRow label="Graham #" value={data.grahamNumber > 0 ? usd(data.grahamNumber) : "—"} />
            <MetricRow label="vs Graham" value={data.grahamNumber > 0 ? pct(data.discountToGraham) : "—"} good={data.grahamNumber > 0 ? data.discountToGraham >= 0 : null} />
          </div>

          {/* Rentabilidad */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Rentabilidad</h2>
            <MetricRow label="ROIC" value={data.roic > 0 ? pct(data.roic * 100) : "—"} good={data.roic > 0.12} />
            <MetricRow label="ROE" value={data.roe !== 0 ? pct(data.roe * 100) : "—"} good={data.roe >= 0.15} />
            <MetricRow label="ROA" value={data.roa !== 0 ? pct(data.roa * 100) : "—"} good={data.roa >= 0.08} />
            <MetricRow label="Margen bruto" value={data.grossMargin !== 0 ? pct(data.grossMargin * 100) : "—"} good={data.grossMargin >= 0.4} />
            <MetricRow label="Margen operativo" value={data.operatingMargin !== 0 ? pct(data.operatingMargin * 100) : "—"} good={data.operatingMargin >= 0.15} />
            <MetricRow label="Margen neto" value={data.netMargin !== 0 ? pct(data.netMargin * 100) : "—"} good={data.netMargin >= 0.1} />
            <MetricRow label="FCF Margin" value={data.fcfMargin !== 0 ? pct(data.fcfMargin * 100) : "—"} good={data.fcfMargin >= 0.1} />
          </div>

          {/* Crecimiento y balance */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Crecimiento y Balance</h2>
            <MetricRow label="Crec. ingresos" value={data.revenueGrowth !== 0 ? pct(data.revenueGrowth * 100) : "—"} good={data.revenueGrowth >= 0.08} />
            <MetricRow label="Crec. EPS" value={data.earningsGrowth !== 0 ? pct(data.earningsGrowth * 100) : "—"} good={data.earningsGrowth >= 0.1} />
            <MetricRow label="D/E" value={de !== 0 ? de.toFixed(2) : "—"} good={de <= 1} />
            <MetricRow label="Market Cap" value={data.marketCap > 1e9 ? `$${(data.marketCap / 1e9).toFixed(1)}B` : data.marketCap > 1e6 ? `$${(data.marketCap / 1e6).toFixed(0)}M` : "—"} />
            <MetricRow label="Beta" value={data.beta !== 0 ? data.beta.toFixed(2) : "—"} good={data.beta < 1.2} />
            {data.isDividendPayer && <>
              <MetricRow label="Dividendo" value={data.dividendYield > 0 ? pct(data.dividendYield) : "—"} good={data.dividendYield > 0} />
              <MetricRow label="Payout ratio" value={data.payoutRatio > 0 ? pct(data.payoutRatio * 100) : "—"} good={data.payoutRatio < 0.6} />
            </>}
          </div>
        </div>

      </div>
    </main>
  )
}
