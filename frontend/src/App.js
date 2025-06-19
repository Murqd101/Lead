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

// Custom marker icons
const hotLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#dc2626" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const warmLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const coldLeadIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64=' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="32" height="32">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
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
  const [theme, setTheme] = useState('dark');
  const [businesses, setBusinesses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLocation, setSearchLocation] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  
  // Search form state
  const [searchForm, setSearchForm] = useState({
    business_type: 'restaurant',
    location: 'New York, NY',
    radius: 5
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    min_quality_score: 60,
    lead_status: '',
    has_contact: false
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
      const response = await fetch(`${backendUrl}/api/search-businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchForm),
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
      const response = await fetch(
        `${backendUrl}/api/export-csv?business_type=${searchForm.business_type}&min_quality_score=${filters.min_quality_score}`
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
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-blue-500';
    return 'text-gray-500';
  };

  const filteredBusinesses = businesses.filter(business => {
    if (business.quality_score < filters.min_quality_score) return false;
    if (filters.lead_status && business.lead_status !== filters.lead_status) return false;
    if (filters.has_contact && !business.phone && !business.email) return false;
    return true;
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LG</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">LeadGen Pro</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex space-x-6">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'search' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'favorites' 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Favorites ({favorites.length})
                </button>
              </nav>
              
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {theme === 'dark' ? '🌞' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6">
            {activeTab === 'search' ? (
              <>
                {/* Search Form */}
                <form onSubmit={handleSearch} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Business Type
                    </label>
                    <select
                      value={searchForm.business_type}
                      onChange={(e) => setSearchForm({...searchForm, business_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {businessTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={searchForm.location}
                      onChange={(e) => setSearchForm({...searchForm, location: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter city, address, or zip code"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Radius (km)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={searchForm.radius}
                      onChange={(e) => setSearchForm({...searchForm, radius: parseInt(e.target.value)})}
                      className="w-full"
                    />
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      {searchForm.radius} km
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Searching...' : 'Find Leads 🎯'}
                  </button>
                </form>

                {/* Filters */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Filters</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min Quality Score: {filters.min_quality_score}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.min_quality_score}
                      onChange={(e) => setFilters({...filters, min_quality_score: parseInt(e.target.value)})}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lead Status
                    </label>
                    <select
                      value={filters.lead_status}
                      onChange={(e) => setFilters({...filters, lead_status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="hot">Hot Leads</option>
                      <option value="warm">Warm Leads</option>
                      <option value="cold">Cold Leads</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="has_contact"
                      checked={filters.has_contact}
                      onChange={(e) => setFilters({...filters, has_contact: e.target.checked})}
                      className="mr-2 rounded"
                    />
                    <label htmlFor="has_contact" className="text-sm text-gray-700 dark:text-gray-300">
                      Has Contact Info
                    </label>
                  </div>
                </div>

                {/* Results Summary */}
                {businesses.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Results ({filteredBusinesses.length})
                      </h3>
                      <button
                        onClick={exportToCSV}
                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Favorite Leads ({favorites.length})
                </h2>
                {favorites.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">No favorites yet. Add some leads to get started!</p>
                ) : (
                  <div className="space-y-3">
                    {favorites.map(business => (
                      <div key={business.favorite_id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{business.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{business.business_type}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{business.address}</p>
                            {business.phone && (
                              <p className="text-sm text-blue-600 dark:text-blue-400">{business.phone}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromFavorites(business.favorite_id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
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
            center={[40.7128, -74.0060]} // Default to NYC
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
                  <div className="p-2 min-w-64">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900">{business.name}</h3>
                      <span className={`text-sm font-medium px-2 py-1 rounded ${
                        business.lead_status === 'hot' ? 'bg-red-100 text-red-800' :
                        business.lead_status === 'warm' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {business.lead_status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <p><strong>Type:</strong> {business.business_type}</p>
                      <p><strong>Address:</strong> {business.address}</p>
                      {business.phone && <p><strong>Phone:</strong> <a href={`tel:${business.phone}`} className="text-blue-600">{business.phone}</a></p>}
                      {business.website && <p><strong>Website:</strong> <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-blue-600">Visit</a></p>}
                      {business.email && <p><strong>Email:</strong> <a href={`mailto:${business.email}`} className="text-blue-600">{business.email}</a></p>}
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className={`text-sm font-medium ${getQualityColor(business.quality_score)}`}>
                        Quality: {business.quality_score}/100
                      </span>
                      <button
                        onClick={() => addToFavorites(business)}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                      >
                        Add to Favorites
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          {/* Floating Search Stats */}
          {businesses.length > 0 && (
            <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Search Results</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Total Found:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{businesses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">After Filters:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{filteredBusinesses.length}</span>
                </div>
                <div className="flex justify-between">  
                  <span className="text-red-600">Hot Leads:</span>
                  <span className="font-medium text-red-600">{filteredBusinesses.filter(b => b.lead_status === 'hot').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-600">Warm Leads:</span>
                  <span className="font-medium text-yellow-600">{filteredBusinesses.filter(b => b.lead_status === 'warm').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">Cold Leads:</span>
                  <span className="font-medium text-blue-600">{filteredBusinesses.filter(b => b.lead_status === 'cold').length}</span>
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