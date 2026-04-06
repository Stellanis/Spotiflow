import { Plus, Trash2 } from 'lucide-react';

export function SmartPlaylistForm({
    matchType,
    setMatchType,
    rules,
    handleAddRule,
    handleRemoveRule,
    handleRuleChange,
}) {
    return (
        <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white">Rules</label>
                <select
                    value={matchType}
                    onChange={(event) => setMatchType(event.target.value)}
                    className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white focus:outline-none"
                >
                    <option value="all">Match ALL rules (AND)</option>
                    <option value="any">Match ANY rule (OR)</option>
                </select>
            </div>

            <div className="custom-scrollbar max-h-[200px] space-y-2 overflow-y-auto pr-2">
                {rules.map((rule, index) => (
                    <div key={index} className="flex gap-2">
                        <select
                            value={rule.field}
                            onChange={(event) => handleRuleChange(index, 'field', event.target.value)}
                            className="w-1/3 rounded border border-white/10 bg-black/20 px-2 py-2 text-sm text-white focus:outline-none"
                        >
                            <option value="artist">Artist</option>
                            <option value="title">Title</option>
                            <option value="album">Album</option>
                        </select>

                        <select
                            value={rule.operator}
                            onChange={(event) => handleRuleChange(index, 'operator', event.target.value)}
                            className="w-1/4 rounded border border-white/10 bg-black/20 px-2 py-2 text-sm text-white focus:outline-none"
                        >
                            <option value="contains">contains</option>
                            <option value="is">is exactly</option>
                            <option value="is_not">is not</option>
                        </select>

                        <input
                            type="text"
                            value={rule.value}
                            onChange={(event) => handleRuleChange(index, 'value', event.target.value)}
                            className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                            placeholder="Value..."
                        />

                        {rules.length > 1 && (
                            <button type="button" onClick={() => handleRemoveRule(index)} className="p-2 text-spotify-grey transition-colors hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button type="button" onClick={handleAddRule} className="flex items-center gap-1 text-xs text-spotify-green hover:underline">
                <Plus className="h-3 w-3" />
                Add Condition
            </button>
        </div>
    );
}
