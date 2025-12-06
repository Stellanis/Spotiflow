import React from 'react';
import { Globe } from 'lucide-react';
import { InsightCard } from './InsightCard';

export function DiversityScore({ data }) {
    if (!data) return null;

    return (
        <InsightCard
            title="Artist Diversity"
            icon={Globe}
            score={data.score}
            label={data.label}
            description="Measures how varied your listening is. Higher scores mean you listen to a wider range of artists equally."
            color="blue"
        />
    );
}
