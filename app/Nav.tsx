"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-2.5">
      <div className="flex gap-1 flex-wrap">
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
      </div>
    </nav>
  )
}
