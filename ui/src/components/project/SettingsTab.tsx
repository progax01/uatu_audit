import { useState, useEffect } from 'react'
import { Upload, Save, Loader2, Check, Image as ImageIcon, Globe, Github, Twitter, FileText, Palette } from 'lucide-react'
import { authFetch } from '../../services/authService'

interface SettingsTabProps {
    projectId: string
    initialSettings?: {
        logoUrl?: string
        websiteUrl?: string
        primaryColor?: string
        contractAddress?: string
        chainId?: string
        docsUrl?: string
        githubUrl?: string
        twitterUrl?: string
        discordUrl?: string
    }
}

export default function SettingsTab({ projectId, initialSettings }: SettingsTabProps) {
    const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl || '')
    const [logoPreview, setLogoPreview] = useState(initialSettings?.logoUrl || '')
    const [websiteUrl, setWebsiteUrl] = useState(initialSettings?.websiteUrl || '')
    const [primaryColor, setPrimaryColor] = useState(initialSettings?.primaryColor || '#5C61FF')
    const [contractAddress, setContractAddress] = useState(initialSettings?.contractAddress || '')
    const [chainId, setChainId] = useState(initialSettings?.chainId || 'ethereum')
    const [docsUrl, setDocsUrl] = useState(initialSettings?.docsUrl || '')
    const [githubUrl, setGithubUrl] = useState(initialSettings?.githubUrl || '')
    const [twitterUrl, setTwitterUrl] = useState(initialSettings?.twitterUrl || '')
    const [discordUrl, setDiscordUrl] = useState(initialSettings?.discordUrl || '')

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    // Convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (PNG, JPG, SVG)')
            return
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be less than 2MB')
            return
        }

        setUploading(true)
        setError(null)

        try {
            const base64 = await fileToBase64(file)
            setLogoUrl(base64)
            setLogoPreview(base64)
        } catch (err) {
            setError('Failed to process image')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        setSaved(false)

        try {
            const response = await authFetch(`/api/projects/${projectId}/settings`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    logoUrl,
                    websiteUrl,
                    primaryColor,
                    contractAddress,
                    chainId,
                    docsUrl,
                    githubUrl,
                    twitterUrl,
                    discordUrl
                })
            })

            if (!response.ok) {
                throw new Error('Failed to save settings')
            }

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err: any) {
            setError(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Branding Section */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <Palette className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Branding & Visual Identity</h3>
                        <p className="text-sm text-slate-500">Customize how your project appears in audit reports</p>
                    </div>
                </div>

                {/* Logo Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                        Project Logo
                    </label>
                    <div className="flex items-start gap-6">
                        {/* Preview */}
                        <div className="flex-shrink-0">
                            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                                ) : (
                                    <ImageIcon className="text-slate-300" size={32} />
                                )}
                            </div>
                        </div>

                        {/* Upload Button */}
                        <div className="flex-1">
                            <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors cursor-pointer">
                                {uploading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} />
                                        Upload Logo
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </label>
                            <p className="text-xs text-slate-500 mt-2">
                                PNG, JPG, SVG up to 2MB. Recommended: square format, transparent background
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                This logo will appear on your audit reports, certificates, and public badge
                            </p>
                        </div>
                    </div>
                </div>

                {/* Primary Color */}
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-3">
                        Brand Color
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-20 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            placeholder="#5C61FF"
                            className="flex-1 px-4 py-3 bg-white rounded-xl border-2 border-slate-200 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Used for accents in audit reports and public badge
                    </p>
                </div>
            </div>

            {/* Contract Information */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <FileText className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Contract Details</h3>
                        <p className="text-sm text-slate-500">Main contract information for reports</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Contract Address
                        </label>
                        <input
                            type="text"
                            value={contractAddress}
                            onChange={(e) => setContractAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Network
                        </label>
                        <select
                            value={chainId}
                            onChange={(e) => setChainId(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 cursor-pointer"
                        >
                            <option value="ethereum">Ethereum Mainnet</option>
                            <option value="arbitrum">Arbitrum One</option>
                            <option value="polygon">Polygon</option>
                            <option value="base">Base</option>
                            <option value="optimism">Optimism</option>
                            <option value="bnb">BNB Chain</option>
                            <option value="avalanche">Avalanche</option>
                            <option value="fantom">Fantom</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Links Section */}
            <div className="bg-white rounded-2xl border-2 border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <Globe className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Project Links</h3>
                        <p className="text-sm text-slate-500">Social profiles and documentation</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                            <Globe size={16} />
                            Website
                        </label>
                        <input
                            type="url"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            placeholder="https://yourproject.com"
                            className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                            <FileText size={16} />
                            Documentation
                        </label>
                        <input
                            type="url"
                            value={docsUrl}
                            onChange={(e) => setDocsUrl(e.target.value)}
                            placeholder="https://docs.yourproject.com"
                            className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                <Github size={16} />
                                GitHub
                            </label>
                            <input
                                type="url"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                placeholder="https://github.com/..."
                                className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                <Twitter size={16} />
                                Twitter
                            </label>
                            <input
                                type="url"
                                value={twitterUrl}
                                onChange={(e) => setTwitterUrl(e.target.value)}
                                placeholder="https://twitter.com/..."
                                className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                                </svg>
                                Discord
                            </label>
                            <input
                                type="url"
                                value={discordUrl}
                                onChange={(e) => setDiscordUrl(e.target.value)}
                                placeholder="https://discord.gg/..."
                                className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t-2 border-slate-100">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
                >
                    {saving ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Saving...
                        </>
                    ) : saved ? (
                        <>
                            <Check size={20} />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
