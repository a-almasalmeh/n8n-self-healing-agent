import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Workflow,
  XCircle,
} from 'lucide-react'

const API_BASE = 'http://localhost:8080/api/webhook'
const POLL_INTERVAL_MS = 5000

type IncidentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface HealingIncident {
  id: string
  timestamp: string
  workflow_id: string
  failed_node: string
  error_message: string
  original_workflow_json: unknown
  repaired_workflow_json: unknown
  status: IncidentStatus
}

const STATUS_STYLES: Record<IncidentStatus, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-800 ring-amber-200', icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', className: 'bg-slate-200 text-slate-700 ring-slate-300', icon: XCircle },
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const { label, className, icon: Icon } = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function JsonPanel({ title, data, accent }: { title: string; data: unknown; accent: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className={`border-b border-slate-200 px-4 py-2 text-sm font-semibold ${accent}`}>{title}</div>
      <pre className="flex-1 overflow-auto bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    </div>
  )
}

export default function App() {
  const [incidents, setIncidents] = useState<HealingIncident[]>([])
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/incidents`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealingIncident[] = await res.json()
      setIncidents(data)
      setError(null)
    } catch (e) {
      setError(`Backend nicht erreichbar (${e instanceof Error ? e.message : e})`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
    const timer = setInterval(fetchIncidents, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [fetchIncidents])

  // "Verwerfen" wird nur lokal gespeichert und überschreibt den Status aus dem Backend
  const effectiveStatus = (incident: HealingIncident): IncidentStatus =>
    rejectedIds.has(incident.id) ? 'REJECTED' : incident.status

  const sortedIncidents = [...incidents].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const selected = incidents.find((i) => i.id === selectedId) ?? null
  const selectedStatus = selected ? effectiveStatus(selected) : null

  const approve = async (id: string) => {
    setApproving(true)
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated: HealingIncident = await res.json()
      setIncidents((prev) => prev.map((i) => (i.id === id ? updated : i)))
      setError(null)
    } catch (e) {
      setError(`Approve fehlgeschlagen (${e instanceof Error ? e.message : e})`)
    } finally {
      setApproving(false)
    }
  }

  const reject = (id: string) => setRejectedIds((prev) => new Set(prev).add(id))

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <h1 className="text-lg font-semibold">n8n Self-Healing Agent</h1>
          <span className="text-sm text-slate-500">· Human-in-the-Loop Review</span>
        </div>
        <button
          onClick={fetchIncidents}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* LINKE SPALTE: Incident-Liste */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
            Incidents ({incidents.length})
          </div>
          <ul className="flex-1 overflow-y-auto">
            {loading && (
              <li className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Incidents…
              </li>
            )}
            {!loading && incidents.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
                <Inbox className="h-8 w-8 text-slate-300" />
                Noch keine Fehlerfälle eingegangen.
              </li>
            )}
            {sortedIncidents.map((incident) => (
              <li key={incident.id}>
                <button
                  onClick={() => setSelectedId(incident.id)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    incident.id === selectedId ? 'border-l-4 border-l-indigo-500 bg-indigo-50' : 'border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                      <Workflow className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{incident.workflow_id}</span>
                    </span>
                    <StatusBadge status={effectiveStatus(incident)} />
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-600">{incident.failed_node}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {new Date(incident.timestamp).toLocaleString('de-DE')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* RECHTE SPALTE: Detailansicht */}
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <Workflow className="h-12 w-12" />
              <p>Wähle links einen Incident aus, um Details zu sehen.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                    <AlertTriangle className="h-4 w-4" />
                    Fehler in Node: <span className="font-mono">{selected.failed_node}</span>
                  </div>
                  <p className="mt-2 break-words font-mono text-sm text-red-700">{selected.error_message}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-red-900/60">
                    <span>Workflow: {selected.workflow_id}</span>
                    <span>·</span>
                    <span>ID: {selected.id}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={selectedStatus!} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(selected.id)}
                      disabled={selectedStatus !== 'PENDING'}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Verwerfen
                    </button>
                    <button
                      onClick={() => approve(selected.id)}
                      disabled={selectedStatus !== 'PENDING' || approving}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Fix anwenden (Approve)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 gap-4">
                <JsonPanel title="Original-Workflow" data={selected.original_workflow_json} accent="text-red-700" />
                <JsonPanel title="Reparierter Workflow" data={selected.repaired_workflow_json} accent="text-emerald-700" />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
