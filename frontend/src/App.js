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

// Consistent single-color map markers
const lightModeIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#374151">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20]
});

const darkModeIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64=' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#f4f4f5">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  `),
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -20]
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

// Mock data for demo
const mockCampaigns = [
  {
    id: '1',
    name: 'SaaS Outreach Q1',
    type: 'email',
    status: 'active',
    sent: 247,
    opened: 89,
    replied: 23,
    created_at: '2024-01-15',
    template: 'Hi {{business_name}}, I noticed your innovative approach to {{industry}}...'
  },
  {
    id: '2', 
    name: 'Restaurant Instagram DMs',
    type: 'instagram',
    status: 'completed',
    sent: 156,
    opened: 142,
    replied: 31,
    created_at: '2024-01-10',
    template: 'Hi {{business_name}}! Love your food photos...'
  },
  {
    id: '3',
    name: 'Dental Practice Calls',
    type: 'voice',
    status: 'paused',
    sent: 89,
    opened: 89,
    replied: 12,
    created_at: '2024-01-08',
    template: 'AI Voice Call Script for dental practices...'
  }
];

const mockTemplates = [
  {
    id: '1',
    name: 'SaaS Cold Email',
    type: 'email',
    subject: 'Quick question about {{business_name}}',
    content: 'Hi {{contact_name}},\n\nI came across {{business_name}} and was impressed by your work in {{industry}}...',
    variables: ['business_name', 'contact_name', 'industry']
  },
  {
    id: '2',
    name: 'Instagram DM Template',
    type: 'instagram', 
    subject: '',
    content: 'Hey {{business_name}}! 👋 Love what you\'re doing with {{industry}}. Would love to connect!',
    variables: ['business_name', 'industry']
  },
  {
    id: '3',
    name: 'AI Voice Script',
    type: 'voice',
    subject: '',
    content: 'Hello, this is Sarah from LeadFinder. I\'m calling {{business_name}} regarding an opportunity in {{industry}}...',
    variables: ['business_name', 'industry']
  }
];

