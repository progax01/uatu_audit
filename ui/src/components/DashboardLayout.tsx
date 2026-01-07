import { ReactNode, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Layout, Settings, Shield,
    LogOut, Building2,
    Bell
} from 'lucide-react'
import logo from '../assets/logo.svg'
import { Link, useLocation } from 'react-router-dom'
import MouseTooltip from './MouseTooltip'
import { getStoredUser, type AuthUser } from '../services/authService'

interface DashboardLayoutProps {
    children: ReactNode
    onLogout?: () => void
}

// Get user initials from name or wallet address
function getUserInitials(user: AuthUser | null): string {
    if (!user) return '??'

    // Try display name first
    if (user.displayName) {
        const parts = user.displayName.trim().split(/\s+/)
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        }
        return user.displayName.slice(0, 2).toUpperCase()
    }

    // Try username
    if (user.username) {
        return user.username.slice(0, 2).toUpperCase()
    }

    // Try GitHub login
    if (user.githubLogin) {
        return user.githubLogin.slice(0, 2).toUpperCase()
    }

    // Fall back to wallet address
    if (user.walletAddress) {
        return user.walletAddress.slice(2, 4).toUpperCase()
    }

    return '??'
}

export default function DashboardLayout({ children, onLogout }: DashboardLayoutProps) {
    const location = useLocation()
    const [isSidebarCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const [user, setUser] = useState<AuthUser | null>(null)

    // Load user on mount
    useEffect(() => {
        const storedUser = getStoredUser()
        setUser(storedUser)
    }, [])

    useEffect(() => {
        const path = location.pathname
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')

        if (path.includes('settings')) {
            if (tab === 'organization') setActiveTab('organization')
            else setActiveTab('settings')
        }
        else if (path.includes('dashboard')) {
            if (location.hash === '#protocols') setActiveTab('protocols')
            else setActiveTab('overview')
        }
        else setActiveTab('overview')
    }, [location])

    const navItems = [
        { id: 'overview', label: 'Command Center', icon: Layout, path: '/dashboard' },
        { id: 'protocols', label: 'Nodes & Protocols', icon: Shield, path: '/dashboard#protocols' },
        { id: 'organization', label: 'Management', icon: Building2, path: '/settings?tab=organization' },
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
                        <img src={logo} alt="Uatu" className="h-9 object-contain transition-transform duration-700 group-hover:scale-110" />
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
                        {/* Search Removed per feedback */}
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
                            <Link to="/settings" className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-lg shadow-indigo-500/10 hover:scale-105 transition-transform">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="w-full h-full rounded-[10px] object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">
                                        {getUserInitials(user)}
                                    </div>
                                )}
                            </Link>
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
                            className="px-10 py-8 h-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}
