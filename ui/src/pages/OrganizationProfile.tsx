import { useState } from 'react'

import {
    Users, Building2, Globe,
    ShieldCheck, CreditCard, Plus,
    MoreHorizontal, CheckCircle2
} from 'lucide-react'

export default function OrganizationProfile() {
    const [members] = useState([
        { id: 1, name: 'Soneshwar S.', role: 'Owner', email: 'soneshwar@hatu.audit', status: 'active', avatar: 'SS' },
        { id: 2, name: 'Alex M.', role: 'Security Engineer', email: 'alex@hatu.audit', status: 'active', avatar: 'AM' },
        { id: 3, name: 'Sarah L.', role: 'QA Lead', email: 'sarah@hatu.audit', status: 'invited', avatar: 'SL' },
    ])

    return (
        <div className="space-y-12 max-w-4xl mx-auto">
            {/* Header Section */}
            <section>
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-[32px] bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-xl shadow-indigo-500/20">
                        <div className="w-full h-full rounded-[30px] bg-white flex items-center justify-center">
                            <Building2 size={32} className="text-indigo-600" strokeWidth={1.5} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hatu Security Lab</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Enterprise ID: AD-9283-CMD</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Tier', value: 'Enterprise Zero', icon: ShieldCheck, color: 'text-indigo-600' },
                        { label: 'Active Seats', value: '12 / 25', icon: Users, color: 'text-emerald-600' },
                        { label: 'Next Billing', value: 'Oct 12, 2025', icon: CreditCard, color: 'text-blue-600' },
                    ].map((stat, i) => (
                        <div key={i} className="card-premium !p-6 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${stat.color}`}>
                                <stat.icon size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div className="text-sm font-black text-slate-900">{stat.value}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Team Management */}
            <section>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight">Access Control Plane</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Manage team members and permission scopes</p>
                    </div>
                    <button className="btn-primary !py-2 !px-4 !text-[9px]">
                        <Plus size={14} strokeWidth={3} />
                        Invite Member
                    </button>
                </div>

                <div className="card-premium overflow-hidden !p-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black/[0.03] bg-slate-50/50">
                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Role Scope</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.02]">
                            {members.map((member) => (
                                <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600">
                                                {member.avatar}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-slate-900 leading-none mb-1">{member.name}</div>
                                                <div className="text-[10px] font-medium text-slate-400">{member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest capitalize">{member.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-black/[0.05]">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Global Metadata */}
            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl glass-liquid border-white/40 flex items-center justify-center text-indigo-600 shadow-sm">
                        <Globe size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-900 tracking-tight">Public Presence</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control how your organization appears in public audit directories</p>
                    </div>
                </div>

                <div className="card-premium !p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight">Display Verified Badge</h3>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5">Show the "Uatu Verified" badge on all publicly indexed audit reports.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-10 h-5 bg-slate-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-black/[0.03]">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight">Public Audit Directory</h3>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5">Allow external parties to view your protocol's security history via uatu.audit/labs/hatu</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            <CheckCircle2 size={14} />
                            Publicly Visible
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
