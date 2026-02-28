"use client"

import { useState } from "react"

export default function Home() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query) return
    setLoading(true)

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const data = await res.json()

    setResults(data.results || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-6">
      <div className="mx-auto max-w-3xl pt-28 text-center">
        <img
          src="/Girl_Robot_Handshake.png"
          alt="Logo"
          className="mx-auto mb-8 h-36"
        />

        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          AI Ecosystem Glossary Builder
        </h1>

        <p className="mt-3 text-lg text-zinc-500">
          Robots teaching Humans about Robots and Humans
        </p>

        <div className="mt-10">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search companies, models, infrastructure..."
            className="w-full rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-lg shadow-sm outline-none transition focus:border-black"
          />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-4xl space-y-6">
        {loading && (
          <p className="text-center text-zinc-500">Searching...</p>
        )}

        {results.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-zinc-900">
                {item.canonical_name}
              </h2>

              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  item.confidence === "high"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.confidence === "medium"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {item.confidence}
              </span>
            </div>

            <p className="mt-3 text-zinc-600">
              {item.summary}
            </p>

            <div className="mt-4 text-sm text-zinc-400">
              Similarity: {item.similarity?.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
