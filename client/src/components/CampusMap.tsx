import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Issue, CampusLocation } from '../types';
import { Filter } from 'lucide-react';

interface CampusMapProps {
  issues: Issue[];
  locations: CampusLocation[];
  onSelectIssue: (issue: Issue) => void;
}

export const CampusMap: React.FC<CampusMapProps> = ({
  issues,
  locations,
  onSelectIssue,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [activeLocationFilter, setActiveLocationFilter] = useState<string | null>(null);

  // Filter issues according to selected filters
  const filteredIssues = issues.filter((issue) => {
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && issue.status !== selectedStatus) return false;
    if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;
    if (activeLocationFilter && issue.location_name !== activeLocationFilter) return false;
    return true;
  });

  // Unique categories in issues
  const categories = Array.from(new Set(issues.map((i) => i.category)));

  // Initialize Map Once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centered at university campus
    const campusCenter: [number, number] = [12.9722, 77.5945];

    const map = L.map(mapContainerRef.current, {
      center: campusCenter,
      zoom: 16,
      zoomControl: true,
      maxZoom: 19,
      minZoom: 14,
    });

    // CartoDB Positron clean map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | CampusFix Map Services',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers when issues or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    filteredIssues.forEach((issue) => {
      // Default to campus block coordinates if latitude/longitude are missing
      const lat = issue.latitude || 12.9722 + (Math.random() - 0.5) * 0.003;
      const lng = issue.longitude || 77.5945 + (Math.random() - 0.5) * 0.003;

      // Color coding specified in Phase 4:
      // Critical -> red, High -> orange, Medium -> yellow, Low -> green
      const markerColor = 
        issue.priority === 'critical' ? '#ef4444' :
        issue.priority === 'high' ? '#f97316' :
        issue.priority === 'medium' ? '#eab308' : '#10b981';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            position: relative;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background-color: ${markerColor};
            color: #ffffff;
            box-shadow: 0 4px 12px ${markerColor}66, 0 0 0 3px #ffffff;
            cursor: pointer;
            transition: transform 0.2s ease;
            ${issue.priority === 'critical' ? 'animation: pulse-critical 2s infinite;' : ''}
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Create rich popup DOM element matching Phase 4:
      // Issue ID, Title, Category, Priority, Status, Location, "View Issue" button
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '230px';
      popupDiv.style.padding = '4px';
      popupDiv.innerHTML = `
        <div style="margin-bottom: 8px; border-radius: 8px; overflow: hidden; height: 110px; background: #0f172a;">
          <img src="${issue.image_url}" alt="${issue.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/uploads/damaged-staircase.svg'" />
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 0.75rem; font-weight: 800; color: #1e40af;">#${issue.issue_code}</span>
          <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: #f1f5f9; padding: 2px 6px; borderRadius: 4px;">${issue.status.replace('_', ' ')}</span>
        </div>
        <h4 style="font-size: 0.9rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; line-height: 1.25;">
          ${issue.title}
        </h4>
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: #475569; margin-bottom: 10px;">
          <div>📁 <strong>Category:</strong> ${issue.category}</div>
          <div>⚠️ <strong>Priority:</strong> <span style="font-weight: 700; color: ${markerColor}; text-transform: uppercase;">${issue.priority}</span></div>
          <div>📍 <strong>Location:</strong> ${issue.location_name}</div>
        </div>
        <button id="inspect-issue-${issue.id}" style="
          width: 100%;
          padding: 8px 12px;
          border-radius: 6px;
          background: #1e3a8a;
          color: white;
          border: none;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        ">
          View Issue
        </button>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`inspect-issue-${issue.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectIssue(issue);
          };
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [filteredIssues, onSelectIssue]);

  const handleZoomToLocation = (loc: CampusLocation) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 17.5, {
      duration: 1.2,
    });
    setActiveLocationFilter(activeLocationFilter === loc.name ? null : loc.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Filter and Controls Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Filter size={16} />
            <span>Map Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Categories ({issues.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="reopened">Reopened</option>
          </select>

          {/* Priority Filter */}
          <select
            className="form-select"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {activeLocationFilter && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveLocationFilter(null)}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              Reset Location Filter ({activeLocationFilter})
            </button>
          )}
        </div>

        {/* Legend matching Phase 4 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            <span>Critical</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f97316' }}></span>
            <span>High</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
            <span>Medium</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span>Low</span>
          </div>
        </div>
      </div>

      {/* Campus Landmarks Quick Nav Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          📍 Focus Campus Zone:
        </span>
        {locations.map((loc) => {
          const isActive = activeLocationFilter === loc.name;
          return (
            <button
              key={loc.id}
              onClick={() => handleZoomToLocation(loc)}
              className="btn btn-secondary btn-sm"
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderColor: isActive ? 'var(--primary-light)' : 'var(--border-light)',
                backgroundColor: isActive ? 'var(--primary-subtle)' : '#ffffff',
                color: isActive ? 'var(--primary)' : 'var(--text-primary)',
              }}
            >
              {loc.name.split(' - ')[0]}
            </button>
          );
        })}
      </div>

      {/* Map View Container */}
      <div className="map-container-wrap">
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Counter Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 800,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            boxShadow: 'var(--shadow-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
          }}
        >
          Showing {filteredIssues.length} active geocoded incident pins
        </div>
      </div>
    </div>
  );
};
