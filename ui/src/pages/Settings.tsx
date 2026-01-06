import { useState } from 'react'
import OrganizationProfile from './OrganizationProfile'
import { Save, Globe, Key, ShieldCheck, Link2, Building2, CreditCard } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'organization' | 'security' | 'billing'>('general')

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight capitalize">{activeTab} Control Plane</h1>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 opacity-60">System Configuration Node</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary py-2.5 px-8"
        >
          <Save size={14} strokeWidth={3} />
          {isSaving ? 'Synchronizing...' : 'Commit Changes'}
        </button>
      </div>

      <div className="flex gap-20">
        {/* Local Tab Nav */}
        <div className="w-64 shrink-0 space-y-2">
          {[
            { id: 'general', label: 'General Preferences', icon: Globe },
            { id: 'organization', label: 'Organization Profile', icon: Building2 },
            { id: 'security', label: 'Security & Keys', icon: Key },
            { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${activeTab === tab.id
                ? 'bg-white text-indigo-700 border-indigo-100 shadow-sm'
                : 'text-slate-400 border-transparent hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <tab.icon size={14} strokeWidth={2.5} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'general' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl glass-liquid border-white/40 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Link2 size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight">Active Safe-Connect</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Integration mapping & resource bounds</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { name: 'Gnosis Safe', desc: 'Auto-verify multi-sig owners from connected safe addresses.', icon: 'G' },
                    { name: 'Chainlink Oracles', desc: 'Automatically trust off-chain price feeds from decentralized oracles.', icon: 'O' }
                  ].map(conn => (
                    <div key={conn.name} className="card-premium !p-6 flex items-center justify-between group hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-center font-black text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                          {conn.icon}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">{conn.name}</h3>
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-sm mt-0.5">{conn.desc}</p>
                        </div>
                      </div>
                      <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">Connect</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl glass-liquid border-white/40 flex items-center justify-center text-emerald-600 shadow-sm">
                    <ShieldCheck size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 tracking-tight">Audit Logic Preferences</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated verification & threshold controls</p>
                  </div>
                </div>

                <div className="card-premium !p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">Auto-Trust Verified Libraries</h3>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5">Automatically classify OpenZeppelin / Solady calls as EXTERNAL liability.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-10 h-5 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-8 border-t border-black/[0.03]">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">Gate Merge on Critical</h3>
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5">Fail CI/CD pipeline if security score falls below specified threshold.</p>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-black/[0.03] rounded-lg">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score Limit:</span>
                      <input type="number" defaultValue={80} className="w-10 bg-transparent border-none p-0 text-sm font-black text-indigo-600 focus:ring-0 text-center" />
                    </div>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'organization' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <OrganizationProfile />
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
              <div className="p-20 border-2 border-dashed border-black/[0.03] rounded-[40px] text-center">
                <Key size={40} className="text-slate-200 mx-auto mb-6" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault Access Restricted: Sync Required</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10 font-bold">
              <div className="p-20 border-2 border-dashed border-black/[0.03] rounded-[40px] text-center">
                <CreditCard size={40} className="text-slate-200 mx-auto mb-6" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Cluster: Establishing Connectivity...</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
