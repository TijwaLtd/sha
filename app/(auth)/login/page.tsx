import { LoginForm } from "./_components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">SHA Compliance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access the compliance platform
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>

        <div className="mt-6 rounded-lg border bg-muted/50 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Demo Accounts
          </p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <strong>Hospital:</strong> james@nairobigen.co.ke / password
            </p>
            <p>
              <strong>SHA Officer:</strong> sarah@sha.go.ke / password
            </p>
            <p>
              <strong>Admin:</strong> admin@sha.go.ke / password
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
