import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Loader2, ChevronRight, ShieldCheck, AtSign, X, Check, Fingerprint, Network, UserCircle } from 'lucide-react';
import { getStoredUser, storeAuth, getAccessToken, getRefreshToken, authFetch } from '../services/authService';
import debounce from 'lodash.debounce';

export default function Onboarding() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(1);

    // Form state
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [bio, setBio] = useState('');
    const [company, setCompany] = useState('');
    const [website, setWebsite] = useState('');
    const [twitter, setTwitter] = useState('');

    // Username validation state
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
    const [usernameError, setUsernameError] = useState<string | null>(null);

    const storedUser = getStoredUser();

    useEffect(() => {
        if (storedUser?.displayName && !displayName) {
            setDisplayName(storedUser.displayName);
        }
    }, [storedUser, displayName]);

    const checkUsername = useCallback(
        debounce(async (value: string) => {
            if (!value || value.length < 3) {
                setUsernameStatus('idle');
                return;
            }
            const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
            if (!usernameRegex.test(value)) {
                setUsernameStatus('invalid');
                setUsernameError('3-30 chars, starts with letter');
                return;
            }
            setUsernameStatus('checking');
            setUsernameError(null);
            try {
                const resp = await fetch(`/auth/username/check?username=${encodeURIComponent(value)}`);
                const data = await resp.json();
                if (data.available) {
                    setUsernameStatus('available');
                } else {
                    setUsernameStatus('taken');
                    setUsernameError(data.reason || 'Username taken');
                }
            } catch {
                setUsernameStatus('idle');
                setUsernameError('Check failed');
            }
        }, 500),
        []
    );

    useEffect(() => {
        checkUsername(username);
    }, [username, checkUsername]);

    const handleSubmit = async () => {
        if (!username || usernameStatus !== 'available') {
            setError('Please choose a valid username');
            setCurrentStep(1);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await authFetch('/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.toLowerCase(),
                    displayName: displayName || undefined,
                    email: email || undefined,
                    bio: bio || undefined,
                    company: company || undefined,
                    website: website || undefined,
                    twitterHandle: twitter || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save');
            }

            const data = await response.json();
            const accessToken = getAccessToken();
            const refreshToken = getRefreshToken();
            if (accessToken && refreshToken && data.user) {
                storeAuth(
                    { accessToken, refreshToken, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
                    { ...storedUser, ...data.user, needsUsername: false }
                );
            }
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const nextStep = () => {
        if (currentStep === 1 && (usernameStatus !== 'available' || !username)) {
            setUsernameError('Valid username required');
            return;
        }
        if (currentStep < 3) setCurrentStep(currentStep + 1);
        else handleSubmit();
    };

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const steps = [
        { id: 1, title: 'Identity', icon: Fingerprint, desc: 'Secure your network handle' },
        { id: 2, title: 'Network', icon: Network, desc: 'Connect your reach' },
        { id: 3, title: 'Profile', icon: UserCircle, desc: 'Establish your presence' },
    ];

    return (
        <div className="h-screen bg-[#FDFDFD] flex flex-col lg:flex-row font-body relative overflow-hidden">
            {/* Elegant Background Accents */}
            <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-5 pointer-events-none" />

            {/* Left Section: Branding & Progress (Fixed on Large Screens) */}
            <div className="w-full lg:w-[450px] bg-slate-50 lg:h-screen p-8 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-black/[0.03] z-50 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="mb-20"
                    >
                        <div className="flex flex-col gap-6">
                            <img src="/logo.svg" alt="Uatu" className="w-24 h-auto object-contain" />
                            <div>
                                <div className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">Protocol Node v1.0</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Secure Network Layer</div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="space-y-12">
                        {steps.map((s, idx) => (
                            <motion.div
                                key={s.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                className={`flex items-start gap-6 transition-all duration-500 ${currentStep === s.id ? 'opacity-100 scale-100' : 'opacity-40 scale-95 origin-left'}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${currentStep === s.id ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-100/50 text-white' :
                                    currentStep > s.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'
                                    }`}>
                                    {currentStep > s.id ? <Check size={18} strokeWidth={3} /> : <s.icon size={18} strokeWidth={2.5} />}
                                </div>
                                <div className="pt-1">
                                    <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] mb-1 ${currentStep === s.id ? 'text-slate-900' : 'text-slate-500'}`}>{s.title}</h3>
                                    <p className={`text-[10px] font-bold leading-relaxed ${currentStep === s.id ? 'text-slate-500' : 'text-slate-400'}`}>{s.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto hidden lg:block relative -mx-8 -mb-16 pointer-events-none">
                    {/* Vivid Gradient Glow for Watermark effect */}
                    <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent blur-[100px] rounded-full" />

                    <img
                        src="/mascot.png"
                        alt="Mascot"
                        className="w-full h-auto opacity-[0.32] filter saturate-[1.4] brightness-110 scale-x-[-1] relative z-10 mix-blend-multiply"
                    />
                    <div className="absolute bottom-24 left-16 z-20">
                        <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.5em] opacity-30 leading-relaxed">
                            The eye of security <br />
                            <span className="mt-1 block">never sleeps</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Section: Form Content (Fixed Bottom Bar) */}
            <div className="flex-1 lg:h-screen flex flex-col bg-white relative">
                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto lg:p-12 xl:p-24 flex items-center justify-center pb-40">
                    {/* Floating Glows */}
                    <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="w-full max-w-xl p-8 lg:p-0"
                    >
                        <div className="mb-12">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                                {currentStep === 1 && 'Define identifier'}
                                {currentStep === 2 && 'Network reach'}
                                {currentStep === 3 && 'Publish persona'}
                            </h2>
                            <p className="text-sm text-slate-500 font-bold">
                                {currentStep === 1 && 'Select your persistent handle for the network.'}
                                {currentStep === 2 && 'Configure cross-protocol contact methods.'}
                                {currentStep === 3 && 'Document your technical specialization.'}
                            </p>
                        </div>

                        <div className="relative">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-8 p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-rose-200/50 flex items-center justify-center text-rose-600 shrink-0">
                                        <X size={14} strokeWidth={3} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">{error}</span>
                                </motion.div>
                            )}

                            <AnimatePresence mode="wait">
                                {currentStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, scale: 0.98, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 1.02, x: -20 }}
                                        className="space-y-10"
                                    >
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Username <span className="text-rose-500">*</span></label>
                                                {usernameStatus === 'available' && (
                                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                        Verified
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                                    placeholder="vitalik_u"
                                                    className={`w-full h-20 px-8 bg-slate-50 border-2 rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:bg-white ${usernameStatus === 'available' ? 'border-emerald-100 focus:border-emerald-500' :
                                                        usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-rose-100 focus:border-rose-500' :
                                                            'border-transparent focus:border-indigo-500'
                                                        }`}
                                                />
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                                    {usernameStatus === 'checking' && <Loader2 size={24} className="text-slate-300 animate-spin" />}
                                                    {usernameStatus === 'available' && <ShieldCheck size={28} className="text-emerald-500" strokeWidth={2.5} />}
                                                </div>
                                            </div>
                                            {usernameError ? (
                                                <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest">{usernameError}</p>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 font-medium">uatu.xyz/<span className="text-indigo-600 font-bold">{username || 'alias'}</span></p>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Display Name</label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                placeholder="Your full name"
                                                className="w-full h-20 px-8 bg-slate-50 border-2 border-transparent rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {currentStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, scale: 0.98, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        className="space-y-10"
                                    >
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Email Reach</label>
                                            <div className="relative group">
                                                <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                                                    <Mail size={22} />
                                                </div>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="contact@foundation.com"
                                                    className="w-full h-20 pl-16 pr-8 bg-slate-50 border-2 border-transparent rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Social Coordinate (@Twitter)</label>
                                            <div className="relative group">
                                                <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors">
                                                    <AtSign size={22} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={twitter}
                                                    onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
                                                    placeholder="handle"
                                                    className="w-full h-20 pl-16 pr-8 bg-slate-50 border-2 border-transparent rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {currentStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, scale: 0.98, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        className="space-y-10"
                                    >
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Professional Dossier (Bio)</label>
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                placeholder="Security researcher, auditor, builder..."
                                                rows={4}
                                                className="w-full p-8 bg-slate-50 border-2 border-transparent rounded-[32px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Affiliation</label>
                                                <input
                                                    type="text"
                                                    value={company}
                                                    onChange={(e) => setCompany(e.target.value)}
                                                    placeholder="Org name"
                                                    className="w-full h-20 px-8 bg-slate-50 border-2 border-transparent rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] block">Website</label>
                                                <input
                                                    type="url"
                                                    value={website}
                                                    onChange={(e) => setWebsite(e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full h-20 px-8 bg-slate-50 border-2 border-transparent rounded-[24px] text-lg font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>

                {/* Fixed Bottom Action Dock */}
                <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12 bg-white/60 backdrop-blur-xl border-t border-black/[0.03] z-50">
                    <div className="max-w-xl mx-auto flex items-center justify-between">
                        <div className="flex gap-8 items-center">
                            {currentStep > 1 && (
                                <button
                                    onClick={prevStep}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] hover:text-slate-900 transition-colors flex items-center gap-2"
                                >
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    Step Back
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] hover:text-indigo-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>

                        <button
                            onClick={nextStep}
                            disabled={isLoading}
                            className="h-16 px-10 bg-indigo-600 text-white rounded-[20px] font-black text-[11px] uppercase tracking-[0.25em] hover:bg-slate-900 hover:shadow-2xl transition-all duration-500 flex items-center justify-center gap-4 active:scale-[0.96] shadow-xl shadow-indigo-100/50"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    {currentStep === 3 ? 'Establish Presence' : 'Continue Step'}
                                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                        <ChevronRight size={14} strokeWidth={3} />
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
