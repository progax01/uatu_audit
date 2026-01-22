import { useState, useEffect } from 'react'
import { Shield, Wallet, Github, ExternalLink, Copy, Check, Key, ChevronRight, Eye, EyeOff, AlertCircle, CheckCircle, Building2, Zap, Crown, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { getStoredUser, type AuthUser } from '../services/authService'
import { useAccount, useDisconnect, useChainId } from 'wagmi'
import { Link } from 'react-router-dom'

// Explorer URLs for different chains
const CHAIN_EXPLORERS: Record<number, string> = {
    1: 'https://etherscan.io',
    42161: 'https://arbiscan.io',
    137: 'https://polygonscan.com',
    8453: 'https://basescan.org',
    10: 'https://optimistic.etherscan.io',
    56: 'https://bscscan.com',
    43114: 'https://snowtrace.io',
}

const TIER_CONFIG = {
    free: { label: 'Free', icon: Star, color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
    pro: { label: 'Pro', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    enterprise: { label: 'Enterprise', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
}

export default function Settings() {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [showTokenInput, setShowTokenInput] = useState(false)
    const [githubToken, setGithubToken] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [tokenSaving, setTokenSaving] = useState(false)
    const [tokenSaved, setTokenSaved] = useState(false)
    const [tokenError, setTokenError] = useState('')

    // Profile editing state
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [profileForm, setProfileForm] = useState({
        displayName: '',
        email: '',
        bio: '',
        company: '',
        website: '',
        twitterHandle: ''
    })
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileError, setProfileError] = useState('')

    const { address, isConnected } = useAccount()
    const { disconnect } = useDisconnect()
    const chainId = useChainId()
    const explorerUrl = CHAIN_EXPLORERS[chainId] || 'https://etherscan.io'
    const [walletCopied, setWalletCopied] = useState(false)

    // Fetch fresh user data from server
    const fetchUpdatedUserData = async () => {
        try {
            const token = localStorage.getItem('uatu_access_token')
            if (!token) return

            const response = await fetch('/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.user) {
                    setUser(data.user)
                    localStorage.setItem('uatu_user', JSON.stringify(data.user))
                }
            }
        } catch (error) {
            console.error('Failed to fetch updated user data:', error)
        }
    }

    useEffect(() => {
        const storedUser = getStoredUser()
        setUser(storedUser)

        // Initialize profile form with user data
        if (storedUser) {
            setProfileForm({
                displayName: storedUser.displayName || '',
                email: storedUser.email || '',
                bio: storedUser.bio || '',
                company: storedUser.company || '',
                website: storedUser.website || '',
                twitterHandle: storedUser.twitterHandle || ''
            })
        }

        // Check if user has a stored PAT
        const storedToken = localStorage.getItem('github_pat')
        if (storedToken) {
            setGithubToken(storedToken)
        }

        // Check URL params for GitHub connection result
        const params = new URLSearchParams(window.location.search)
        const status = params.get('github_connect')
        const message = params.get('message')

        if (status === 'success') {
            setTokenSaved(true)
            setTokenError('')
            // Clean URL
            window.history.replaceState({}, '', '/settings')
            // Fetch fresh user data from server to get updated GitHub info
            fetchUpdatedUserData().then(() => {
                // Success message will auto-hide after 5 seconds
                setTimeout(() => setTokenSaved(false), 5000)
            })
        } else if (status === 'error') {
            setTokenError(message || 'Failed to connect GitHub account')
            // Clean URL
            window.history.replaceState({}, '', '/settings')
        }
    }, [])

    const copyWalletAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setWalletCopied(true)
            setTimeout(() => setWalletCopied(false), 2000)
        }
    }

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const handleGitHubConnect = () => {
        // Store return URL so we come back to settings after OAuth
        localStorage.setItem('oauth_return_url', '/settings')

        // Pass current user ID in state to trigger account linking instead of creating new user
        const currentUser = getStoredUser()
        if (currentUser?.id) {
            const stateData = {
                returnUrl: '/settings',
                linkToUserId: currentUser.id  // Signal this is an account linking request
            }
            const encodedState = btoa(JSON.stringify(stateData))
            window.location.href = `/auth/github/login?state=${encodeURIComponent(encodedState)}`
        } else {
            window.location.href = '/auth/github/login'
        }
    }

    const handleSaveToken = async () => {
        if (!githubToken.trim()) {
            setTokenError('Please enter a valid token')
            return
        }

        if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
            setTokenError('Invalid token format. Token should start with ghp_ or github_pat_')
            return
        }

        setTokenSaving(true)
        setTokenError('')

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github+json'
                }
            })

            if (!response.ok) {
                throw new Error('Invalid token')
            }

            localStorage.setItem('github_pat', githubToken)

            await fetch('/api/user/github-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: githubToken })
            }).catch(() => { })

            setTokenSaved(true)
            setShowTokenInput(false)
            setTimeout(() => setTokenSaved(false), 3000)
        } catch (err) {
            setTokenError('Invalid token. Please check and try again.')
        } finally {
            setTokenSaving(false)
        }
    }

    const handleRemoveToken = () => {
        setGithubToken('')
        localStorage.removeItem('github_pat')
        setTokenSaved(false)
    }

    const handleSaveProfile = async () => {
        setProfileSaving(true)
        setProfileError('')

        try {
            const token = localStorage.getItem('uatu_access_token')
            if (!token) {
                setProfileError('Not authenticated. Please log in again.')
                return
            }

            const response = await fetch('/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileForm)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update profile')
            }

            const data = await response.json()

            // Update local user data
            const updatedUser = { ...user, ...data.user }
            setUser(updatedUser as AuthUser)
            localStorage.setItem('uatu_user', JSON.stringify(updatedUser))

            setIsEditingProfile(false)
            setTokenSaved(true) // Reuse success indicator
            setTimeout(() => setTokenSaved(false), 3000)
        } catch (err: any) {
            setProfileError(err.message || 'Failed to update profile')
        } finally {
            setProfileSaving(false)
        }
    }

    const handleCancelEdit = () => {
        // Reset form to current user data
        if (user) {
            setProfileForm({
                displayName: user.displayName || '',
                email: user.email || '',
                bio: user.bio || '',
                company: user.company || '',
                website: user.website || '',
                twitterHandle: user.twitterHandle || ''
            })
        }
        setIsEditingProfile(false)
        setProfileError('')
    }

    const tierConfig = TIER_CONFIG[user?.tier || 'free']
    const TierIcon = tierConfig.icon
    // Display name priority: displayName (real name) > username (Uatu username) > githubLogin > Anonymous
    const primaryName = user?.displayName || user?.username || user?.githubLogin || 'Anonymous'
    const initials = primaryName.slice(0, 2).toUpperCase()

    // Show secondary identifiers if available
    const showGithubHandle = user?.githubLogin && user?.githubLogin !== primaryName
    const showUatuUsername = user?.username && user?.username !== primaryName && user?.username !== user?.githubLogin

    return (
        <div className="space-y-8 animate-reveal">
            {/* Profile Cards - Side by Side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Profile Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-premium"
                >
                    <div className="flex items-start gap-6">
                        {/* Avatar */}
                        <div className="relative">
                            {user?.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt={primaryName}
                                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-lg"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                                    {initials}
                                </div>
                            )}
                            {/* Online indicator */}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black text-slate-900 truncate">
                                    {primaryName}
                                    {showGithubHandle && (
                                        <span className="text-slate-400 font-medium ml-2">(@{user.githubLogin})</span>
                                    )}
                                </h2>
                                <span className={`px-2.5 py-1 ${tierConfig.bg} ${tierConfig.border} ${tierConfig.color} text-[9px] font-black rounded-full uppercase tracking-wider flex items-center gap-1 border`}>
                                    <TierIcon size={10} />
                                    {tierConfig.label}
                                </span>
                            </div>
                            {showUatuUsername && (
                                <p className="text-sm text-slate-500">
                                    Username: <span className="font-semibold text-slate-700">{user.username}</span>
                                </p>
                            )}

                            {user?.email && (
                                <p className="text-slate-400 text-sm mb-3">{user.email}</p>
                            )}

                            {/* Organization / Company */}
                            {user?.company && (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Building2 size={14} className="text-slate-400" />
                                    <span className="text-sm font-medium">{user.company}</span>
                                </div>
                            )}

                            {/* Stats Row */}
                            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-black/[0.03]">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">XP Balance</p>
                                    <p className="text-lg font-black text-slate-900">{(user?.xpBalance || 0).toLocaleString()}</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audits Used</p>
                                    <p className="text-lg font-black text-slate-900">{user?.monthlyAuditsUsed || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Profile Settings Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="card-premium"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Profile Settings</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">Update your personal information</p>
                        </div>
                        {!isEditingProfile && (
                            <button
                                onClick={() => setIsEditingProfile(true)}
                                className="px-4 h-9 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600 transition-all"
                            >
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {!isEditingProfile ? (
                        /* Display Mode */
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email</label>
                                    <p className="text-sm text-slate-900">{user?.email || 'Not set'}</p>
                                    {user?.githubEmail && user?.githubEmail !== user?.email && (
                                        <p className="text-[11px] text-slate-400 mt-1">GitHub: {user.githubEmail}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Company</label>
                                    <p className="text-sm text-slate-900">{user?.company || 'Not set'}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bio</label>
                                <p className="text-sm text-slate-900">{user?.bio || 'Not set'}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Website</label>
                                    <p className="text-sm text-slate-900">{user?.website || 'Not set'}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Twitter</label>
                                    <p className="text-sm text-slate-900">{user?.twitterHandle ? `@${user.twitterHandle}` : 'Not set'}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Edit Mode */
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={profileForm.displayName}
                                        onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                                        placeholder="Your name"
                                        className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={profileForm.email}
                                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                        placeholder="your@email.com"
                                        className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bio</label>
                                <textarea
                                    value={profileForm.bio}
                                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                                    placeholder="Tell us about yourself..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Company</label>
                                    <input
                                        type="text"
                                        value={profileForm.company}
                                        onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                                        placeholder="Your company"
                                        className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Website</label>
                                    <input
                                        type="url"
                                        value={profileForm.website}
                                        onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                                        placeholder="https://yourwebsite.com"
                                        className="w-full h-11 px-4 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Twitter Handle</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                                    <input
                                        type="text"
                                        value={profileForm.twitterHandle}
                                        onChange={(e) => setProfileForm({ ...profileForm, twitterHandle: e.target.value.replace('@', '') })}
                                        placeholder="username"
                                        className="w-full h-11 pl-8 pr-4 bg-white border border-black/[0.05] rounded-lg text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                </div>
                            </div>

                            {profileError && (
                                <div className="flex items-center gap-2 text-rose-600 text-xs p-3 bg-rose-50 rounded-lg border border-rose-100">
                                    <AlertCircle size={14} />
                                    {profileError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleCancelEdit}
                                    disabled={profileSaving}
                                    className="flex-1 h-11 bg-white border border-black/[0.05] rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={profileSaving}
                                    className="flex-1 h-11 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-indigo-600 transition-all disabled:opacity-50"
                                >
                                    {profileSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Connected Services Header */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <Shield size={18} />
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Connected Services</h2>
                    <p className="text-[11px] text-slate-400">Authentication methods linked to your account</p>
                </div>
            </div>

            {/* Connected Services Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* GitHub Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                            <Github size={22} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-slate-900 text-base">GitHub</h3>
                            {user?.githubLogin ? (
                                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                                    <CheckCircle size={12} />
                                    Connected as @{user.githubLogin}
                                </p>
                            ) : githubToken ? (
                                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                                    <Key size={12} />
                                    Personal Access Token set
                                </p>
                            ) : (
                                <p className="text-[11px] text-slate-400">Not connected</p>
                            )}
                        </div>
                        {(user?.githubLogin || githubToken) && (
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-black rounded-full uppercase">
                                Active
                            </span>
                        )}
                    </div>

                    <p className="text-slate-400 text-xs mb-5 leading-relaxed">
                        Connect GitHub to audit private repositories and enable automatic code analysis.
                    </p>

                    {/* Token Input Section */}
                    {showTokenInput && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-5"
                        >
                            <div className="p-4 bg-slate-50 rounded-xl border border-black/[0.03] space-y-3">
                                <div className="relative">
                                    <input
                                        type={showToken ? 'text' : 'password'}
                                        value={githubToken}
                                        onChange={(e) => { setGithubToken(e.target.value); setTokenError(''); }}
                                        placeholder="ghp_xxxxxxxxxxxx"
                                        className="w-full h-11 pl-4 pr-12 bg-white border border-black/[0.05] rounded-lg text-sm font-mono text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                                    />
                                    <button
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                {tokenError && (
                                    <div className="flex items-center gap-2 text-rose-600 text-xs">
                                        <AlertCircle size={14} />
                                        {tokenError}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowTokenInput(false)}
                                        className="flex-1 h-9 bg-white border border-black/[0.05] rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveToken}
                                        disabled={tokenSaving || !githubToken.trim()}
                                        className="flex-1 h-9 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-600 transition-all disabled:opacity-50"
                                    >
                                        {tokenSaving ? 'Validating...' : 'Save Token'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Success Message */}
                    {tokenSaved && !showTokenInput && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-600 text-xs font-medium"
                        >
                            <CheckCircle size={14} />
                            Token saved successfully!
                        </motion.div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {!user?.githubLogin && !showTokenInput && !githubToken && (
                            <>
                                <button
                                    onClick={handleGitHubConnect}
                                    className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Github size={16} />
                                    Connect with GitHub
                                </button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-slate-200" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-3 bg-white text-[10px] text-slate-400 font-bold uppercase tracking-wider">or</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowTokenInput(true)}
                                    className="w-full h-11 bg-slate-50 border border-black/[0.05] text-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Key size={14} />
                                    Add Personal Access Token
                                </button>
                            </>
                        )}

                        {user?.githubLogin && (
                            <div className="flex items-center gap-3">
                                <a
                                    href={`https://github.com/${user.githubLogin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 h-11 bg-slate-50 border border-black/[0.05] text-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    View Profile
                                </a>
                                {!githubToken && (
                                    <button
                                        onClick={() => setShowTokenInput(true)}
                                        className="flex-1 h-11 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Key size={14} />
                                        Add PAT
                                    </button>
                                )}
                            </div>
                        )}

                        {githubToken && !showTokenInput && (
                            <button
                                onClick={handleRemoveToken}
                                className="w-full h-11 bg-slate-50 border border-rose-100 text-rose-600 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-rose-50 transition-all"
                            >
                                Remove Token
                            </button>
                        )}
                    </div>

                    {/* Learn More Link */}
                    <div className="mt-5 pt-4 border-t border-black/[0.03]">
                        <Link
                            to="/docs/github-pat"
                            className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1.5 group"
                        >
                            Learn how to create a Personal Access Token
                            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </motion.div>

                {/* Wallet Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="card-premium"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                            <Wallet size={22} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-slate-900 text-base">Wallet</h3>
                            {isConnected && address ? (
                                <p className="text-[11px] text-emerald-600 font-mono flex items-center gap-1.5">
                                    <CheckCircle size={12} />
                                    {truncateAddress(address)}
                                </p>
                            ) : (
                                <p className="text-[11px] text-slate-400">Not connected</p>
                            )}
                        </div>
                        {isConnected && (
                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-black rounded-full uppercase">
                                Connected
                            </span>
                        )}
                    </div>

                    <p className="text-slate-400 text-xs mb-5 leading-relaxed">
                        Connect your wallet to access premium features and manage your subscription.
                    </p>

                    {isConnected && address ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-black/[0.03]">
                                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex-shrink-0" />
                                <span className="font-mono text-sm text-slate-900 font-medium flex-1 truncate">{truncateAddress(address)}</span>
                                <button
                                    onClick={copyWalletAddress}
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                    {walletCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                <a
                                    href={`${explorerUrl}/address/${address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                    <ExternalLink size={14} />
                                </a>
                            </div>

                            <button
                                onClick={() => disconnect()}
                                className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600 transition-all"
                            >
                                Change Wallet
                            </button>
                        </div>
                    ) : (
                        <button className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                            <Wallet size={16} />
                            Connect Wallet
                        </button>
                    )}

                    {isConnected && address && (
                        <div className="mt-5 pt-4 border-t border-black/[0.03]">
                            <a
                                href={`${explorerUrl}/address/${address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-600 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1.5 group"
                            >
                                View full transaction history
                                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </a>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    )
}
