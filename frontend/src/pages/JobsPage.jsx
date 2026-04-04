
import Jobs from '../Jobs';
import { PageHeader } from '../components/ui/PageHeader';

export default function JobsPage() {
    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Queue"
                title="Background activity"
                description="Operational details, active downloads, and failed jobs live here as a secondary utility surface."
            />
            <Jobs />
        </div>
    );
}
