import { useState } from 'react'
import { GitBranch, Bell, Package, Play, Shield, Save, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuditSettings {
    // Library settings
    auditOpenZeppelin: boolean
    auditOpenSourceLibs: boolean
    skipNodeModules: boolean

    // Branch settings
    autoAuditMainBranch: boolean
    auditOnEveryPush: boolean
    auditBranchPattern: string

    // Automation
    autoStartAudit: boolean
    requireApproval: boolean

    // Notifications
    telegramEnabled: boolean
    telegramChatId: string
    slackEnabled: boolean
    slackWebhook: string
    emailNotifications: boolean
}

export default function Settings() {
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [settings, setSettings] = useState<AuditSettings>({
        auditOpenZeppelin: false,
        auditOpenSourceLibs: false,
        skipNodeModules: true,
        autoAuditMainBranch: true,
        auditOnEveryPush: false,
        auditBranchPattern: 'audit/*',
        autoStartAudit: false,
        requireApproval: true,
        telegramEnabled: false,
        telegramChatId: '',
        slackEnabled: false,
        slackWebhook: '',
        emailNotifications: true,
    })

    const handleSave = async () => {
        setSaving(true)
        try {
            // Save settings to API
            await new Promise(resolve => setTimeout(resolve, 1000))
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Failed to save settings:', err)
        } finally {
            setSaving(false)
        }
    }

    const updateSetting = <K extends keyof AuditSettings>(key: K, value: AuditSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    return (
        <div className="space-y-8 animate-reveal">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                        Audit <span className="text-indigo-600">Settings</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-[13px] mt-2 max-w-xl leading-relaxed">
                        Configure how audits run, what gets scanned, and notification preferences.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`btn-primary h-12 px-6 ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                >
                    {saving ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : saved ? (
                        <Shield size={16} />
                    ) : (
                        <Save size={16} />
                    )}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            {/* Library Scanning */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                        <Package size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Library Scanning</h2>
                        <p className="text-[11px] text-slate-400">Choose which dependencies to include in audits</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Audit OpenZeppelin Contracts</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Include @openzeppelin/* in security scans</p>
                        </div>
                        <Toggle checked={settings.auditOpenZeppelin} onChange={(v) => updateSetting('auditOpenZeppelin', v)} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Audit Open Source Libraries</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Scan Solady, Solmate, and other verified libs</p>
                        </div>
                        <Toggle checked={settings.auditOpenSourceLibs} onChange={(v) => updateSetting('auditOpenSourceLibs', v)} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Skip node_modules</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Exclude NPM packages from audit scope</p>
                        </div>
                        <Toggle checked={settings.skipNodeModules} onChange={(v) => updateSetting('skipNodeModules', v)} />
                    </div>
                </div>
            </motion.div>

            {/* Branch Configuration */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                        <GitBranch size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Branch Configuration</h2>
                        <p className="text-[11px] text-slate-400">Control when audits are triggered</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Auto-audit on main branch</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Run audit when changes merge to main/master</p>
                        </div>
                        <Toggle checked={settings.autoAuditMainBranch} onChange={(v) => updateSetting('autoAuditMainBranch', v)} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Audit on every push</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Trigger audit on every commit (uses more neurons)</p>
                        </div>
                        <Toggle checked={settings.auditOnEveryPush} onChange={(v) => updateSetting('auditOnEveryPush', v)} />
                    </div>

                    <div className="p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <h3 className="font-bold text-slate-900 text-sm mb-2">Audit Branch Pattern</h3>
                        <p className="text-[11px] text-slate-400 mb-3">Only audit branches matching this pattern</p>
                        <input
                            type="text"
                            value={settings.auditBranchPattern}
                            onChange={(e) => updateSetting('auditBranchPattern', e.target.value)}
                            placeholder="audit/*, feature/security-*"
                            className="w-full h-10 px-4 bg-white border border-black/[0.05] rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-mono"
                        />
                    </div>
                </div>
            </motion.div>

            {/* Automation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                        <Play size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Automation</h2>
                        <p className="text-[11px] text-slate-400">Control audit execution behavior</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Auto-start audits</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Begin auditing immediately when triggered</p>
                        </div>
                        <Toggle checked={settings.autoStartAudit} onChange={(v) => updateSetting('autoStartAudit', v)} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Require approval before audit</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Wait for manual approval before consuming neurons</p>
                        </div>
                        <Toggle checked={settings.requireApproval} onChange={(v) => updateSetting('requireApproval', v)} />
                    </div>
                </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card-premium"
            >
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                        <Bell size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Notifications</h2>
                        <p className="text-[11px] text-slate-400">Get alerts when audits complete or find issues</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Email notifications</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Receive audit reports via email</p>
                        </div>
                        <Toggle checked={settings.emailNotifications} onChange={(v) => updateSetting('emailNotifications', v)} />
                    </div>

                    <div className="p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Telegram alerts</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Send notifications to Telegram</p>
                            </div>
                            <Toggle checked={settings.telegramEnabled} onChange={(v) => updateSetting('telegramEnabled', v)} />
                        </div>
                        {settings.telegramEnabled && (
                            <input
                                type="text"
                                value={settings.telegramChatId}
                                onChange={(e) => updateSetting('telegramChatId', e.target.value)}
                                placeholder="Chat ID (e.g., -1001234567890)"
                                className="w-full h-10 px-4 bg-white border border-black/[0.05] rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-mono"
                            />
                        )}
                    </div>

                    <div className="p-4 bg-slate-50/50 rounded-xl border border-black/[0.03]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Slack integration</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">Post audit results to Slack channel</p>
                            </div>
                            <Toggle checked={settings.slackEnabled} onChange={(v) => updateSetting('slackEnabled', v)} />
                        </div>
                        {settings.slackEnabled && (
                            <input
                                type="text"
                                value={settings.slackWebhook}
                                onChange={(e) => updateSetting('slackWebhook', e.target.value)}
                                placeholder="Webhook URL"
                                className="w-full h-10 px-4 bg-white border border-black/[0.05] rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-mono"
                            />
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

// Toggle component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </button>
    )
}
