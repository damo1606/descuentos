"use client"

import { useState } from "react"
import type { StockSummary } from "@/lib/gurufocus"

const VALUATION_COLOR: Record<string, string> = {
  "Significantly Undervalued": "text-green-400",
  "Modestly Undervalued": "text-green-300",
  "Fairly Valued": "text-yellow-300",
  "Modestly Overvalued": "text-red-300",
  "Significantly Overvalued": "text-red-400",
}

function RankBadge({ value }: { value: number }) {
  const color =
    value >= 8 ? "bg-green-900 text-green-300" :
    value >= 5 ? "bg-yellow-900 text-yellow-300" :
    "bg-red-900 text-red-300"
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>
      {value}/10
    </span>
  )
}

export default function Home() {
  const [stocks, setStocks] = useState<StockSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [universe, setUniverse] = useState<"dia" | "sp500">("dia")
  const [minDiscount, setMinDiscount] = useState(-100)
  const [minGfScore, setMinGfScore] = useState(0)
  const [limit, setLimit] = useState(50)

  async function runScreener() {
    setLoading(true)
    setRan(false)
    try {
      const params = new URLSearchParams({
        universe,
        minDiscount: String(minDiscount),
        minGfScore: String(minGfScore),
        ...(universe === "sp500" ? { limit: String(limit) } : {}),
      })
      const res = await fetch(`/api/screener?${params}`)
      const data = await res.json()
      setStocks(data.stocks ?? [])
    } finally {
      setLoading(false)
      setRan(true)
    }
  }

  const universeLabel = universe === "dia"
    ? "Dow Jones 30 (DIA ETF)"
    : "S&P 500"

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Descuentos</h1>
          <p className="text-gray-400 mt-1">
            Acciones con descuento sobre su valor intrínseco — GuruFocus
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">

          {/* Universe */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Universo</label>
            <select
              value={universe}
              onChange={(e) => {
                setUniverse(e.target.value as "dia" | "sp500")
                setStocks([])
                setRan(false)
              }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="dia">Dow Jones 30 (DIA)</option>
              <option value="sp500">S&P 500</option>
            </select>
          </div>

          {/* Discount */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Descuento mínimo vs GF Value
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-100}
                max={50}
                value={minDiscount}
                onChange={(e) => setMinDiscount(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-white font-bold w-16">{minDiscount}%</span>
            </div>
          </div>

          {/* GF Score */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">GF Score mínimo</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={minGfScore}
                onChange={(e) => setMinGfScore(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-white font-bold w-10">{minGfScore}</span>
            </div>
          </div>

          {/* Limit — solo para SP500 */}
          {universe === "sp500" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Acciones a consultar
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          )}

          <button
            onClick={runScreener}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? "Consultando..." : "Ejecutar screener"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            Consultando GuruFocus — {universeLabel}...
          </div>
        )}

        {/* Empty */}
        {ran && !loading && stocks.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No se encontraron acciones con los filtros aplicados.
          </div>
        )}

        {/* Results */}
        {stocks.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mb-3">
              {stocks.length} acciones — {universeLabel} — ordenadas por descuento vs GF Value
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Empresa</th>
                    <th className="pb-2 pr-4">Sector</th>
                    <th className="pb-2 pr-4 text-right">Precio</th>
                    <th className="pb-2 pr-4 text-right">GF Value</th>
                    <th className="pb-2 pr-4 text-right">Descuento</th>
                    <th className="pb-2 pr-4">Valoración</th>
                    <th className="pb-2 pr-4 text-center">GF Score</th>
                    <th className="pb-2 pr-4 text-center">Fortaleza</th>
                    <th className="pb-2 pr-4 text-center">Rentab.</th>
                    <th className="pb-2 pr-4 text-center">Crec.</th>
                    <th className="pb-2 pr-4 text-right">ROIC</th>
                    <th className="pb-2 pr-4 text-right">P/E</th>
                    <th className="pb-2 text-right">D/E</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr
                      key={s.symbol}
                      className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-bold text-white">{s.symbol}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[140px]">
                          {s.company}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs max-w-[100px] truncate">
                        {s.sector}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">
                        {s.currency}{s.price.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-300">
                        {s.currency}{s.gf_value.toFixed(2)}
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold ${s.margin_gf_value >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {s.margin_gf_value >= 0 ? "+" : ""}{s.margin_gf_value.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs ${VALUATION_COLOR[s.gf_valuation] ?? "text-gray-400"}`}>
                          {s.gf_valuation}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center font-bold text-white">
                        {s.gf_score}
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <RankBadge value={s.rank_financial_strength} />
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <RankBadge value={s.rank_profitability} />
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <RankBadge value={s.rank_growth} />
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">
                        {s.roic.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">
                        {s.pe_ratio > 0 ? s.pe_ratio.toFixed(1) : "—"}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {s.debt2equity.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
