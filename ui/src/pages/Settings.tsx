import { useState } from 'react'
import { Save, ShieldCheck, Link2, Cpu, Activity, Database, Check, RefreshCw, Zap } from 'lucide-react'

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  return (
    <div className="w-full space-y-10 animate-reveal">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
              <Cpu size={10} className="fill-indigo-600" />
              Core Control
            </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">System <span className="text-indigo-600">Parameters</span></h1>
          <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
            Configure your neural audit engine and manage external protocol integrations.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary h-12 px-8"
        >
          {isSaving ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSaving ? 'Syncing...' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300">
                <ShieldCheck size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-sm font-black text-slate-900 tracking-widest uppercase">Audit Logic Thresholds</h2>
            </div>

            <div className="card-premium overflow-hidden !p-0">
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">Gate CI/CD on Critical Audit</h3>
                    <p className="text-[12px] text-slate-400 font-medium leading-relaxed max-w-md">Prevent PR merges if the security vector score falls below defined protocol limits.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-12 h-6 bg-slate-100 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-6 after:shadow-lg border border-black/[0.03]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-8 border-t border-black/[0.03]">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">Auto-Trust Verified Libraries</h3>
                    <p className="text-[12px] text-slate-400 font-medium leading-relaxed max-w-md">Automatically flag OpenZeppelin and Solady as verified zero-liability units.</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-500 text-[9px] font-black rounded-full uppercase tracking-widest leading-none">Core Enabled</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300">
                <Link2 size={18} strokeWidth={2.5} />
              </div>
              <h2 className="text-[11px] font-black text-slate-900 tracking-widest uppercase">Data Integrations</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { name: 'Safe Global Auth', desc: 'Sync multi-sig owners for audit verification.', status: 'Connected', icon: Database },
                { name: 'Chainlink Oracles', desc: 'Verify price feed manipulation resistance.', status: 'Disabled', icon: Activity }
              ].map(item => (
                <div key={item.name} className="card-premium flex items-center justify-between group !p-6">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center text-slate-300 transition-all duration-500">
                      <item.icon size={20} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-base font-black text-slate-900 tracking-tight uppercase transition-colors">{item.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase tracking-wider">{item.desc}</p>
                    </div>
                  </div>
                  <button className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${item.status === 'Connected' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-300 border border-black/[0.03] hover:bg-slate-900 hover:text-white'
                    }`}>
                    {item.status}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 border border-black shadow-2xl p-8 rounded-[32px] text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] -rotate-12 transition-transform duration-1000">
              <Zap size={120} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Global Scan Status</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-4 uppercase">Neural Engine V4</h3>
              <p className="text-[10px] text-slate-400 font-black leading-relaxed uppercase tracking-widest mb-8">
                Latency: 12ms // Capacity: Optimal // Nodes: Reporting
              </p>
              <div className="space-y-6">
                {[
                  { label: 'Compute Power', value: '98.2%' },
                  { label: 'Neural Precision', value: '99.9%' }
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="flex justify-between text-[9px] uppercase tracking-widest text-slate-500 mb-2.5 font-black">
                      <span>{stat.label}</span>
                      <span className="text-white">{stat.value}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-colors shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{ width: stat.value }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card-premium flex items-center gap-5 group shadow-xl !p-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner group-hover:bg-white transition-colors duration-500">
              <Check size={20} strokeWidth={3} />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Auto-Save: Active</div>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Sync Pulse: 2m ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
