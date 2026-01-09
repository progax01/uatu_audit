import { ReactNode, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FolderGit2, Settings,
    LogOut, Users,
    Bell, ChevronRight, Shield, Zap, FileSearch
} from 'lucide-react'
import logo from '../assets/logo.svg'
import { Link, useLocation } from 'react-router-dom'
import MouseTooltip from './MouseTooltip'
import { getStoredUser, type AuthUser } from '../services/authService'

interface DashboardLayoutProps {
    children: ReactNode
    onLogout?: () => void
}

function getUserInitials(user: AuthUser | null): string {
    if (!user) return '??'
    if (user.displayName) {
        const parts = user.displayName.trim().split(/\s+/)
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        return user.displayName.slice(0, 2).toUpperCase()
    }
    if (user.username) return user.username.slice(0, 2).toUpperCase()
    if (user.githubLogin) return user.githubLogin.slice(0, 2).toUpperCase()
    if (user.walletAddress) return user.walletAddress.slice(2, 4).toUpperCase()
    return '??'
}

export default function DashboardLayout({ children, onLogout }: DashboardLayoutProps) {
    const location = useLocation()
    const [isSidebarCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const [user, setUser] = useState<AuthUser | null>(null)

    useEffect(() => {
        const storedUser = getStoredUser()
        setUser(storedUser)
    }, [])

    useEffect(() => {
        const path = location.pathname
        if (path === '/nodes') setActiveTab('nodes')
        else if (path === '/management') setActiveTab('management')
        else if (path === '/credentials') setActiveTab('credentials')
        else if (path === '/subscription') setActiveTab('billing')
        else if (path === '/settings') setActiveTab('settings')
        else if (path.includes('dashboard')) setActiveTab('overview')
        else if (path.includes('/project/')) setActiveTab('nodes')
        else setActiveTab('overview')
    }, [location])

    const navItems = [
        { id: 'overview', label: 'Projects', icon: FolderGit2, path: '/dashboard' },
        { id: 'nodes', label: 'Audit Reports', icon: FileSearch, path: '/nodes' },
        { id: 'management', label: 'Team', icon: Users, path: '/management' },
        { id: 'credentials', label: 'Security', icon: Shield, path: '/credentials' },
        { id: 'billing', label: 'Usage & Billing', icon: Zap, path: '/subscription' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
    ]

    // Get readable page name
    const getPageLabel = (path: string): string => {
        const segment = path.split('/')[1]
        const labels: Record<string, string> = {
            dashboard: 'Projects',
            nodes: 'Audit Reports',
            management: 'Team',
            credentials: 'Security',
            subscription: 'Usage & Billing',
            settings: 'Settings',
            project: 'Project Details',
        }
        return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    }

    const breadcrumbs = [
        { label: 'Home', path: '/dashboard' },
        ...(location.pathname !== '/dashboard' ? [{ label: getPageLabel(location.pathname), path: location.pathname }] : [])
    ]

    const handleLogout = async () => {
        if (onLogout) { onLogout(); return }
        try {
            await fetch('/auth/logout', { method: 'POST' })
            window.location.href = '/'
        } catch (err) { console.error('Logout failed', err) }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-indigo-100 overflow-hidden h-screen font-body">
            <MouseTooltip />

            {/* Premium Sidebar */}
            <aside className={`relative h-full bg-[#F1F5F9] border-r border-black/[0.03] flex flex-col z-[100] transition-all duration-300 ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}>
                <div className="h-24 flex items-center px-10 border-b border-black/[0.02]">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={logo} alt="Uatu" className="h-8" />
                    </Link>
                </div>

                <div className="flex-1 px-6 py-10 space-y-2 overflow-y-auto scrollbar-hide">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${isActive
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200'
                                    : 'text-slate-400 hover:text-slate-900 hover:bg-white'
                                    }`}
                            >
                                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                <span className={`text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap ${isActive ? 'text-white' : ''}`}>
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>

                <div className="p-8 border-t border-black/[0.02]">
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all group">
                        <LogOut size={18} strokeWidth={2} />
                        <span className="text-[11px] font-black uppercase tracking-widest">Sign Out</span>
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <header className="h-20 bg-white border-b border-black/[0.02] flex items-center justify-between px-12 shrink-0 z-50">
                    <div className="flex items-center gap-4">
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={crumb.path} className="flex items-center gap-4">
                                <Link to={crumb.path} className={`text-[10px] font-black tracking-widest uppercase ${idx === breadcrumbs.length - 1 ? 'text-slate-900' : 'text-slate-300 hover:text-indigo-600'}`}>
                                    {crumb.label}
                                </Link>
                                {idx < breadcrumbs.length - 1 && <ChevronRight size={12} className="text-slate-200" />}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-3 hover:bg-slate-50 rounded-2xl transition-all relative">
                            <Bell size={18} className="text-slate-400" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white" />
                        </button>
                        <Link to="/credentials" className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-[11px] font-black border border-white/10 hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-200">
                            {getUserInitials(user)}
                        </Link>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto dot-pattern">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-12 h-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}


