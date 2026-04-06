export function TopSongsForm({ timeRange, setTimeRange }) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-spotify-grey">Time Period</label>
            <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                className="w-full rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none"
            >
                <option value="7day">Last 7 Days (Week)</option>
                <option value="1month">Last Month</option>
                <option value="12month">Last Year</option>
                <option value="overall">All Time</option>
            </select>
        </div>
    );
}
