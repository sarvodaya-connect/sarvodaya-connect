export default function Home() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Sarvodaya Connect
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">
          Administration Dashboard
        </h1>

        <p className="mt-4 text-lg leading-8 text-zinc-600">
          The technical dashboard foundation is running successfully. Client
          features will be added through separate Jira tasks after their user
          flows and designs are reviewed.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4">
            <dt className="text-sm text-zinc-500">Dashboard status</dt>
            <dd className="mt-1 font-medium text-zinc-950">Ready</dd>
          </div>

          <div className="rounded-xl bg-zinc-50 p-4">
            <dt className="text-sm text-zinc-500">API configuration</dt>
            <dd className="mt-1 break-all font-medium text-zinc-950">
              {apiBaseUrl ?? "Not configured"}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}