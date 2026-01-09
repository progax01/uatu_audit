import { useState, useEffect } from 'react'
import { Plus, Users, Mail, Search, Crown, Trash2, UserX } from 'lucide-react'
import { motion } from 'framer-motion'
import { getCurrentUser } from '../services/authService'

interface TeamMember {
    id: string
    name: string
    email: string
    role: 'owner' | 'admin' | 'member'
    status: 'online' | 'offline'
    initials: string
    avatarUrl?: string
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    owner: { label: 'Owner', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    admin: { label: 'Admin', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
    member: { label: 'Member', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

export default function Management() {
    const [team, setTeam] = useState<TeamMember[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)

    useEffect(() => {
        loadTeamData()
    }, [])

    const loadTeamData = async () => {
        try {
            const user = await getCurrentUser()
            if (user) {
                // Current user is always the owner
                const ownerMember: TeamMember = {
                    id: user.id,
                    name: user.displayName || user.login || 'You',
                    email: user.email || `${user.login}@github`,
                    role: 'owner',
                    status: 'online',
                    initials: getInitials(user.displayName || user.login || 'U'),
                    avatarUrl: user.avatarUrl,
                }
                setTeam([ownerMember])
            }
        } catch (err) {
            console.error('Failed to load team data:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredTeam = team.filter(member =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-8 animate-reveal">
                <div className="h-16 bg-slate-100/50 animate-pulse rounded-2xl" />
                <div className="h-64 bg-slate-100/50 animate-pulse rounded-[32px]" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-reveal">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                    Team <span className="text-indigo-600">Management</span>
                </h1>
                <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                    Manage your organization members and their access permissions.
                </p>
            </div>

            {/* Search and Add */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 pl-11 pr-4 bg-white border border-black/[0.05] rounded-2xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                    />
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary h-12 px-6"
                >
                    <Plus size={16} />
                    Add Member
                </button>
            </div>

            {/* Team List */}
            {filteredTeam.length === 0 && searchQuery ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium flex flex-col items-center justify-center text-center py-16"
                >
                    <UserX size={40} className="text-slate-200 mb-4" />
                    <h3 className="text-lg font-black text-slate-900 mb-2">No Results</h3>
                    <p className="text-slate-400 text-sm">No members match "{searchQuery}"</p>
                </motion.div>
            ) : filteredTeam.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium flex flex-col items-center justify-center text-center py-20"
                >
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-6 border border-black/[0.03]">
                        <Users size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">No Team Members</h3>
                    <p className="text-slate-400 text-sm mb-6 max-w-sm">
                        Add team members to collaborate on audits and share access.
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary h-11 px-6"
                    >
                        <Plus size={16} />
                        Add First Member
                    </button>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium overflow-hidden !p-0"
                >
                    <div className="divide-y divide-black/[0.03]">
                        {filteredTeam.map((member, index) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group"
                            >
                                <div className="flex items-center gap-5">
                                    {/* Avatar */}
                                    <div className="relative">
                                        {member.avatarUrl ? (
                                            <img
                                                src={member.avatarUrl}
                                                alt={member.name}
                                                className="w-12 h-12 rounded-2xl object-cover border border-black/[0.03]"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-[11px] font-black text-white">
                                                {member.initials}
                                            </div>
                                        )}
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-bold text-slate-900 text-[15px]">{member.name}</h3>
                                            {member.role === 'owner' && (
                                                <Crown size={14} className="text-amber-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mt-0.5">
                                            <Mail size={11} />
                                            {member.email}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Role Badge */}
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${ROLE_LABELS[member.role].bg} ${ROLE_LABELS[member.role].color}`}>
                                        {ROLE_LABELS[member.role].label}
                                    </span>

                                    {/* Actions - only show for non-owners */}
                                    {member.role !== 'owner' && (
                                        <button className="w-9 h-9 bg-slate-50 border border-black/[0.03] rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Add Member Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-50/60 backdrop-blur-md"
                        onClick={() => setShowAddModal(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 border border-black/[0.03]"
                    >
                        <h2 className="text-2xl font-black text-slate-900 mb-2">Add Team Member</h2>
                        <p className="text-slate-400 text-sm mb-6">Invite a new member to your organization.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    placeholder="colleague@company.com"
                                    className="w-full h-12 px-4 bg-slate-50 border border-black/[0.03] rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Role
                                </label>
                                <select className="w-full h-12 px-4 bg-slate-50 border border-black/[0.03] rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all appearance-none">
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 h-12 bg-slate-50 border border-black/[0.03] rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button className="flex-1 btn-primary h-12">
                                Send Invite
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
