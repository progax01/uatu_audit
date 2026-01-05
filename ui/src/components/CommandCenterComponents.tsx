import { motion } from 'framer-motion';
import { Shield, Activity, Box, GitBranch, Bell, ShieldCheck, Zap } from 'lucide-react';

/**
 * IntegrityScoreboard: Artistic HUD for Project Health (Alabaster Edition)
 */
export const IntegrityScoreboard = ({ score = 94, grade = 'A' }: { score?: number; grade?: string }) => {
    return (
        <div className="relative group">
            {/* Soft Ambient Glow */}
            <div className="absolute -inset-10 bg-indigo-500/5 rounded-full blur-[100px] group-hover:bg-indigo-500/10 transition-all duration-1000" />

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-72 h-72 rounded-full border border-black/[0.03] flex flex-col items-center justify-center bg-white/80 backdrop-blur-3xl shadow-premium"
            >
                {/* Minimalist Tech Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-dashed border-indigo-500/10"
                />

                <span className="text-[10px] font-black tracking-[0.3em] text-indigo-600 uppercase mb-3">Project Vitality</span>
                <div className="text-[100px] font-black text-slate-900 leading-none tracking-tighter tabular-nums">{score}</div>
                <div className="flex items-center gap-3 mt-4">
                    <span className="text-[10px] font-black text-slate-400 tracking-[0.2em]">GRADE</span>
                    <span className="text-2xl font-black text-indigo-600 tracking-tight">{grade}</span>
                </div>

                {/* Secure Status Indicator */}
                <div className="absolute bottom-12 flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    />
                    <span className="text-[9px] font-black text-emerald-600 tracking-[0.1em] uppercase">Secured</span>
                </div>
            </motion.div>
        </div>
    );
};

/**
 * SecurityStream: Vertical Activity Feed (Alabaster Edition)
 */
export const SecurityStream = () => {
    const events = [
        { type: 'info', msg: 'Branch [main] protection established', time: '2m ago', icon: <GitBranch size={14} strokeWidth={1.5} /> },
        { type: 'warn', msg: 'NPM: axios@1.x low-severity CVE detected', time: '15m ago', icon: <Box size={14} strokeWidth={1.5} /> },
        { type: 'crit', msg: 'Logic anomaly blocked in Vault.sol', time: '1h ago', icon: <Shield size={14} strokeWidth={1.5} /> },
        { type: 'info', msg: 'Integrity scan completed: 100% pass', time: '3h ago', icon: <Activity size={14} strokeWidth={1.5} /> },
    ];

    return (
        <div className="flex flex-col gap-4 w-full">
            {events.map((event, i) => (
                <motion.div
                    key={i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
                    className="flex items-center gap-5 p-5 rounded-[24px] bg-white border border-black/[0.03] hover:border-indigo-500/20 hover:shadow-premium transition-all duration-500 cursor-default group"
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 ${event.type === 'crit' ? 'bg-rose-500/10 text-rose-500' :
                            event.type === 'warn' ? 'bg-amber-500/10 text-amber-500' :
                                'bg-indigo-500/10 text-indigo-500'
                        }`}>
                        {event.icon}
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-black text-slate-900 tracking-tight leading-snug">{event.msg}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em] mt-1.5 opacity-60">{event.time}</div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Zap size={12} className="text-indigo-400" />
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

interface ControlModuleProps {
    title: string;
    description: string;
    icon: any;
    stats?: { label: string; value: string }[];
    colorClass?: string;
}

/**
 * ControlModuleCard: Generic Module for Features (Alabaster Edition)
 */
export const ControlModuleCard = ({ title, description, icon: Icon, stats, colorClass = "text-indigo-600" }: ControlModuleProps) => (
    <div className="group relative p-10 rounded-[40px] bg-white border border-black/[0.03] hover:border-indigo-500/20 shadow-premium hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] transition-all duration-700 overflow-hidden">
        {/* Subtle Accent Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/[0.02] blur-3xl rounded-full group-hover:bg-indigo-500/[0.05] transition-all duration-700" />

        <div className={`w-16 h-16 rounded-[22px] bg-white border border-black/[0.04] shadow-sm flex items-center justify-center mb-8 transition-all duration-700 group-hover:scale-110 group-hover:bg-indigo-50/50 ${colorClass}`}>
            <Icon size={32} strokeWidth={1.5} />
        </div>

        <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-[-0.03em]">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-10 font-medium uppercase text-[10px] tracking-[0.15em] opacity-80">{description}</p>

        {stats && (
            <div className="pt-8 border-t border-black/[0.03] flex gap-8">
                {stats.map((s, i) => (
                    <div key={i}>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">{s.label}</div>
                        <div className="text-lg font-black text-slate-900 tracking-tight tabular-nums">{s.value}</div>
                    </div>
                ))}
            </div>
        )}
    </div>
);
