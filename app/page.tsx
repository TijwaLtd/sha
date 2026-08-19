import Link from "next/link"

export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">SHA Compliance</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Healthcare claims compliance screening platform
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
