import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Clean, professional marker icons
const hotLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" fill="none">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#1f2937"/>
      <circle cx="16" cy="16" r="8" fill="#ef4444"/>
      <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [28, 35],
  iconAnchor: [14, 35],
  popupAnchor: [0, -35],
  shadowUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16" fill="none">
      <ellipse cx="16" cy="8" rx="14" ry="6" fill="rgba(0,0,0,0.2)"/>
    </svg>
  `),
  shadowSize: [28, 12],
  shadowAnchor: [14, 12]
});

const warmLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" fill="none">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#1f2937"/>
      <circle cx="16" cy="16" r="8" fill="#f59e0b"/>
      <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [28, 35],
  iconAnchor: [14, 35],
  popupAnchor: [0, -35],
  shadowUrl: 'data:image/svg+xml;base64=' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16" fill="none">
      <ellipse cx="16" cy="8" rx="14" ry="6" fill="rgba(0,0,0,0.2)"/>
    </svg>
  `),
  shadowSize: [28, 12],
  shadowAnchor: [14, 12]
});

const coldLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" fill="none">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#1f2937"/>
      <circle cx="16" cy="16" r="8" fill="#6b7280"/>
      <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [28, 35],
  iconAnchor: [14, 35],
  popupAnchor: [0, -35],
  shadowUrl: 'data:image/svg+xml;base64=' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16" fill="none">
      <ellipse cx="16" cy="8" rx="14" ry="6" fill="rgba(0,0,0,0.2)"/>
    </svg>
  `),
  shadowSize: [28, 12],
  shadowAnchor: [14, 12]
});

// Map component to handle search location
function MapController({ searchLocation }) {
  const map = useMap();
  
  useEffect(() => {
    if (searchLocation) {
      map.setView([searchLocation.lat, searchLocation.lon], 13);
    }
  }, [searchLocation, map]);
  
  return null;
}

function App() {
  const [theme, setTheme] = useState('light');
  const [businesses, setBusinesses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLocation, setSearchLocation] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [customSearch, setCustomSearch] = useState('');
  const [showCustomSearch, setShowCustomSearch] = useState(false);
  
  // Search form state
  const [searchForm, setSearchForm] = useState({
    business_type: 'saas',
    location: 'San Francisco, CA',
    radius: 10
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    min_quality_score: 70,
    lead_status: '',
    has_contact: true
  });

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    document.documentElement.className = theme;
    fetchBusinessTypes();
    fetchFavorites();
  }, [theme]);

  const fetchBusinessTypes = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/business-types`);
      const data = await response.json();
      setBusinessTypes(data.business_types);
    } catch (error) {
      console.error('Error fetching business types:', error);
    }
  };

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/favorites`);
      const data = await response.json();
      setFavorites(data.favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const searchData = showCustomSearch && customSearch.trim() 
        ? { ...searchForm, business_type: customSearch.trim().toLowerCase() }
        : searchForm;

      const response = await fetch(`${backendUrl}/api/search-businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData),
      });
      
      const data = await response.json();
      setBusinesses(data.businesses);
      setSearchLocation(data.search_location);
      
      if (data.businesses.length === 0) {
        alert('No qualified leads found in this area. Try expanding your search radius or different business type.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (business) => {
    try {
      const response = await fetch(`${backendUrl}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: business.id,
          user_id: 'default_user'
        }),
      });
      
      if (response.ok) {
        fetchFavorites();
        alert('Added to favorites!');
      }
    } catch (error) {
      console.error('Error adding to favorites:', error);
    }
  };

  const removeFromFavorites = async (favoriteId) => {
    try {
      const response = await fetch(`${backendUrl}/api/favorites/${favoriteId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchFavorites();
        alert('Removed from favorites!');
      }
    } catch (error) {
      console.error('Error removing from favorites:', error);
    }
  };

  const exportToCSV = async () => {
    try {
      const searchType = showCustomSearch && customSearch.trim() 
        ? customSearch.trim().toLowerCase() 
        : searchForm.business_type;

      const response = await fetch(
        `${backendUrl}/api/export-csv?business_type=${searchType}&min_quality_score=${filters.min_quality_score}`
      );
      const data = await response.json();
      
      // Create CSV content
      const csvContent = [
        data.headers.join(','),
        ...data.rows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };

  const getLeadIcon = (leadStatus) => {
    switch (leadStatus) {
      case 'hot': return hotLeadIcon;
      case 'warm': return warmLeadIcon;
      case 'cold': return coldLeadIcon;
      default: return coldLeadIcon;
    }
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-amber-600';
    if (score >= 40) return 'text-gray-600';
    return 'text-gray-400';
  };

  const filteredBusinesses = businesses.filter(business => {
    if (business.quality_score < filters.min_quality_score) return false;
    if (filters.lead_status && business.lead_status !== filters.lead_status) return false;
    if (filters.has_contact && !business.phone && !business.email) return false;
    return true;
  });

  return (
    <div className={`min-h-screen transition-all duration-300 ${theme === 'dark' ? 'dark bg-black' : 'bg-white'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-black dark:text-white">Prospect</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Lead Intelligence</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex space-x-1">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'search' 
                      ? 'bg-black dark:bg-white text-white dark:text-black' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'favorites' 
                      ? 'bg-black dark:bg-white text-white dark:text-black' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  Saved ({favorites.length})
                </button>
              </nav>
              
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <div className="w-96 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          <div className="p-6">
            {activeTab === 'search' ? (
              <>
                {/* Search Form */}
                <form onSubmit={handleSearch} className="space-y-6 mb-8">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-black dark:text-white">
                        Target Industry
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCustomSearch(!showCustomSearch)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                      >
                        {showCustomSearch ? 'Use Presets' : 'Custom Search'}
                      </button>
                    </div>
                    
                    {showCustomSearch ? (
                      <input
                        type="text"
                        value={customSearch}
                        onChange={(e) => setCustomSearch(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-black text-black dark:text-white placeholder-gray-400"
                        placeholder="e.g., 'AI startups', 'dental clinics', 'marketing agencies'"
                      />
                    ) : (
                      <select
                        value={searchForm.business_type}
                        onChange={(e) => setSearchForm({...searchForm, business_type: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-black text-black dark:text-white"
                      >
                        {businessTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-black dark:text-white mb-3">
                      Location
                    </label>
                    <input
                      type="text"
                      value={searchForm.location}
                      onChange={(e) => setSearchForm({...searchForm, location: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-black text-black dark:text-white placeholder-gray-400"
                      placeholder="Enter city, state, or zip code"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-black dark:text-white mb-3">
                      Search Radius
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={searchForm.radius}
                      onChange={(e) => setSearchForm({...searchForm, radius: parseInt(e.target.value)})}
                      className="w-full accent-black dark:accent-white"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>1 km</span>
                      <span className="font-medium text-black dark:text-white">{searchForm.radius} km</span>
                      <span>50 km</span>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>Finding Leads...</span>
                      </div>
                    ) : (
                      'Find Qualified Leads'
                    )}
                  </button>
                </form>

                {/* Filters */}
                <div className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-6">
                  <h3 className="font-semibold text-black dark:text-white">Lead Filters</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Quality Score: {filters.min_quality_score}+
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.min_quality_score}
                      onChange={(e) => setFilters({...filters, min_quality_score: parseInt(e.target.value)})}
                      className="w-full accent-black dark:accent-white"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Lead Priority
                    </label>
                    <select
                      value={filters.lead_status}
                      onChange={(e) => setFilters({...filters, lead_status: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-black text-black dark:text-white"
                    >
                      <option value="">All Priorities</option>
                      <option value="hot">🔥 Hot Leads</option>
                      <option value="warm">⚡ Warm Leads</option>
                      <option value="cold">❄️ Cold Leads</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="has_contact"
                      checked={filters.has_contact}
                      onChange={(e) => setFilters({...filters, has_contact: e.target.checked})}
                      className="mr-3 w-4 h-4 accent-black dark:accent-white rounded"
                    />
                    <label htmlFor="has_contact" className="text-sm text-gray-700 dark:text-gray-300">
                      Must have contact information
                    </label>
                  </div>
                </div>

                {/* Results Summary */}
                {businesses.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-black dark:text-white">
                        Results ({filteredBusinesses.length})
                      </h3>
                      <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Favorites Tab */
              <div>
                <h2 className="text-xl font-bold text-black dark:text-white mb-6">
                  Saved Leads ({favorites.length})
                </h2>
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">No saved leads yet</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Save prospects to build your lead list</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {favorites.map(business => (
                      <div key={business.favorite_id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-black dark:text-white mb-1">{business.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize mb-2">{business.business_type}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mb-2">{business.address}</p>
                            <div className="flex items-center space-x-4 text-sm">
                              {business.phone && (
                                <a href={`tel:${business.phone}`} className="text-black dark:text-white hover:underline">
                                  📞 {business.phone}
                                </a>
                              )}
                              {business.website && (
                                <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-black dark:text-white hover:underline">
                                  🌐 Website
                                </a>
                              )}
                              {business.email && (
                                <a href={`mailto:${business.email}`} className="text-black dark:text-white hover:underline">
                                  ✉️ Email
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromFavorites(business.favorite_id)}
                            className="text-gray-400 hover:text-red-500 transition-colors ml-4"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <MapContainer
            center={[37.7749, -122.4194]} // Default to San Francisco
            zoom={10}
            className="h-full w-full"
          >
            <TileLayer
              url={theme === 'dark' 
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              }
              attribution={theme === 'dark' 
                ? '&copy; <a href="https://carto.com/">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              }
            />
            
            {searchLocation && <MapController searchLocation={searchLocation} />}
            
            {filteredBusinesses.map(business => (
              <Marker
                key={business.id}
                position={[business.lat, business.lon]}
                icon={getLeadIcon(business.lead_status)}
              >
                <Popup className="custom-popup">
                  <div className="p-4 min-w-80">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-black text-lg">{business.name}</h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        business.lead_status === 'hot' ? 'bg-red-100 text-red-800' :
                        business.lead_status === 'warm' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {business.lead_status === 'hot' ? '🔥 HOT' :
                         business.lead_status === 'warm' ? '⚡ WARM' : '❄️ COLD'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-700 mb-4">
                      <p><span className="font-medium">Industry:</span> <span className="capitalize">{business.business_type}</span></p>
                      <p><span className="font-medium">Address:</span> {business.address}</p>
                      {business.phone && (
                        <p><span className="font-medium">Phone:</span> 
                          <a href={`tel:${business.phone}`} className="text-black font-medium ml-1 hover:underline">
                            {business.phone}
                          </a>
                        </p>
                      )}
                      {business.website && (
                        <p><span className="font-medium">Website:</span> 
                          <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-black font-medium ml-1 hover:underline">
                            Visit Site
                          </a>
                        </p>
                      )}
                      {business.email && (
                        <p><span className="font-medium">Email:</span> 
                          <a href={`mailto:${business.email}`} className="text-black font-medium ml-1 hover:underline">
                            {business.email}
                          </a>
                        </p>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className={`text-sm font-semibold ${getQualityColor(business.quality_score)}`}>
                        Quality Score: {business.quality_score}/100
                      </span>
                      <button
                        onClick={() => addToFavorites(business)}
                        className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all"
                      >
                        Save Lead
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          {/* Floating Results Stats */}
          {businesses.length > 0 && (
            <div className="absolute top-6 right-6 bg-white dark:bg-black rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-5 max-w-sm">
              <h4 className="font-semibold text-black dark:text-white mb-3">Lead Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Found:</span>
                  <span className="font-medium text-black dark:text-white">{businesses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Qualified:</span>
                  <span className="font-medium text-black dark:text-white">{filteredBusinesses.length}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800 pt-2 mt-3">
                  <div className="flex justify-between">  
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      Hot Leads:
                    </span>
                    <span className="font-medium text-red-600">{filteredBusinesses.filter(b => b.lead_status === 'hot').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                      Warm Leads:
                    </span>
                    <span className="font-medium text-amber-600">{filteredBusinesses.filter(b => b.lead_status === 'warm').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                      Cold Leads:
                    </span>
                    <span className="font-medium text-gray-600">{filteredBusinesses.filter(b => b.lead_status === 'cold').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;