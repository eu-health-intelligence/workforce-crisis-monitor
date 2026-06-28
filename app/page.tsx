'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts'

import { StatusBadge } from '@/components/StatusBadge'
import { MetricCard } from '@/components/MetricCard'
import { ForecastBar } from '@/components/ForecastBar'
import { COUNTRIES } from '@/lib/countries'
import type { CountryWorkforceScored } from '@/lib/eurostat'

type SortKey =
  | 'totalPhysicians'
  | 'retirementCliffScore'
  | 'pipelineRatio'
  | 'shortageRisk'

type View = 'table' | 'chart'

const RISK_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
  LOW: 3,
  UNKNOWN: 4,
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MODERATE: '#ca8a04',
  LOW: '#16a34a',
  UNKNOWN: '#64748b',
}

function fmt(v: number | null, dp = 1) {
  return v !== null && v !== undefined ? v.toFixed(dp) : '—'
}

function RiskDot({ risk }: { risk: string }) {
  return (
    <span
      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: RISK_COLORS[risk] ?? RISK_COLORS.UNKNOWN }}
    />
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
      <div className="mb-2 font-semibold text-slate-900">{label}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.name} className="flex justify-between gap-8">
            <span className="text-slate-500">{p.name}</span>
            <span className="font-semibold text-slate-900">
              {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState<CountryWorkforceScored[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string>('')
  const [syncedAt, setSyncedAt] = useState<string | null>(null)

  const [selected, setSelected] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('shortageRisk')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [view, setView] = useState<View>('table')
  const [filterRisk, setFilterRisk] = useState<string>('ALL')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/workforce')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json.data)
        setSource(json.source)
        setSyncedAt(json.syncedAt)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function triggerSync() {
    setSyncing(true)

    try {
      const res = await fetch('/api/sync/workforce', { method: 'GET' })
      const json = await res.json()

      if (json.success) {
        const d = await fetch('/api/workforce').then((r) => r.json())
        setData(d.data)
        setSource(d.source)
        setSyncedAt(d.syncedAt)
      }
    } finally {
      setSyncing(false)
    }
  }

  const sorted = useMemo(() => {
    let rows = [...data]

    if (filterRisk !== 'ALL') {
      rows = rows.filter((r) => r.shortageRisk === filterRisk)
    }

    rows.sort((a, b) => {
      if (sortKey === 'shortageRisk') {
        return (
          sortDir *
          (RISK_ORDER[a.shortageRisk] - RISK_ORDER[b.shortageRisk])
        )
      }

      const av = a[sortKey] ?? -Infinity
      const bv = b[sortKey] ?? -Infinity

      return sortDir * ((av as number) - (bv as number))
    })

    return rows
  }, [data, sortKey, sortDir, filterRisk])

  const selectedCountry = data.find((d) => d.code === selected)

  const criticalCount = data.filter((d) => d.shortageRisk === 'CRITICAL').length
  const highCount = data.filter((d) => d.shortageRisk === 'HIGH').length

  const avgCliff = data.filter((d) => d.retirementCliffScore !== null)
  const avgCliffScore = avgCliff.length
    ? Math.round(
        avgCliff.reduce((s, d) => s + d.retirementCliffScore!, 0) /
          avgCliff.length
      )
    : null

  const cliffChartData = [...data]
    .filter((d) => d.retirementCliffScore !== null)
    .sort((a, b) => b.retirementCliffScore! - a.retirementCliffScore!)
    .slice(0, 20)
    .map((d) => ({
      name: d.code,
      cliff: d.retirementCliffScore,
      pipeline: d.pipelineRatio,
      risk: d.shortageRisk,
    }))

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k

    return (
      <th
        className="cursor-pointer select-none px-4 py-4 text-left text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        onClick={() => handleSort(k)}
      >
        {label}
        {active && (
          <span className="ml-2 text-slate-400">
            {sortDir === 1 ? 'Asc' : 'Desc'}
          </span>
        )}
      </th>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-3 text-base font-semibold text-slate-900">
            Loading workforce data
          </div>
          <div className="text-sm text-slate-500">
            Fetching the latest Eurostat indicators.
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-2 text-lg font-semibold text-red-700">
            Failed to load data
          </div>
          <div className="text-sm text-slate-500">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-5">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-500">
              Eurostat · EU/EEA Healthcare Workforce Intelligence
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              European Physician Workforce Crisis Monitor
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-slate-400">
                Data source
              </div>
              <div className="text-sm font-semibold text-slate-700">
                {source === 'database'
                  ? 'Supabase cache'
                  : source === 'curated'
                    ? 'Eurostat 2023'
                    : 'Live Eurostat'}
              </div>
              {syncedAt && (
                <div className="text-xs text-slate-400">
                  {new Date(syncedAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <button
              onClick={triggerSync}
              disabled={syncing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              {syncing ? 'Refreshing' : 'Refresh data'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-8 px-6 py-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Countries tracked"
            value={data.length}
            unit="EU/EEA states"
            accent="#2563eb"
          />
          <MetricCard
            label="Critical risk"
            value={criticalCount}
            unit="countries"
            sub="Immediate intervention needed"
            accent="#dc2626"
          />
          <MetricCard
            label="High risk"
            value={highCount}
            unit="countries"
            sub="Monitoring required"
            accent="#ea580c"
          />
          <MetricCard
            label="Avg retirement cliff"
            value={avgCliffScore}
            unit="% over 55"
            sub="EU median"
            accent="#ca8a04"
          />
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {(['table', 'chart'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  view === v
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {v === 'table' ? 'Country table' : 'Charts'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRisk(r)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  filterRisk === r
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {r === 'ALL'
                  ? 'All'
                  : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        <section
          className={`grid gap-6 ${
            selected ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1'
          }`}
        >
          <div className={selected ? 'xl:col-span-2' : 'col-span-1'}>
            {view === 'table' ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-4 text-left text-sm font-semibold text-slate-500">
                        Country
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-500">
                        Risk
                      </th>
                      <SortHeader
                        label="Physicians /100k"
                        k="totalPhysicians"
                      />
                      <SortHeader label="Cliff %" k="retirementCliffScore" />
                      <SortHeader label="Pipeline" k="pipelineRatio" />
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-500">
                        10-year outlook
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sorted.map((country) => {
                      const meta = COUNTRIES[country.code]

                      return (
                        <tr
                          key={country.code}
                          className={`country-row ${
                            selected === country.code ? 'selected' : ''
                          }`}
                          onClick={() =>
                            setSelected(
                              selected === country.code ? null : country.code
                            )
                          }
                        >
                          <td className="px-5 py-4">
                            <div className="text-base font-semibold text-slate-900">
                              {meta?.name ?? country.code}
                            </div>
                            <div className="mt-1 text-sm text-slate-400">
                              {meta?.region ?? ''}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge risk={country.shortageRisk} />
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                            {fmt(country.totalPhysicians)}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      country.retirementCliffScore ?? 0,
                                      100
                                    )}%`,
                                    background:
                                      (country.retirementCliffScore ?? 0) > 40
                                        ? '#dc2626'
                                        : '#ca8a04',
                                  }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-600">
                                {fmt(country.retirementCliffScore, 0)}%
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-slate-600">
                            {fmt(country.pipelineRatio)}
                          </td>

                          <td className="px-4 py-4">
                            {country.projectedShortfall10yr !== null ? (
                              <span
                                className="text-sm font-semibold"
                                style={{
                                  color:
                                    country.projectedShortfall10yr > 0
                                      ? '#dc2626'
                                      : '#16a34a',
                                }}
                              >
                                {country.projectedShortfall10yr > 0
                                  ? 'Shortfall'
                                  : 'Surplus'}{' '}
                                {Math.abs(country.projectedShortfall10yr)}%
                              </span>
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-400">
                  {sorted.length} countries shown. Select a row to view the
                  country profile.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-lg font-bold text-slate-900">
                      Retirement cliff score
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Share of physicians aged 55 and older.
                    </p>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={cliffChartData}
                      margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="#e2e8f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'Inter',
                        }}
                      />
                      <YAxis
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'Inter',
                        }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="cliff" name="% over 55" radius={[6, 6, 0, 0]}>
                        {cliffChartData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={RISK_COLORS[d.risk] ?? RISK_COLORS.UNKNOWN}
                            opacity={0.9}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-lg font-bold text-slate-900">
                      Pipeline ratio vs retirement cliff
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Relationship between replacement capacity and retirement
                      pressure.
                    </p>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart
                      margin={{ top: 10, right: 20, bottom: 10, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="cliff"
                        name="Retirement cliff %"
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'Inter',
                        }}
                      />
                      <YAxis
                        dataKey="pipeline"
                        name="Pipeline ratio"
                        tick={{
                          fill: '#64748b',
                          fontSize: 12,
                          fontFamily: 'Inter',
                        }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload

                          return (
                            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
                              <div className="mb-1 font-bold text-slate-900">
                                {d.name}
                              </div>
                              <div className="text-slate-500">
                                Cliff: {d.cliff?.toFixed(1)}%
                              </div>
                              <div className="text-slate-500">
                                Pipeline: {d.pipeline?.toFixed(1)}
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={cliffChartData}>
                        {cliffChartData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={RISK_COLORS[d.risk] ?? RISK_COLORS.UNKNOWN}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>

                  <div className="mt-4 flex flex-wrap gap-5">
                    {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map((r) => (
                      <div
                        key={r}
                        className="flex items-center text-sm font-medium text-slate-500"
                      >
                        <RiskDot risk={r} />
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {selected && selectedCountry && (
            <aside className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 border-b border-slate-200 pb-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 text-sm font-medium text-slate-400">
                      {COUNTRIES[selected]?.region ?? ''} Europe
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                      {COUNTRIES[selected]?.name ?? selected}
                    </h2>
                  </div>

                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    Close
                  </button>
                </div>

                <StatusBadge risk={selectedCountry.shortageRisk} />
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <MetricCard
                  label="Physicians"
                  value={
                    selectedCountry.totalPhysicians !== null
                      ? selectedCountry.totalPhysicians.toFixed(1)
                      : null
                  }
                  unit="per 100k"
                  accent="#2563eb"
                />
                <MetricCard
                  label="Graduates"
                  value={
                    selectedCountry.medicalGraduates !== null
                      ? selectedCountry.medicalGraduates.toFixed(1)
                      : null
                  }
                  unit="per 100k"
                  accent="#0891b2"
                />
                <MetricCard
                  label="Under 35"
                  value={
                    selectedCountry.physiciansUnder35 !== null
                      ? selectedCountry.physiciansUnder35.toFixed(1)
                      : null
                  }
                  unit="per 100k"
                  accent="#7c3aed"
                />
                <MetricCard
                  label="Over 55"
                  value={
                    selectedCountry.physiciansOver55 !== null
                      ? selectedCountry.physiciansOver55.toFixed(1)
                      : null
                  }
                  unit="per 100k"
                  accent="#ea580c"
                />
              </div>

              <div className="mb-6">
                <h3 className="mb-3 text-base font-bold text-slate-900">
                  Workforce sustainability indicators
                </h3>
                <ForecastBar
                  retirementCliff={selectedCountry.retirementCliffScore}
                  pipelineRatio={selectedCountry.pipelineRatio}
                  shortfall10yr={selectedCountry.projectedShortfall10yr}
                />
              </div>

              {(() => {
                const totalRows = data.filter((d) => d.totalPhysicians)
                const cliffRows = data.filter((d) => d.retirementCliffScore)
                const pipeRows = data.filter((d) => d.pipelineRatio)

                const avgTotal =
                  totalRows.reduce((s, d) => s + d.totalPhysicians!, 0) /
                  totalRows.length

                const avgCliffR =
                  cliffRows.reduce((s, d) => s + d.retirementCliffScore!, 0) /
                  cliffRows.length

                const avgPipe =
                  pipeRows.reduce((s, d) => s + d.pipelineRatio!, 0) /
                  pipeRows.length

                const radarData = [
                  {
                    metric: 'Density',
                    country: Math.round(
                      ((selectedCountry.totalPhysicians ?? 0) /
                        (avgTotal || 1)) *
                        50
                    ),
                    eu: 50,
                  },
                  {
                    metric: 'Pipeline',
                    country: Math.round(
                      ((selectedCountry.pipelineRatio ?? 0) / (avgPipe || 1)) *
                        50
                    ),
                    eu: 50,
                  },
                  {
                    metric: 'Young docs',
                    country: Math.round(
                      ((selectedCountry.physiciansUnder35 ?? 0) /
                        (selectedCountry.totalPhysicians || 1)) *
                        100
                    ),
                    eu: 25,
                  },
                  {
                    metric: 'Cliff risk',
                    country: Math.max(
                      0,
                      100 - (selectedCountry.retirementCliffScore ?? 50)
                    ),
                    eu: Math.max(0, 100 - (avgCliffR || 40)),
                  },
                ]

                return (
                  <div className="mb-6">
                    <h3 className="mb-3 text-base font-bold text-slate-900">
                      Compared with EU average
                    </h3>

                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                          dataKey="metric"
                          tick={{
                            fill: '#64748b',
                            fontSize: 12,
                            fontFamily: 'Inter',
                          }}
                        />
                        <Radar
                          name={COUNTRIES[selected]?.name}
                          dataKey="country"
                          stroke="#2563eb"
                          fill="#2563eb"
                          fillOpacity={0.14}
                        />
                        <Radar
                          name="EU average"
                          dataKey="eu"
                          stroke="#94a3b8"
                          fill="#94a3b8"
                          fillOpacity={0.12}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}

              <div className="border-t border-slate-200 pt-5">
                <h3 className="mb-2 text-base font-bold text-slate-900">
                  System interpretation
                </h3>
                <p className="text-sm leading-7 text-slate-600">
                  {selectedCountry.shortageRisk === 'CRITICAL' &&
                    `${
                      COUNTRIES[selected]?.name
                    } faces severe workforce sustainability risk. With ${
                      selectedCountry.retirementCliffScore ?? '?'
                    }% of physicians aged over 55 and a pipeline ratio of ${
                      selectedCountry.pipelineRatio?.toFixed(1) ?? '?'
                    }, the system cannot replace retiring physicians at current graduation rates.`}

                  {selectedCountry.shortageRisk === 'HIGH' &&
                    `${
                      COUNTRIES[selected]?.name
                    } shows high workforce vulnerability. Retirement wave pressure is significant and graduate pipeline capacity requires strengthening to avoid medium-term shortages.`}

                  {selectedCountry.shortageRisk === 'MODERATE' &&
                    `${
                      COUNTRIES[selected]?.name
                    } maintains moderate workforce sustainability. Continued monitoring of age distribution trends and graduate output is recommended.`}

                  {selectedCountry.shortageRisk === 'LOW' &&
                    `${
                      COUNTRIES[selected]?.name
                    } demonstrates strong workforce sustainability with a healthier age distribution and adequate graduate pipeline.`}

                  {selectedCountry.shortageRisk === 'UNKNOWN' &&
                    `Insufficient data is available for ${
                      COUNTRIES[selected]?.name
                    } to generate a full workforce risk assessment.`}
                </p>
              </div>
            </aside>
          )}
        </section>

        <footer className="border-t border-slate-200 pb-10 pt-8">
          <h2 className="mb-4 text-base font-bold text-slate-900">
            Methodology
          </h2>

          <div className="grid grid-cols-1 gap-6 text-sm leading-7 text-slate-600 md:grid-cols-3">
            <div>
              <span className="font-semibold text-slate-900">
                Retirement cliff score
              </span>
              <br />
              Percentage of practising physicians aged 55 or older. Values above
              40% indicate a high-risk retirement wave within 10 years.
            </div>

            <div>
              <span className="font-semibold text-slate-900">
                Pipeline ratio
              </span>
              <br />
              Annual medical graduates per 100 current physicians. Values below
              5 indicate insufficient replacement capacity.
            </div>

            <div>
              <span className="font-semibold text-slate-900">Data source</span>
              <br />
              Eurostat Dissemination API. Datasets include physician density,
              physician age structure, and medical graduate indicators.
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
