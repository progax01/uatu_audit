import { Check, Clock, Play, AlertCircle } from 'lucide-react'

interface Milestone {
  number: number
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  duration?: number
  step?: string
}

interface MilestoneTrackerProps {
  milestones: Milestone[]
  currentMilestone?: number
}

const MILESTONE_INFO = {
  1: {
    name: 'Context Ingestion',
    shortName: 'M1',
    description: 'Loading project structure and dependencies',
    color: 'from-blue-500 to-blue-600',
    icon: '📥'
  },
  2: {
    name: 'Clarification',
    shortName: 'C1',
    description: 'Awaiting user input on detected patterns',
    color: 'from-amber-500 to-amber-600',
    icon: '💬'
  },
  3: {
    name: 'Static Analysis',
    shortName: 'M2',
    description: 'Analyzing code patterns and potential vulnerabilities',
    color: 'from-purple-500 to-purple-600',
    icon: '🔍'
  },
  4: {
    name: 'Logic Simulation',
    shortName: 'M3',
    description: 'Simulating execution paths and business logic',
    color: 'from-orange-500 to-orange-600',
    icon: '⚡'
  },
  5: {
    name: 'Test Generation',
    shortName: 'M4',
    description: 'Generating PoC tests for identified vulnerabilities',
    color: 'from-green-500 to-green-600',
    icon: '🧪'
  },
  6: {
    name: 'Final Consolidation',
    shortName: 'M5',
    description: 'Aggregating findings and generating report',
    color: 'from-indigo-500 to-indigo-600',
    icon: '📊'
  },
  7: {
    name: 'Report Generation',
    shortName: 'M6',
    description: 'Finalizing technical dossier and certificate',
    color: 'from-slate-700 to-slate-900',
    icon: '📄'
  }
}

export default function MilestoneTracker({ milestones, currentMilestone }: MilestoneTrackerProps) {
  // If no milestones provided, show all 7 as pending
  const displayMilestones: Milestone[] = milestones.length > 0
    ? milestones
    : Array.from({ length: 7 }, (_, i) => ({
      number: i + 1,
      name: MILESTONE_INFO[(i + 1) as keyof typeof MILESTONE_INFO].name,
      description: MILESTONE_INFO[(i + 1) as keyof typeof MILESTONE_INFO].description,
      status: 'pending' as const,
      progress: 0
    }))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Audit Pipeline</h3>
        {currentMilestone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Milestone {currentMilestone} / 7
          </div>
        )}
      </div>

      <div className="space-y-4">
        {displayMilestones.map((milestone, index) => {
          const info = MILESTONE_INFO[milestone.number as keyof typeof MILESTONE_INFO]
          const isActive = milestone.status === 'running'
          const isComplete = milestone.status === 'completed'
          const isError = milestone.status === 'error'

          return (
            <div key={milestone.number} className="relative">
              {/* Connector Line */}
              {index < displayMilestones.length - 1 && (
                <div className="absolute left-[19px] top-10 w-0.5 h-8 bg-gray-200" />
              )}

              <div className={`flex items-start gap-4 p-4 rounded-lg transition-all ${isActive ? 'bg-blue-50 border border-blue-200' :
                isComplete ? 'bg-gray-50' :
                  isError ? 'bg-red-50 border border-red-200' :
                    'bg-white'
                }`}>
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${isComplete ? 'bg-green-500 text-white' :
                  isActive ? `bg-gradient-to-br ${info.color} text-white animate-pulse` :
                    isError ? 'bg-red-500 text-white' :
                      'bg-gray-200 text-gray-500'
                  }`}>
                  {isComplete ? <Check className="w-5 h-5" /> :
                    isActive ? <Play className="w-4 h-4" /> :
                      isError ? <AlertCircle className="w-5 h-5" /> :
                        <span className="text-sm font-bold">{info.shortName}</span>
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-medium ${isActive ? 'text-blue-900' :
                      isComplete ? 'text-gray-700' :
                        isError ? 'text-red-900' :
                          'text-gray-500'
                      }`}>
                      {info.name}
                    </h4>
                    {milestone.duration !== undefined && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.round(milestone.duration)}s
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {info.description}
                  </p>

                  {/* Current Step */}
                  {isActive && milestone.step && (
                    <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded inline-block mb-2">
                      {milestone.step}
                    </div>
                  )}

                  {/* Progress Bar */}
                  {(isActive || (isComplete && milestone.progress === 100)) && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${info.color} transition-all duration-500 ease-out`}
                        style={{ width: `${milestone.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Progress Percentage */}
                  {isActive && milestone.progress > 0 && milestone.progress < 100 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {milestone.progress}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      {displayMilestones.some(m => m.status === 'completed') && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {displayMilestones.filter(m => m.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {displayMilestones.filter(m => m.status === 'running').length}
              </div>
              <div className="text-xs text-gray-500">In Progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">
                {displayMilestones.filter(m => m.status === 'pending').length}
              </div>
              <div className="text-xs text-gray-500">Pending</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
