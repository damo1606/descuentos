"use client"

import { useState } from "react"
import type { StockResult } from "@/app/api/screener/route"

const VALUATION_COLOR: Record<string, string> = {
  "Significantly Undervalued": "text-green-400",
  "Modestly Undervalued":      "text-green-300",
  "Fairly Valued":             "text-yellow-300",
  "Modestly Overvalued":       "text-red-300",
  "Significantly Overvalued":  "text-red-400",
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

function DropBadge({ value }: { value: number }) {
  const color =
    value <= -30 ? "text-green-400" :
    value <= -15 ? "text-yellow-300" :
                   "text-gray-400"
  return (
    <span className={`font-bold font-mono ${color}`}>
      {value.toFixed(1)}%
    </span>
  )
}

export default function Home() {
  const [stocks, setStocks] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)
  const [universe, setUniverse] = useState<"dia" | "sp500">("dia")
  const [minDrop, setMinDrop] = useState(-100)
  const [minGfScore, setMinGfScore] = useState(0)
  const [limit, setLimit] = useState(50)

  async function runScreener() {
    setLoading(true)
    setRan(false)
    setStocks([])
    try {
      const params = new URLSearchParams({
        universe,
        minDrop: String(minDrop),
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

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Descuentos</h1>
          <p className="text-gray-400 mt-1">
            Empresas de calidad castigadas por el mercado — Yahoo Finance + GuruFocus
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 flex flex-wrap gap-6 items-end">

          <div>
            <label className="block text-xs text-gray-400 mb-1">Universo</label>
            <select
              value={universe}
              onChange={(e) => { setUniverse(e.target.value as "dia" | "sp500"); setStocks([]); setRan(false) }}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="dia">Dow Jones 30 (DIA)</option>
              <option value="sp500">S&P 500</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Caída mínima desde ATH
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={-80} max={0} step={5}
                value={minDrop}
                onChange={(e) => setMinDrop(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-white font-bold w-16">{minDrop}%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">GF Score mínimo</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={100} step={5}
                value={minGfScore}
                onChange={(e) => setMinGfScore(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-white font-bold w-10">{minGfScore}</span>
            </div>
          </div>

          {universe === "sp500" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Acciones a consultar</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              >
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
            {loading ? "Consultando..." : "Buscar descuentos"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 text-gray-400">
            Consultando Yahoo Finance + GuruFocus...
          </div>
        )}

        {/* Sin resultados */}
        {ran && !loading && stocks.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No se encontraron empresas con los filtros aplicados.
          </div>
        )}

        {/* Tabla */}
        {stocks.length > 0 && (
          <>
            <div className="text-sm text-gray-400 mb-3">
              {stocks.length} empresas — ordenadas por mayor caída desde ATH
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Empresa</th>
                    <th className="pb-2 pr-4">Sector</th>
                    <th className="pb-2 pr-4 text-right">Precio</th>
                    <th className="pb-2 pr-4 text-right">ATH</th>
                    <th className="pb-2 pr-4 text-right">Caída ATH</th>
                    <th className="pb-2 pr-4 text-right">GF Value</th>
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
                    <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-bold text-white">{s.symbol}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[140px]">{s.company}</div>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs max-w-[100px] truncate">{s.sector}</td>
                      <td className="py-3 pr-4 text-right font-mono">${s.currentPrice.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-400">
                        <div>${s.ath.toFixed(2)}</div>
                        <div className="text-xs text-gray-600">{s.athDate}</div>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <DropBadge value={s.dropFromAth} />
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-gray-300">${s.gfValue.toFixed(2)}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs ${VALUATION_COLOR[s.gfValuation] ?? "text-gray-400"}`}>
                          {s.gfValuation}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-center font-bold text-white">{s.gfScore}</td>
                      <td className="py-3 pr-4 text-center"><RankBadge value={s.rankFinancialStrength} /></td>
                      <td className="py-3 pr-4 text-center"><RankBadge value={s.rankProfitability} /></td>
                      <td className="py-3 pr-4 text-center"><RankBadge value={s.rankGrowth} /></td>
                      <td className="py-3 pr-4 text-right font-mono">{s.roic.toFixed(1)}%</td>
                      <td className="py-3 pr-4 text-right font-mono">{s.peRatio > 0 ? s.peRatio.toFixed(1) : "—"}</td>
                      <td className="py-3 text-right font-mono">{s.debtToEquity.toFixed(2)}</td>
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
