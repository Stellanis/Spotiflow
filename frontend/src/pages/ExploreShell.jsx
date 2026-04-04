import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

export default function ExploreShell() {
    const outletContext = useOutletContext();

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Explore Taste"
                title="Discovery and analytics, in one place"
                description="Spotiflow now treats recommendations and listening intelligence as a single Explore surface so you can move from insight to action without context switching."
            />

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap gap-3">
                    <NavLink
                        to="/explore/discover"
                        className={({ isActive }) =>
                            `rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white text-black' : 'border border-white/10 bg-black/20 text-spotify-grey hover:text-white'}`
                        }
                    >
                        Discover
                    </NavLink>
                    <NavLink
                        to="/explore/stats"
                        className={({ isActive }) =>
                            `rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white text-black' : 'border border-white/10 bg-black/20 text-spotify-grey hover:text-white'}`
                        }
                    >
                        Stats
                    </NavLink>
                </div>
            </div>

            <Outlet context={outletContext} />
        </div>
    );
}
