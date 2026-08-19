import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-destructive">403</h1>
        <p className="mt-2 text-lg">Unauthorized Access</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to access this page.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
