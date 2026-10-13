import { motion } from 'framer-motion';
import { Leaf, ShieldCheck, Truck, Banknote } from 'lucide-react';

const promises = [
    {
        icon: <Leaf className="text-landing-primary-light" size={32} />,
        title: 'Farm Fresh Sourcing',
        description: 'Directly sourced from local farmers to ensure maximum freshness.'
    },
    {
        icon: <ShieldCheck className="text-landing-primary-light" size={32} />,
        title: 'Quality Checked',
        description: 'Every product undergoes rigorous quality checks before dispatch.'
    },
    {
        icon: <Truck className="text-landing-primary-light" size={32} />,
        title: 'Fast Delivery',
        description: 'Quick delivery from Kisaankart stores near you.'
    },
    {
        icon: <Banknote className="text-landing-primary-light" size={32} />,
        title: 'Fair Pricing',
        description: 'Transparent pricing that benefits both farmers and consumers.'
    }
];

export default function PromiseSection() {
    return (
        <section id="about" className="py-20 px-[5%] bg-white">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-black text-landing-primary mb-4">Our Promise to You</h2>
                <div className="w-20 h-1.5 bg-landing-primary-light mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {promises.map((promise, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="p-8 rounded-3xl bg-landing-bg hover:shadow-xl transition-all duration-300 border border-slate-100 group"
                    >
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:bg-landing-primary-light group-hover:text-white transition-colors">
                            {promise.icon}
                        </div>
                        <h3 className="text-xl font-bold text-landing-primary mb-3">{promise.title}</h3>
                        <p className="text-slate-600 leading-relaxed">{promise.description}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
