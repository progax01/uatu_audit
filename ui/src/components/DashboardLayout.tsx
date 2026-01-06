import { ReactNode, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Layout, Settings, Shield,
    LogOut, Building2,
    Bell, Search
} from 'lucide-react'
import logo from '../assets/logo.svg'
import { Link, useLocation } from 'react-router-dom'
import MouseTooltip from './MouseTooltip'

interface DashboardLayoutProps {
    children: ReactNode
    onLogout?: () => void
}

export default function DashboardLayout({ children, onLogout }: DashboardLayoutProps) {
    const location = useLocation()
    const [isSidebarCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    useEffect(() => {
        const path = location.pathname
        if (path.includes('settings')) setActiveTab('settings')
        else if (path.includes('organization')) setActiveTab('organization')
        else setActiveTab('overview')
    }, [location])

    const navItems = [
        { id: 'overview', label: 'Command Center', icon: Layout, path: '/dashboard' },
        { id: 'protocols', label: 'Protocols', icon: Shield, path: '/dashboard' }, // Simulated for now
        { id: 'organization', label: 'Organization', icon: Building2, path: '/settings' }, // Links to settings tab
        { id: 'settings', label: 'Preferences', icon: Settings, path: '/settings' },
    ]

    const handleLogout = async () => {
        if (onLogout) {
            onLogout()
            return
        }
        try {
            await fetch('/auth/logout', { method: 'POST' })
            window.location.href = '/'
        } catch (err) {
            console.error('Logout failed', err)
        }
    }

    return (
        <div className="min-h-screen bg-base flex selection:bg-indigo-500/20 overflow-hidden h-screen">
            <MouseTooltip />

            {/* Premium Sidebar */}
            <aside className={`relative h-full bg-white/80 backdrop-blur-3xl border-r border-black/[0.03] flex flex-col z-[100] transition-all duration-500 shadow-[20px_0_40px_rgba(0,0,0,0.01)] ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}>
                {/* Sidebar Header */}
                <div className="h-20 flex items-center px-8 border-b border-black/[0.02]">
                    <Link to="/" className="flex items-center gap-3 group">
                        <img src={logo} alt="Uatu" className="h-8 object-contain transition-transform duration-700 group-hover:scale-110" />
                        {!isSidebarCollapsed && (
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 group-hover:text-indigo-600 transition-colors">Uatu Security</span>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <div className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group relative ${isActive
                                    ? 'bg-indigo-50 border border-indigo-100/50 shadow-sm translate-x-1'
                                    : 'hover:bg-slate-50/50 text-slate-400 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-indigo-600' : 'group-hover:text-indigo-400 transition-colors'} />
                                {!isSidebarCollapsed && (
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-900' : 'text-inherit'}`}>
                                        {item.label}
                                    </span>
                                )}
                                {isActive && (
                                    <motion.div layoutId="activeNav" className="absolute left-[-16px] w-1.5 h-6 bg-indigo-600 rounded-r-full" />
                                )}
                            </Link>
                        )
                    })}
                </div>

                {/* Sidebar Footer */}
                <div className="p-6 border-t border-black/[0.02]">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-50/50 hover:text-rose-600 transition-all group"
                    >
                        <LogOut size={18} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
                        {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Terminate Session</span>}
                    </button>
                </div>
            </aside>

            {/* Main Command Center Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Unified Dashboard Header */}
                <header className="h-20 bg-white/70 backdrop-blur-2xl border-b border-black/[0.03] flex items-center justify-between px-10 shrink-0 z-50">
                    <div className="flex items-center gap-8 flex-1">
                        <div className="relative group max-w-md w-full">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search Protocols, Audit Reports, or Assets..."
                                className="w-full bg-slate-50/50 border border-black/[0.02] rounded-xl py-2.5 pl-12 pr-4 text-[11px] font-bold focus:outline-none focus:bg-white focus:border-indigo-100 transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Indicators */}
                        <div className="flex items-center gap-4 border-r border-black/[0.05] pr-6">
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Network Health</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Optimal Performance</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="p-2.5 hover:bg-slate-50 rounded-xl transition-all relative">
                                <Bell size={18} className="text-slate-400" />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white" />
                            </button>
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-lg shadow-indigo-500/10">
                                <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">
                                    AD
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Body */}
                <main className="flex-1 overflow-y-auto bg-slate-50/30">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="p-10 h-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}
