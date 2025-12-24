import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket, ExternalLink, Heart } from 'lucide-react';

export function ConcertList({ concerts, reminders, onToggleReminder }) {
    const formatDate = (dateString) => {
        if (!dateString) return 'TBA';
        return new Date(dateString).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (concerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-spotify-grey" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Concerts Found</h3>
                <p className="text-spotify-grey">Try adjusting your filters.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {concerts.map((concert) => (
                <motion.div
                    key={concert.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-spotify-light-grey rounded-xl overflow-hidden hover:bg-white/10 transition-colors border border-white/5 hover:border-white/20 flex flex-col"
                >
                    <div className="relative aspect-video bg-black/40">
                        {concert.image_url ? (
                            <img src={concert.image_url} alt={concert.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify-dark to-spotify-light-grey">
                                <Ticket className="w-12 h-12 text-white/20" />
                            </div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-medium border border-white/10">
                            {concert.source}
                        </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col space-y-3">
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight line-clamp-1 group-hover:text-spotify-green transition-colors flex items-center justify-between gap-2">
                                <span className="truncate">{concert.artist}</span>
                                <button
                                    onClick={(e) => onToggleReminder(concert.id, e)}
                                    className="focus:outline-none hover:scale-110 transition-transform shrink-0"
                                >
                                    <Heart className={`w-5 h-5 ${reminders.has(concert.id) ? 'fill-spotify-green text-spotify-green' : 'text-spotify-grey hover:text-white'}`} />
                                </button>
                            </h3>
                            <p className="text-spotify-grey text-sm line-clamp-1">{concert.title}</p>
                        </div>

                        <div className="space-y-2 text-sm text-spotify-grey flex-1">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 shrink-0" />
                                <span>{formatDate(concert.date)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span className="line-clamp-1">{concert.venue}, {concert.city}</span>
                            </div>
                        </div>

                        <a href={concert.url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 bg-white text-black font-bold py-2 px-4 rounded-full hover:scale-105 transition-transform w-full text-sm">
                            <span>Get Tickets</span>
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
