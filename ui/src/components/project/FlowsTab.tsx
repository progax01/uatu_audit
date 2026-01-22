import { useState, useEffect } from 'react'
import { GitBranch, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { authFetch } from '../../services/authService'
import mermaid from 'mermaid'

interface Flow {
  id: string
  name: string
  description: string
  entryPoint: {
    functionName: string
    contractName: string
    visibility: string
    modifiers: string[]
  }
  steps: Array<{
    functionName: string
    requiredRole?: string
    externalCalls: string[]
    stateChanges: string[]
    events: string[]
  }>
  risks: string[]
}

interface MermaidDiagram {
  flowId: string
  diagramType: 'flowchart' | 'stateDiagram' | 'sequenceDiagram'
  mermaidCode: string
  description: string
}

interface FlowsTabProps {
  projectId: string
}

export default function FlowsTab({ projectId }: FlowsTabProps) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [diagrams, setDiagrams] = useState<MermaidDiagram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set())
  const [selectedDiagramType, setSelectedDiagramType] = useState<'flowchart' | 'stateDiagram' | 'sequenceDiagram'>('flowchart')

  useEffect(() => {
    fetchFlows()
  }, [projectId])

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
    })
  }, [])

  useEffect(() => {
    // Re-render mermaid diagrams when diagrams change
    if (diagrams.length > 0) {
      setTimeout(() => {
        mermaid.run()
      }, 100)
    }
  }, [diagrams, expandedFlows, selectedDiagramType])

  const fetchFlows = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/projects/${projectId}/flows`)
      if (res.ok) {
        const data = await res.json()
        setFlows(data.flows || [])
        setDiagrams(data.diagrams || [])
      } else {
        setError('Failed to load flows')
      }
    } catch (err) {
      setError('Failed to load flows')
    } finally {
      setLoading(false)
    }
  }

  const toggleFlow = (flowId: string) => {
    setExpandedFlows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(flowId)) {
        newSet.delete(flowId)
      } else {
        newSet.add(flowId)
      }
      return newSet
    })
  }

  const getDiagramsForFlow = (flowId: string) => {
    return diagrams.filter(d => d.flowId === flowId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Loading flows...</span>
        </div>
      </div>
    )
  }

  if (error || flows.length === 0) {
    return (
      <div className="card-premium p-12 text-center">
        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <GitBranch size={28} className="text-slate-300" />
        </div>
        <h3 className="font-black text-slate-900 mb-2">No User Flows Yet</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
          Run a deep audit to generate user flow diagrams showing how users interact with your contracts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest">
          User Flows ({flows.length})
        </h3>

        {/* Diagram Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">View:</span>
          <select
            value={selectedDiagramType}
            onChange={(e) => setSelectedDiagramType(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-slate-200 bg-white hover:border-indigo-300 focus:border-indigo-500 focus:outline-none transition-colors"
          >
            <option value="flowchart">Flowchart</option>
            <option value="sequenceDiagram">Sequence</option>
            <option value="stateDiagram">State</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {flows.map((flow) => {
          const isExpanded = expandedFlows.has(flow.id)
          const flowDiagrams = getDiagramsForFlow(flow.id)
          const selectedDiagram = flowDiagrams.find(d => d.diagramType === selectedDiagramType)

          return (
            <div key={flow.id} className="card-premium overflow-hidden">
              {/* Flow Header */}
              <button
                onClick={() => toggleFlow(flow.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronDown size={20} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400" />
                  )}
                  <div className="text-left">
                    <h4 className="font-bold text-slate-900">{flow.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{flow.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {flow.risks.length > 0 && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                      <AlertCircle size={12} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {flow.risks.length} {flow.risks.length === 1 ? 'Risk' : 'Risks'}
                      </span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-black uppercase tracking-wider">
                    {flow.steps.length} Steps
                  </span>
                </div>
              </button>

              {/* Flow Details (Expanded) */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  {/* Entry Point Info */}
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Entry Point</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="px-2.5 py-1 bg-white rounded border border-slate-200 text-sm font-mono text-slate-900">
                        {flow.entryPoint.contractName || 'Contract'}.{flow.entryPoint.functionName}()
                      </code>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-bold">
                        {flow.entryPoint.visibility}
                      </span>
                      {flow.entryPoint.modifiers.map((mod, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-violet-50 text-violet-600 text-xs font-bold">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Diagram */}
                  {selectedDiagram && (
                    <div className="px-6 py-6 bg-white">
                      <div className="mb-4">
                        <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                          {selectedDiagramType === 'flowchart' && 'Flow Diagram'}
                          {selectedDiagramType === 'sequenceDiagram' && 'Sequence Diagram'}
                          {selectedDiagramType === 'stateDiagram' && 'State Diagram'}
                        </h5>
                        <p className="text-xs text-slate-500">{selectedDiagram.description}</p>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                        <div className="mermaid" key={`${flow.id}-${selectedDiagramType}`}>
                          {selectedDiagram.mermaidCode}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {flow.risks.length > 0 && (
                    <div className="px-6 py-4 bg-amber-50/30 border-t border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={14} className="text-amber-600" />
                        <span className="text-xs font-black text-amber-700 uppercase tracking-wider">
                          Identified Risks
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {flow.risks.map((risk, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-900">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Flow Steps */}
                  <div className="px-6 py-4 border-t border-slate-100">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                      Execution Flow
                    </h5>
                    <div className="space-y-3">
                      {flow.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono font-bold text-slate-900">
                                {step.functionName}()
                              </code>
                              {step.requiredRole && (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[10px] font-black uppercase">
                                  🔒 {step.requiredRole}
                                </span>
                              )}
                            </div>

                            {step.stateChanges.length > 0 && (
                              <div className="text-xs text-slate-600 mb-1">
                                <span className="font-bold">State: </span>
                                {step.stateChanges.join(', ')}
                              </div>
                            )}

                            {step.externalCalls.length > 0 && (
                              <div className="text-xs text-amber-600">
                                <span className="font-bold">⚠️ External: </span>
                                {step.externalCalls.join(', ')}
                              </div>
                            )}

                            {step.events.length > 0 && (
                              <div className="text-xs text-blue-600">
                                <span className="font-bold">📢 Events: </span>
                                {step.events.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
