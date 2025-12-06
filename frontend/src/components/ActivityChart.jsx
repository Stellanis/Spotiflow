import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export function ActivityChart({ data, color = "#1DB954" }) {
    if (!data || data.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full h-[200px]"
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        hide
                    />
                    <YAxis hide />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        itemStyle={{ color: color }}
                        formatter={(value) => [`${value} plays`, '']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke={color}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
