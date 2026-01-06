import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function MouseTooltip() {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Precise follow for the dot
    const dotX = useSpring(mouseX, { damping: 40, stiffness: 800 });
    const dotY = useSpring(mouseY, { damping: 40, stiffness: 800 });

    // Lagging follow for the glow/ring
    const glowX = useSpring(mouseX, { damping: 25, stiffness: 150 });
    const glowY = useSpring(mouseY, { damping: 25, stiffness: 150 });

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
            if (!isVisible) setIsVisible(true);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [mouseX, mouseY, isVisible]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] hidden lg:block">
            {/* Surgical Center Dot */}
            <motion.div
                style={{
                    left: dotX,
                    top: dotY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute w-1.5 h-1.5 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.8)]"
            />

            {/* Lagging Glow Ring */}
            <motion.div
                style={{
                    left: glowX,
                    top: glowY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute w-24 h-24 border border-indigo-500/10 rounded-full bg-indigo-500/5 blur-[20px]"
            />

            {/* Interactive Outer Ring */}
            <motion.div
                style={{
                    left: glowX,
                    top: glowY,
                    translateX: '-50%',
                    translateY: '-50%',
                }}
                className="absolute w-12 h-12 border border-indigo-500/20 rounded-full scale-[1.2]"
            />
        </div>
    );
}
