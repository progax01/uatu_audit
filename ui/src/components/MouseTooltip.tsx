import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function MouseTooltip() {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 200 };
    const sx = useSpring(mouseX, springConfig);
    const sy = useSpring(mouseY, springConfig);

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
        <motion.div
            style={{
                left: sx,
                top: sy,
                position: 'fixed',
                pointerEvents: 'none',
                zIndex: 9999,
                translateX: '-50%',
                translateY: '-50%',
            }}
            className="hidden lg:block w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full"
        />
    );
}
