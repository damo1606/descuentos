import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

// Rutas de SORE que requieren autenticación (solo páginas, no APIs — WALL modal las usa sin sesión)
const SORE_PROTECTED = [
  "/gex",
  "/scanner",
  "/rotacion",
];

function isSoreProtected(pathname: string): boolean {
  return SORE_PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas de auth públicas — siempre permitir
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Solo proteger rutas de SORE
  if (!isSoreProtected(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