function App() {
  const [theme, setTheme] = useState('light');
  const [businesses, setBusinesses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [searchLocation, setSearchLocation] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [customSearch, setCustomSearch] = useState('');
  const [showCustomSearch, setShowCustomSearch] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // Outreach state
  const [campaigns, setCampaigns] = useState(mockCampaigns);
  const [templates, setTemplates] = useState(mockTemplates);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  
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
    
    // Simulate map loading
    setTimeout(() => setMapLoading(false), 1500);
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
    setSearchPerformed(true);
    
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

  // Mock outreach functions for demo
  const startCampaign = async (campaignData) => {
    setOutreachLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newCampaign = {
        ...campaignData,
        id: Date.now().toString(),
        status: 'active',
        sent: 0,
        opened: 0,
        replied: 0,
        created_at: new Date().toISOString().split('T')[0]
      };
      setCampaigns([newCampaign, ...campaigns]);
      setOutreachLoading(false);
      alert(`🚀 Campaign "${campaignData.name}" started! (Demo Mode)`);
    }, 2000);
  };

  const getLeadIcon = (leadStatus) => {
    return theme === 'dark' ? darkModeIcon : lightModeIcon;
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-amber-500';
    if (score >= 40) return 'text-gray-500';
    return 'text-gray-400';
  };

  const filteredBusinesses = businesses.filter(business => {
    if (business.quality_score < filters.min_quality_score) return false;
    if (filters.lead_status && business.lead_status !== filters.lead_status) return false;
    if (filters.has_contact && !business.phone && !business.email) return false;
    return true;
  });

  const renderOutreachTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-xl font-semibold transition-all duration-300 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Outreach Automation
        </h2>
        <div className={`text-xs px-3 py-1 rounded-full ${
          theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-600'
        }`}>
          DEMO MODE
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border transition-all duration-300 ${
          theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
        }`}>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {campaigns.reduce((sum, c) => sum + c.sent, 0)}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
            Total Outreach
          </div>
        </div>
        <div className={`p-4 rounded-lg border transition-all duration-300 ${
          theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
        }`}>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {campaigns.reduce((sum, c) => sum + c.replied, 0)}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
            Responses
          </div>
        </div>
        <div className={`p-4 rounded-lg border transition-all duration-300 ${
          theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
        }`}>
          <div className={`text-2xl font-bold text-green-500`}>
            {Math.round((campaigns.reduce((sum, c) => sum + c.replied, 0) / campaigns.reduce((sum, c) => sum + c.sent, 1)) * 100)}%
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
            Response Rate
          </div>
        </div>
      </div>

      {/* Campaign List */}
      <div className={`rounded-lg border transition-all duration-300 ${
        theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
      }`}>
        <div className="p-4 border-b border-zinc-600 dark:border-zinc-600">
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Active Campaigns
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {campaigns.map(campaign => (
            <div key={campaign.id} className={`p-4 rounded-lg border transition-all duration-300 hover-card ${
              theme === 'dark' ? 'bg-zinc-600 border-zinc-500' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {campaign.name}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      campaign.type === 'email' ? 'bg-blue-100 text-blue-800' :
                      campaign.type === 'instagram' ? 'bg-pink-100 text-pink-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {campaign.type === 'email' ? '📧 Email' : 
                       campaign.type === 'instagram' ? '📱 Instagram' : '📞 Voice'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                      campaign.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Sent:</span>
                      <span className={`ml-1 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {campaign.sent}
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Opened:</span>
                      <span className={`ml-1 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {campaign.opened}
                      </span>
                    </div>
                    <div>
                      <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Replied:</span>
                      <span className={`ml-1 font-medium text-green-600`}>
                        {campaign.replied}
                      </span>
                    </div>
                  </div>
                </div>
                <button className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'bg-white text-zinc-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}>
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch */}
      <div className={`rounded-lg border transition-all duration-300 ${
        theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
      }`}>
        <div className="p-4 border-b border-zinc-600 dark:border-zinc-600">
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Quick Launch Campaign
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={() => startCampaign({name: `Email Campaign ${Date.now()}`, type: 'email'})}
              disabled={outreachLoading}
              className={`p-4 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${
                theme === 'dark' 
                  ? 'border-zinc-500 hover:border-zinc-400 text-zinc-300'
                  : 'border-gray-300 hover:border-gray-400 text-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">📧</div>
              <div className="font-medium">Email Campaign</div>
              <div className="text-sm opacity-75">To {favorites.length} saved leads</div>
            </button>
            
            <button 
              onClick={() => startCampaign({name: `Instagram DM ${Date.now()}`, type: 'instagram'})}
              disabled={outreachLoading}
              className={`p-4 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${
                theme === 'dark' 
                  ? 'border-zinc-500 hover:border-zinc-400 text-zinc-300'
                  : 'border-gray-300 hover:border-gray-400 text-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">📱</div>
              <div className="font-medium">Instagram DMs</div>
              <div className="text-sm opacity-75">Auto personalized</div>
            </button>
            
            <button 
              onClick={() => startCampaign({name: `Voice Calls ${Date.now()}`, type: 'voice'})}
              disabled={outreachLoading}
              className={`p-4 rounded-lg border-2 border-dashed transition-all duration-200 hover:scale-105 ${
                theme === 'dark' 
                  ? 'border-zinc-500 hover:border-zinc-400 text-zinc-300'
                  : 'border-gray-300 hover:border-gray-400 text-gray-600'
              }`}
            >
              <div className="text-2xl mb-2">📞</div>
              <div className="font-medium">AI Voice Calls</div>
              <div className="text-sm opacity-75">ElevenLabs powered</div>
            </button>
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div className={`rounded-lg border transition-all duration-300 ${
        theme === 'dark' ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-gray-200'
      }`}>
        <div className="p-4 border-b border-zinc-600 dark:border-zinc-600">
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Integration Status
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>Gmail API</span>
            </div>
            <span className="text-sm text-red-600">API Key Required</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>Instagram Business API</span>
            </div>
            <span className="text-sm text-red-600">API Key Required</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>ElevenLabs Voice API</span>
            </div>
            <span className="text-sm text-red-600">API Key Required</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-zinc-900' // Match dark map background
        : 'bg-gray-50'  // Light background
    }`}>
      {/* Header */}
      <header className={`shadow-sm border-b transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-zinc-800 border-zinc-700' // Match dark map header
          : 'bg-white border-gray-200'    // Light header
      }`}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-zinc-600 text-zinc-100'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className={`text-xl font-semibold transition-all duration-300 logo-shimmer`}>
                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Lead</span>
                <span className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-500'}>Finder</span>
              </span>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center space-x-8">
              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                    activeTab === 'search' 
                      ? theme === 'dark'
                        ? 'text-white bg-zinc-700'
                        : 'text-gray-900 bg-gray-100'
                      : theme === 'dark'
                        ? 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                    activeTab === 'favorites' 
                      ? theme === 'dark'
                        ? 'text-white bg-zinc-700'
                        : 'text-gray-900 bg-gray-100'
                      : theme === 'dark'
                        ? 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Saved {favorites.length > 0 && `(${favorites.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('outreach')}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                    activeTab === 'outreach' 
                      ? theme === 'dark'
                        ? 'text-white bg-zinc-700'
                        : 'text-gray-900 bg-gray-100'
                      : theme === 'dark'
                        ? 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Outreach 🚀
                </button>
              </nav>
              
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                  theme === 'dark'
                    ? 'bg-zinc-700 text-zinc-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {theme === 'dark' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <div className={`w-96 shadow-lg border-r overflow-y-auto transition-all duration-300 ${
          theme === 'dark'
            ? 'bg-zinc-800 border-zinc-700' // Match dark map sidebar
            : 'bg-white border-gray-200'    // Light sidebar
        }`}>
          <div className="p-8">
            {activeTab === 'search' ? (
              <>
                {/* Search Form */}
                <form onSubmit={handleSearch} className="space-y-6 mb-8">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className={`block text-sm font-semibold transition-all duration-300 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        Industry Target
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCustomSearch(!showCustomSearch)}
                        className={`text-xs font-medium px-3 py-1 rounded-full transition-all duration-200 focus:outline-none ${
                          theme === 'dark'
                            ? 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {showCustomSearch ? 'Presets' : 'Custom'}
                      </button>
                    </div>
                    
                    {showCustomSearch ? (
                      <input
                        type="text"
                        value={customSearch}
                        onChange={(e) => setCustomSearch(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-zinc-700 border-zinc-600 text-zinc-100 placeholder-zinc-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                        }`}
                        placeholder="e.g., AI startups, dental clinics, marketing agencies"
                      />
                    ) : (
                      <select
                        value={searchForm.business_type}
                        onChange={(e) => setSearchForm({...searchForm, business_type: e.target.value})}
                        className={`w-full px-4 py-3 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                            : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      >
                        {businessTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-semibold mb-3 transition-all duration-300 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Location
                    </label>
                    <input
                      type="text"
                      value={searchForm.location}
                      onChange={(e) => setSearchForm({...searchForm, location: e.target.value})}
                      className={`w-full px-4 py-3 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent ${
                        theme === 'dark'
                          ? 'bg-zinc-700 border-zinc-600 text-zinc-100 placeholder-zinc-400'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="City, state, or zip code"
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-semibold mb-3 transition-all duration-300 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Search Radius: {searchForm.radius} km
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={searchForm.radius}
                      onChange={(e) => setSearchForm({...searchForm, radius: parseInt(e.target.value)})}
                      className="w-full range-slider"
                    />
                    <div className={`flex justify-between text-xs mt-1 transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                    }`}>
                      <span>1 km</span>
                      <span>50 km</span>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed search-button ${
                      theme === 'dark'
                        ? 'bg-white text-zinc-900 hover:bg-gray-100'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="loading-spinner"></div>
                        <span>Finding Leads...</span>
                      </div>
                    ) : (
                      'Find Qualified Leads'
                    )}
                  </button>
                </form>

                {/* No Results Message */}
                {searchPerformed && businesses.length === 0 && !loading && (
                  <div className={`text-center py-8 border rounded-lg transition-all duration-300 ${
                    theme === 'dark'
                      ? 'bg-zinc-700 border-zinc-600 text-zinc-300'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="font-semibold mb-2">No leads found</h3>
                    <p className="text-sm">Try expanding your search radius or different business type</p>
                  </div>
                )}

                {/* Filters */}
                {businesses.length > 0 && (
                  <div className={`border-t pt-6 space-y-6 transition-all duration-300 ${
                    theme === 'dark' ? 'border-zinc-600' : 'border-gray-200'
                  }`}>
                    <h3 className={`text-sm font-semibold transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                    }`}>
                      Filters
                    </h3>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-3 transition-all duration-300 ${
                        theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                      }`}>
                        Quality Score: {filters.min_quality_score}+
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filters.min_quality_score}
                        onChange={(e) => setFilters({...filters, min_quality_score: parseInt(e.target.value)})}
                        className="w-full range-slider"
                      />
                      <div className={`flex justify-between text-xs mt-1 transition-all duration-300 ${
                        theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                      }`}>
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-3 transition-all duration-300 ${
                        theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                      }`}>
                        Lead Priority
                      </label>
                      <select
                        value={filters.lead_status}
                        onChange={(e) => setFilters({...filters, lead_status: e.target.value})}
                        className={`w-full px-4 py-3 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent ${
                          theme === 'dark'
                            ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                            : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      >
                        <option value="">All Priorities</option>
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
                        className="w-4 h-4 professional-checkbox"
                      />
                      <label htmlFor="has_contact" className={`ml-3 text-sm transition-all duration-300 ${
                        theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                      }`}>
                        Require contact information
                      </label>
                    </div>

                    {/* Results Summary */}
                    <div className={`border-t pt-4 transition-all duration-300 ${
                      theme === 'dark' ? 'border-zinc-600' : 'border-gray-200'
                    }`}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className={`text-sm font-semibold transition-all duration-300 ${
                          theme === 'dark' ? 'text-white' : 'text-gray-700'
                        }`}>
                          {filteredBusinesses.length} Qualified Leads
                        </h3>
                        <button
                          onClick={exportToCSV}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            theme === 'dark'
                              ? 'bg-white text-zinc-900 hover:bg-gray-100'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === 'outreach' ? (
              renderOutreachTab()
            ) : (
              /* Favorites Tab */
              <div>
                <h2 className={`text-xl font-semibold mb-6 transition-all duration-300 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Saved Leads
                </h2>
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 transition-all duration-300 ${
                      theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-100'
                    }`}>
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <p className={`transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                    }`}>
                      No saved leads
                    </p>
                    <p className={`text-sm mt-1 transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
                    }`}>
                      Save prospects to build your pipeline
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {favorites.map(business => (
                      <div key={business.favorite_id} className={`p-5 rounded-lg border hover-card transition-all duration-300 ${
                        theme === 'dark'
                          ? 'bg-zinc-700 border-zinc-600'
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className={`font-semibold mb-1 transition-all duration-300 ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {business.name}
                            </h4>
                            <p className={`text-sm capitalize mb-2 transition-all duration-300 ${
                              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                            }`}>
                              {business.business_type}
                            </p>
                            <p className={`text-sm mb-3 transition-all duration-300 ${
                              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                            }`}>
                              {business.address}
                            </p>
                            <div className="flex flex-wrap gap-3 text-sm">
                              {business.phone && (
                                <a href={`tel:${business.phone}`} className={`transition-colors duration-200 ${
                                  theme === 'dark'
                                    ? 'text-zinc-300 hover:text-zinc-100'
                                    : 'text-gray-700 hover:text-gray-900'
                                }`}>
                                  {business.phone}
                                </a>
                              )}
                              {business.website && (
                                <a href={business.website} target="_blank" rel="noopener noreferrer" className={`transition-colors duration-200 ${
                                  theme === 'dark'
                                    ? 'text-zinc-300 hover:text-zinc-100'
                                    : 'text-gray-700 hover:text-gray-900'
                                }`}>
                                  Website
                                </a>
                              )}
                              {business.email && (
                                <a href={`mailto:${business.email}`} className={`transition-colors duration-200 ${
                                  theme === 'dark'
                                    ? 'text-zinc-300 hover:text-zinc-100'
                                    : 'text-gray-700 hover:text-gray-900'
                                }`}>
                                  {business.email}
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromFavorites(business.favorite_id)}
                            className="text-gray-400 hover:text-red-500 transition-all duration-200 ml-4 hover:scale-110"
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
        <div className={`flex-1 relative transition-all duration-300 ${
          theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'
        }`}>
          {mapLoading && (
            <div className={`absolute inset-0 flex items-center justify-center z-10 transition-all duration-300 ${
              theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'
            }`}>
              <div className="text-center">
                <div className="map-loading-spinner mb-4"></div>
                <p className={`transition-all duration-300 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                }`}>
                  Loading map...
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'outreach' ? (
            <div className={`h-full flex items-center justify-center ${
              theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50'
            }`}>
              <div className="text-center max-w-lg">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className={`text-2xl font-bold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Outreach Automation Center
                </h2>
                <p className={`text-lg mb-6 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                }`}>
                  Launch automated email, Instagram DM, and AI voice campaigns to your saved leads
                </p>
                <div className={`text-sm px-4 py-2 rounded-full inline-block ${
                  theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  🎯 Ready to launch when API keys are connected
                </div>
              </div>
            </div>
          ) : (
            <MapContainer
              center={[37.7749, -122.4194]}
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
                    <div className="p-5 min-w-80">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-gray-900 text-lg pr-4">{business.name}</h3>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                          business.lead_status === 'hot' ? 'bg-red-100 text-red-800' :
                          business.lead_status === 'warm' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {business.lead_status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-700 mb-4">
                        <p><span className="font-medium">Industry:</span> <span className="capitalize">{business.business_type}</span></p>
                        <p><span className="font-medium">Address:</span> {business.address}</p>
                        {business.phone && (
                          <p><span className="font-medium">Phone:</span> 
                            <a href={`tel:${business.phone}`} className="text-gray-900 font-medium ml-1 hover:underline">
                              {business.phone}
                            </a>
                          </p>
                        )}
                        {business.website && (
                          <p><span className="font-medium">Website:</span> 
                            <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-medium ml-1 hover:underline">
                              Visit Site
                            </a>
                          </p>
                        )}
                        {business.email && (
                          <p><span className="font-medium">Email:</span> 
                            <a href={`mailto:${business.email}`} className="text-gray-900 font-medium ml-1 hover:underline">
                              {business.email}
                            </a>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                        <span className={`text-sm font-semibold ${getQualityColor(business.quality_score)}`}>
                          Score: {business.quality_score}/100
                        </span>
                        <button
                          onClick={() => addToFavorites(business)}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all duration-200 hover:scale-105"
                        >
                          Save Lead
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          
          {/* Results Stats - Only show on search tab */}
          {businesses.length > 0 && activeTab === 'search' && (
            <div className={`absolute top-6 right-6 rounded-lg shadow-lg border p-5 max-w-sm fade-in transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-zinc-800 border-zinc-600'
                : 'bg-white border-gray-200'
            }`}>
              <h4 className={`font-semibold mb-3 transition-all duration-300 ${
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              }`}>
                Results
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={`transition-all duration-300 ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                  }`}>
                    Found:
                  </span>
                  <span className={`font-medium transition-all duration-300 ${
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  }`}>
                    {businesses.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`transition-all duration-300 ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                  }`}>
                    Qualified:
                  </span>
                  <span className={`font-medium transition-all duration-300 ${
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  }`}>
                    {filteredBusinesses.length}
                  </span>
                </div>
                <div className={`border-t pt-2 mt-3 space-y-1 transition-all duration-300 ${
                  theme === 'dark' ? 'border-zinc-600' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between">  
                    <span className={`transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    }`}>
                      Hot:
                    </span>
                    <span className="font-medium text-red-500">{filteredBusinesses.filter(b => b.lead_status === 'hot').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    }`}>
                      Warm:
                    </span>
                    <span className="font-medium text-amber-500">{filteredBusinesses.filter(b => b.lead_status === 'warm').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`transition-all duration-300 ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    }`}>
                      Cold:
                    </span>
                    <span className="font-medium text-gray-500">{filteredBusinesses.filter(b => b.lead_status === 'cold').length}</span>
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