interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-medium">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
