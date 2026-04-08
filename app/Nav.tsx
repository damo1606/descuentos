"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "./ThemeProvider"

const PAGES = [
  { href: "/ciclos",      label: "Ciclos" },
  { href: "/sectores",    label: "Sectores" },
  { href: "/",            label: "Screener" },
  { href: "/parte1",      label: "Valoración" },
  { href: "/prospectiva", label: "Prospectiva" },
  { href: "/portafolio",  label: "Portafolio" },
]

export function Nav() {
  const path = usePathname()
  const { theme, toggle } = useTheme()

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-2.5">
      <div className="flex gap-1 flex-wrap items-center">
        {PAGES.map(p => {
          const active = p.href === "/" ? path === "/" : path === p.href
          return (
            <Link key={p.href} href={p.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/60"
              }`}>
              {p.label}
            </Link>
          )
        })}

        <button
          onClick={toggle}
          title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 transition-colors"
        >
          {theme === "dark" ? (
            // Sol — cambiar a claro
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            // Luna — cambiar a oscuro
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
        </button>
      </div>
    </nav>
  )
}
