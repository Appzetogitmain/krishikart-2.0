import { motion } from 'framer-motion'

// A short fade only: sliding a whole page of product photos is what made navigation feel heavy
export default function PageTransition({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    )
}
