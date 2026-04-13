import { NextRequest, NextResponse } from "next/server";
import { computeAnalysis } from "@/lib/gex";

// ── Yahoo Finance helpers (shared with /api/analysis) ─────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

async function getCredentials(): Promise<{ crumb: string; cookie: string }> {
  const res1 = await fetch("https://fc.yahoo.com", { headers: HEADERS, redirect: "follow" });
  const setCookie = res1.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const res2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...HEADERS, Cookie: cookie },
  });
  if (!res2.ok) throw new Error(`Could not get crumb (${res2.status})`);
  const crumb = await res2.text();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb response");
  return { crumb, cookie };
}

async function fetchOptions(ticker: string, cookie: string, crumb: string) {
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?crumb=${crumb}`;
  const res = await fetch(url, { headers: { ...HEADERS, Cookie: cookie }, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
  const json = await res.json();
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error(`No options data for ${ticker}`);
  return result;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConvictionRow {
  // Descuentos fundamental
  symbol: string;
  company: string;
  sector: string;
  buyScore: number;
  grade: string;
  currentPrice: number;
  dropFrom52w: number;
  grahamNumber: number;
  discountToGraham: number;
  upsideToTarget: number;
  pe: number;
  roe: number;
  // SORE M1
  institutionalPressure: number;
  netGex: number;
  support: number;
  resistance: number;
  gammaFlip: number;
  putCallRatio: number;
  // Combined
  convictionScore: number;
  verdict: "STRONG BUY" | "BUY" | "WATCH" | "NEUTRAL";
  soreBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  noOptions?: boolean;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function calcConviction(
  buyScore: number,
  institutionalPressure: number,
  support: number,
  resistance: number,
  spot: number
): number {
  const normalizedPressure = Math.max(0, institutionalPressure); // 0-100 (only bullish side)
  const confluenceBonus = support < spot && spot < resistance ? 100 : 0;
  return Math.min(
    100,
    buyScore * 0.5 + normalizedPressure * 0.3 + confluenceBonus * 0.2
  );
}

function toVerdict(score: number): ConvictionRow["verdict"] {
  if (score >= 75) return "STRONG BUY";
  if (score >= 60) return "BUY";
  if (score >= 45) return "WATCH";
  return "NEUTRAL";
}

function toSoreBias(pressure: number): ConvictionRow["soreBias"] {
  if (pressure > 25) return "BULLISH";
  if (pressure < -25) return "BEARISH";
  return "NEUTRAL";
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const universe = searchParams.get("universe") ?? "sp500";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 30);
  const minBuyScore = parseInt(searchParams.get("minBuyScore") ?? "50");

  // 1. Fetch fundamental screener data (internal call)
  let fundamentals: any[] = [];
  try {
    const base = new URL(request.url);
    const screenerUrl = `${base.origin}/api/screener?universe=${universe}&limit=${limit}`;
    const screenerRes = await fetch(screenerUrl, { cache: "no-store" });
    if (!screenerRes.ok) throw new Error("Screener fetch failed");
    const screenerJson = await screenerRes.json();
    fundamentals = screenerJson.stocks ?? [];
  } catch (e: any) {
    return NextResponse.json({ error: `Screener error: ${e.message}` }, { status: 500 });
  }

  // 2. Score and filter by minBuyScore
  const { scoreStock } = await import("@/lib/scoring");

  const scored = fundamentals
    .map((s: any) => ({ stock: s, score: scoreStock(s) }))
    .filter(({ score }) => score.buyScore >= minBuyScore)
    .sort((a, b) => b.score.buyScore - a.score.buyScore)
    .slice(0, limit);

  if (scored.length === 0) {
    return NextResponse.json({ rows: [], total: 0 });
  }

  // 3. Get Yahoo credentials once (shared across all tickers)
  let crumb = "";
  let cookie = "";
  try {
    ({ crumb, cookie } = await getCredentials());
  } catch (e: any) {
    return NextResponse.json({ error: `Yahoo auth error: ${e.message}` }, { status: 500 });
  }

  // 4. Fetch options + compute M1 for each ticker in parallel (batches of 10)
  const BATCH = 10;
  const rows: ConvictionRow[] = [];

  for (let i = 0; i < scored.length; i += BATCH) {
    const batch = scored.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async ({ stock, score }) => {
        try {
          const optData = await fetchOptions(stock.symbol, cookie, crumb);
          const spot: number = optData.quote?.regularMarketPrice ?? stock.currentPrice;
          const expirations: string[] = ((optData.expirationDates as number[]) ?? []).map(
            (ts) => new Date(ts * 1000).toISOString().split("T")[0]
          );
          const opts = optData.options?.[0];
          if (!opts) throw new Error("No options chain");

          const rawCalls = (opts.calls ?? []).map((c: any) => ({
            strike: c.strike ?? 0,
            impliedVolatility: c.impliedVolatility ?? 0,
            openInterest: c.openInterest ?? 0,
          }));
          const rawPuts = (opts.puts ?? []).map((p: any) => ({
            strike: p.strike ?? 0,
            impliedVolatility: p.impliedVolatility ?? 0,
            openInterest: p.openInterest ?? 0,
          }));

          const gex = computeAnalysis(
            stock.symbol,
            spot,
            expirations[0] ?? "",
            expirations,
            rawCalls,
            rawPuts
          );

          const convictionScore = calcConviction(
            score.buyScore,
            gex.institutionalPressure,
            gex.levels.support,
            gex.levels.resistance,
            spot
          );

          return {
            symbol: stock.symbol,
            company: stock.company,
            sector: stock.sector ?? "—",
            buyScore: score.buyScore,
            grade: score.grade,
            currentPrice: spot,
            dropFrom52w: stock.dropFrom52w ?? 0,
            grahamNumber: stock.grahamNumber ?? 0,
            discountToGraham: stock.discountToGraham ?? 0,
            upsideToTarget: stock.upsideToTarget ?? 0,
            pe: stock.pe ?? 0,
            roe: stock.roe ?? 0,
            institutionalPressure: gex.institutionalPressure,
            netGex: gex.netGex,
            support: gex.levels.support,
            resistance: gex.levels.resistance,
            gammaFlip: gex.levels.gammaFlip,
            putCallRatio: gex.putCallRatio,
            convictionScore: parseFloat(convictionScore.toFixed(1)),
            verdict: toVerdict(convictionScore),
            soreBias: toSoreBias(gex.institutionalPressure),
          } satisfies ConvictionRow;
        } catch {
          // Ticker has no liquid options — include with SORE fields zeroed
          const convictionScore = calcConviction(score.buyScore, 0, 0, 0, 0);
          return {
            symbol: stock.symbol,
            company: stock.company,
            sector: stock.sector ?? "—",
            buyScore: score.buyScore,
            grade: score.grade,
            currentPrice: stock.currentPrice ?? 0,
            dropFrom52w: stock.dropFrom52w ?? 0,
            grahamNumber: stock.grahamNumber ?? 0,
            discountToGraham: stock.discountToGraham ?? 0,
            upsideToTarget: stock.upsideToTarget ?? 0,
            pe: stock.pe ?? 0,
            roe: stock.roe ?? 0,
            institutionalPressure: 0,
            netGex: 0,
            support: 0,
            resistance: 0,
            gammaFlip: 0,
            putCallRatio: 0,
            convictionScore: parseFloat(convictionScore.toFixed(1)),
            verdict: toVerdict(convictionScore),
            soreBias: "NEUTRAL",
            noOptions: true,
          } satisfies ConvictionRow;
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") rows.push(r.value);
    }
  }

  rows.sort((a, b) => b.convictionScore - a.convictionScore);

  return NextResponse.json({ rows, total: rows.length });
}
