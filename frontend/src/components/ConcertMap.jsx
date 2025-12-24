import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Heart } from 'lucide-react';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function MapUpdater({ concerts }) {
    const map = useMap();
    useEffect(() => {
        if (concerts.length > 0) {
            const bounds = L.latLngBounds(concerts.map(c => [c.lat, c.lng]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        }
    }, [concerts, map]);
    return null;
}

export function ConcertMap({ concerts, reminders, onToggleReminder }) {
    const formatDate = (dateString) => {
        if (!dateString) return 'TBA';
        return new Date(dateString).toLocaleDateString(undefined, {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-white/10 relative">
            {concerts.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-spotify-dark/90 z-10">
                    <p className="text-white">No dates with coordinates found in filter.</p>
                </div>
            ) : (
                <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <MapUpdater concerts={concerts} />

                    {concerts.map(concert => (
                        <Marker
                            key={concert.id}
                            position={[concert.lat, concert.lng]}
                        >
                            <Popup className="text-black">
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                    <h3 className="font-bold text-sm">{concert.artist}</h3>
                                    <p className="text-xs">{concert.title}</p>
                                    <p className="text-xs text-gray-500">{formatDate(concert.date)}</p>
                                    <p className="text-xs">{concert.venue}, {concert.city}</p>
                                    <a href={concert.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Get Tickets</a>
                                    <button
                                        onClick={(e) => onToggleReminder(concert.id, e)}
                                        className={`text-xs flex items-center gap-1 ${reminders.has(concert.id) ? 'text-green-600' : 'text-gray-400'}`}
                                    >
                                        <Heart className={`w-3 h-3 ${reminders.has(concert.id) ? 'fill-current' : ''}`} />
                                        {reminders.has(concert.id) ? 'Reminder Set' : 'Remind Me'}
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            )}
        </div>
    );
}
