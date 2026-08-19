import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { decrypt } from "@/lib/auth/session"

const publicRoutes = ["/login", "/"]
const hospitalRoutes = ["/hospital"]
const shaRoutes = ["/sha"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Check session cookie
  const sessionCookie = request.cookies.get("session")?.value
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Decrypt session (optimistic check - no DB call)
  const session = await decrypt(sessionCookie)
  if (!session?.userId) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Role-based route protection
  const isHospitalRoute = hospitalRoutes.some((route) =>
    pathname.startsWith(route)
  )
  const isShaRoute = shaRoutes.some((route) => pathname.startsWith(route))

  if (isHospitalRoute && session.role !== "HOSPITAL_USER") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  if (isShaRoute && session.role === "HOSPITAL_USER") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
