import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow } from '@react-google-maps/api';
import { cellToBoundary } from "h3-js";
import { useAdmin } from '../contexts/AdminContext';
import { Map as MapIcon, Loader2, RefreshCw, Layers, MapPin, Navigation } from 'lucide-react';
import { cn } from "@/lib/utils";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '@/lib/mapsConfig';

const mapContainerStyle = {
    width: '100%',
    height: 'calc(100vh - 120px)',
};

const DEFAULT_CENTER = { lat: 22.7196, lng: 75.8577 }; // Indore
const COLORS = [
    '#0f172a', '#1e293b', '#334155', '#475569', 
    '#0284c7', '#0369a1', '#075985', '#0c4a6e',
    '#059669', '#047857', '#065f46', '#064e3b',
    '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'
];

export default function GlobalServiceMap() {
    const { fetchFranchiseServiceMap } = useAdmin();
    const [franchises, setFranchises] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFranchise, setSelectedFranchise] = useState(null);
    const [map, setMap] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: GOOGLE_MAPS_LOADER_ID,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    const loadData = useCallback(async () => {
        setIsLoading(true);
        const data = await fetchFranchiseServiceMap();
        setFranchises(data || []);
        setIsLoading(false);
    }, [fetchFranchiseServiceMap]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const franchiseData = useMemo(() => {
        return franchises.map((f, idx) => ({
            ...f,
            color: COLORS[idx % COLORS.length]
        }));
    }, [franchises]);

    const onMapLoad = (mapInstance) => {
        setMap(mapInstance);
    };

    if (isLoading && franchises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] bg-slate-50">
                <Loader2 className="animate-spin text-slate-900 mb-4" size={40} />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Loading map...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 text-white rounded-sm shadow-xl shadow-slate-200">
                        <Navigation size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Global Coverage Map</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">
                            {franchises.length} Where each franchise delivers
                        </p>
                    </div>
                </div>
                <button 
                    onClick={loadData}
                    className="p-2.5 rounded-sm border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all hover:border-slate-400"
                >
                    <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 relative">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={DEFAULT_CENTER}
                        zoom={12}
                        onLoad={onMapLoad}
                        options={{
                            disableDefaultUI: false,
                            zoomControl: true,
                            mapTypeControl: true,
                            streetViewControl: false,
                            styles: [
                                { featureType: "poi", stylers: [{ visibility: "off" }] },
                                { featureType: "transit", stylers: [{ visibility: "simplified" }] }
                            ]
                        }}
                    >
                        {franchiseData.map((franchise) => (
                            <React.Fragment key={franchise._id}>
                                {/* Franchise Hub Marker */}
                                {franchise.location?.coordinates && (
                                    <Marker
                                        position={{
                                            lat: franchise.location.coordinates[1],
                                            lng: franchise.location.coordinates[0]
                                        }}
                                        onClick={() => setSelectedFranchise(franchise)}
                                        icon={{
                                            url: "https://maps.google.com/mapfiles/ms/icons/red-pushpin.png",
                                            scaledSize: new window.google.maps.Size(32, 32)
                                        }}
                                    />
                                )}

                                {/* Service Hexagons */}
                                {(franchise.serviceHexagons || []).map((hexId) => {
                                    const boundary = cellToBoundary(hexId);
                                    const path = boundary.map(coord => ({ lat: coord[0], lng: coord[1] }));
                                    
                                    return (
                                        <Polygon
                                            key={`${franchise._id}-${hexId}`}
                                            paths={path}
                                            onClick={() => setSelectedFranchise(franchise)}
                                            options={{
                                                fillColor: franchise.color,
                                                fillOpacity: 0.35,
                                                strokeColor: franchise.color,
                                                strokeOpacity: 0.8,
                                                strokeWeight: 1,
                                                zIndex: 1
                                            }}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        {selectedFranchise && (
                            <InfoWindow
                                position={{
                                    lat: selectedFranchise.location?.coordinates[1] || DEFAULT_CENTER.lat,
                                    lng: selectedFranchise.location?.coordinates[0] || DEFAULT_CENTER.lng
                                }}
                                onCloseClick={() => setSelectedFranchise(null)}
                            >
                                <div className="p-2 min-w-[200px]">
                                    <h4 className="text-xs font-black uppercase text-slate-900 mb-1">{selectedFranchise.franchiseName}</h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{selectedFranchise.ownerName} · {selectedFranchise.mobile}</p>
                                    <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedFranchise.color }} />
                                        <span className="text-[10px] font-black uppercase text-slate-400">
                                            {selectedFranchise.serviceHexagons?.length || 0} Areas
                                        </span>
                                    </div>
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>
                ) : (
                    <div className="flex items-center justify-center h-full bg-slate-100">
                        <Loader2 className="animate-spin text-slate-400" size={32} />
                    </div>
                )}

                {/* Legend Overlay */}
                <div className="absolute bottom-10 left-6 z-10 bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-sm shadow-2xl max-w-[240px] max-h-[300px] overflow-y-auto">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Franchise Legend</h4>
                    <div className="space-y-2">
                        {franchiseData.map(f => (
                            <div 
                                key={f._id} 
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors"
                                onClick={() => {
                                    if (map && f.location?.coordinates) {
                                        map.panTo({ lat: f.location.coordinates[1], lng: f.location.coordinates[0] });
                                        map.setZoom(14);
                                        setSelectedFranchise(f);
                                    }
                                }}
                            >
                                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: f.color }} />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-black text-slate-700 uppercase truncate leading-none mb-0.5">{f.franchiseName}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{f.city} · {f.serviceHexagons?.length || 0} Cells</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
