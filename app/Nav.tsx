"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "./ThemeProvider"

type NavPage = { href: string; label: string; exact?: true }

const PAGES: NavPage[] = [
  { href: "/ciclos",      label: "Ciclos",       exact: true },
  { href: "/sectores",    label: "Sectores",     exact: true },
  { href: "/",            label: "Screener",     exact: true },
  { href: "/parte1",      label: "Valoración",   exact: true },
  { href: "/prospectiva", label: "Prospectiva",  exact: true },
  { href: "/portafolio",  label: "Portafolio",   exact: true },
  { href: "/senales",     label: "Señales",      exact: true },
  { href: "/scanner-pro", label: "Scanner Pro",  exact: true },
]

const SORE_PAGES: NavPage[] = [
  { href: "/gex",            label: "GEX" },
  { href: "/scanner",        label: "Scanner" },
  { href: "/rotacion",       label: "Rotación" },
  { href: "/gex/portafolio", label: "GEX Portfolio" },
]

const SORE_PREFIXES = SORE_PAGES.map(p => p.href)

function isSorePath(path: string) {
  return SORE_PREFIXES.some(p => path === p || path.startsWith(p + "/"))
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
    }`}>
      {label}
    </Link>
  )
}

function WallDropdown({ inSore, pathname }: { inSore: boolean; pathname: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
          inSore
            ? "bg-emerald-800 text-emerald-200"
            : "text-emerald-700 hover:text-emerald-400 hover:bg-gray-800/60"
        }`}
      >
        <span className="tracking-[0.15em] font-bold">WALL</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12" height="12"
          viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          {SORE_PAGES.map(p => {
            const active = pathname === p.href || pathname.startsWith(p.href + "/")
            return (
              <Link
                key={p.href}
                href={p.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-800/60 text-emerald-200"
                    : "text-emerald-700 hover:text-emerald-400 hover:bg-gray-800/60"
                }`}
              >
                {p.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Nav() {
  const path = usePathname()
  const { theme, toggle } = useTheme()
  const inSore = isSorePath(path)

  const logout = useCallback(async () => {
    sessionStorage.removeItem("sore_active")
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }, [])

  useEffect(() => {
    if (!inSore) return
    const IDLE_MS = 30 * 60 * 1000
    if (!sessionStorage.getItem("sore_active")) { logout(); return }
    let timer = setTimeout(logout, IDLE_MS)
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, IDLE_MS) }
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const
    events.forEach(e => window.addEventListener(e, reset))
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [inSore, logout])

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-2.5">
      <div className="flex gap-1 flex-wrap items-center">
        {inSore && (
          <span className="text-emerald-400 font-bold text-sm tracking-[0.3em] mr-2 select-none">
            SORE
          </span>
        )}

        {PAGES.map(p => {
          const active = p.exact ? path === p.href : path === p.href || path.startsWith(p.href + "/")
          return <NavItem key={p.href} href={p.href} label={p.label} active={active} />
        })}

        <span className="text-gray-700 text-xs mx-1">|</span>
        <WallDropdown inSore={inSore} pathname={path} />

        <button
          onClick={toggle}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-colors"
        >
          {theme === "dark" ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
        </button>

        {inSore && (
          <button
            onClick={logout}
            className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest text-white bg-red-700 hover:bg-red-600 transition-colors"
          >
            CERRAR SESIÓN
          </button>
        )}
      </div>
    </nav>
  )
}
