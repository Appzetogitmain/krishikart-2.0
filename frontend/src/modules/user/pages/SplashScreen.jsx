import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, Leaf } from 'lucide-react'

export default function SplashScreen() {
    const navigate = useNavigate()

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate(localStorage.getItem('userToken') ? '/home' : '/login', { replace: true })
        }, 3000)
        return () => clearTimeout(timer)
    }, [navigate])

    return (
        <div className="user-app-theme h-screen w-full bg-primary flex flex-col items-center justify-center overflow-hidden">
            {/* Animated Background Elements */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 90, 0],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 10, repeat: Infinity }}
                className="absolute top-[-10%] right-[-10%] text-white"
            >
                <Sprout size={300} />
            </motion.div>

            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, -45, 0],
                    opacity: [0.05, 0.1, 0.05]
                }}
                transition={{ duration: 8, repeat: Infinity, delay: 1 }}
                className="absolute bottom-[-5%] left-[-5%] text-white"
            >
                <Leaf size={250} />
            </motion.div>

            {/* Center Content */}
            <div className="relative z-10 flex flex-col items-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: 0.2
                    }}
                    className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-black/20"
                >
                    <Sprout size={48} className="text-primary" strokeWidth={2.5} />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8 text-center"
                >
                    <h1 className="text-4xl font-black text-white tracking-tighter">
                        Krishi<span className="text-emerald-200">Kart</span>
                    </h1>
                    <p className="mt-2 text-emerald-100 font-black uppercase tracking-[0.3em] text-[10px]">
                        Farm Fresh Delivery
                    </p>
                </motion.div>
            </div>

            {/* Loading bar */}
            <div className="absolute bottom-20 w-40 h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '0%' }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                    className="h-full w-full bg-white"
                />
            </div>
        </div>
    )
}
