import React from 'react';
import { Radio } from 'lucide-react';
import { InsightCard } from './InsightCard';

export function MainstreamScore({ data }) {
    if (!data) return null;

    return (
        <InsightCard
            title="Mainstream Score"
            icon={Radio}
            score={data.score}
            label={data.label}
            description="Based on the global popularity of your top artists. High scores indicate a taste aligned with global charts."
            color="purple"
        />
    );
}
