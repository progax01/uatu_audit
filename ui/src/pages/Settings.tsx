import { useState } from 'react'
import { ArrowLeft, Save, Globe, Key, ShieldCheck, Link2 } from 'lucide-react'

interface SettingsProps {
  onHomeClick: () => void
  onBack: () => void
}

export default function Settings({ onHomeClick, onBack }: SettingsProps) {
  const [isSaving, setIsStarting] = useState(false)

  const handleSave = async () => {
    setIsStarting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsStarting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-[#0F3F62]">Global Settings</h1>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-[#0F3F62] hover:bg-[#1a5a8a] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-900/10 disabled:opacity-50"
          disabled={isSaving}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <div className="space-y-8">
          {/* Third Party Connections */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-[#0F3F62]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Connections</h2>
                <p className="text-sm text-gray-500">Configure third-party app integrations for better liability mapping.</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-400">G</div>
                  <div>
                    <h3 className="font-bold text-gray-900">Gnosis Safe</h3>
                    <p className="text-sm text-gray-500">Auto-verify multi-sig owners from safe addresses.</p>
                  </div>
                </div>
                <button className="text-sm font-bold text-[#0F3F62] hover:underline">Connect</button>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-400">O</div>
                  <div>
                    <h3 className="font-bold text-gray-900">Chainlink Oracles</h3>
                    <p className="text-sm text-gray-500">Automatically trust off-chain price feeds from Chainlink.</p>
                  </div>
                </div>
                <button className="text-sm font-bold text-[#0F3F62] hover:underline">Connect</button>
              </div>
            </div>
          </section>

          {/* Global Preferences */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Audit Preferences</h2>
                <p className="text-sm text-gray-500">Set global rules for your organization's security posture.</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Auto-Trust OpenZeppelin</h3>
                  <p className="text-sm text-gray-500">Always classify OpenZeppelin library calls as EXTERNAL liability.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0F3F62]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                <div>
                  <h3 className="font-bold text-gray-900">Block Merge on Failure</h3>
                  <p className="text-sm text-gray-500">Update GitHub Check status to 'failure' if score is below threshold.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400">THRESHOLD:</span>
                  <input type="number" defaultValue={80} className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm font-bold text-[#0F3F62]" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

