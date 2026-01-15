import { useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { authFetch } from '../services/authService'
import { useNavigate } from 'react-router-dom'

type ProjectType = 'contract-only'

interface ProjectCreateProps {
  onNext: (project: { id: string; name: string; description?: string; type: ProjectType }) => void
  onBack: () => void
  onHomeClick: () => void
}

export default function ProjectCreate({ onNext, onBack, onHomeClick }: ProjectCreateProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length >= 3

  const handleSubmit = async () => {
    if (!isValid) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: 'contract-only',
          settings: {
            testStyles: ['behavioral', 'stride'],
            aiEnabled: true,
            auditDepth: 'standard'
          }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const project = await res.json()

      // Redirect to project details
      navigate(`/project/${project.slug}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Card with Close Button */}
        <div className="card-premium relative">
          {/* Close Button */}
          <button
            onClick={onBack}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={20} />
          </button>

          {/* Form Content */}
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My DeFi Protocol"
                className="w-full h-12 px-4 bg-white border border-black/[0.05] rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your project..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-black/[0.05] rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onBack}
                className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid || isLoading}
                className="flex-1 h-12 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating...' : 'Create Project'}
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              You'll add sources after creating the project
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
