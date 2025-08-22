import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import Chatbot from './components/Chatbot';
import './App.css';

interface Building {
  id: number;
  name: string;
  height: number;
  building_type: string;
  address: string;
  geometry: any;
}

function App() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [highlightedBuilding, setHighlightedBuilding] = useState<Building | undefined>();
  const [highlightedBuildings, setHighlightedBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    fetchBuildings();
  }, []);

  const fetchBuildings = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/buildings');
      if (!response.ok) {
        throw new Error('Failed to fetch buildings');
      }
      const data = await response.json();
      setBuildings(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      setError('Failed to load building data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingHighlight = (building: Building) => {
    setHighlightedBuilding(building);
    setHighlightedBuildings([]); // Clear multi-building highlighting when single building is selected
  };

  const handleMultiBuildingHighlight = (buildings: Building[]) => {
    setHighlightedBuildings(buildings);
    setHighlightedBuilding(undefined); // Clear single building highlighting
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-32 w-32 border-4 border-gray-700 border-t-blue-500 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-white">Loading 3D Building Data</h2>
          <p className="mt-2 text-gray-400">Preparing your interactive map experience...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connection Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={fetchBuildings}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-96' : 'w-16'} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col h-screen`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Building Explorer</h1>
                  <p className="text-xs text-gray-400">AI-Powered Analysis</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Panel - Accordion */}
        {sidebarOpen && (
          <div className="border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => setStatsExpanded(!statsExpanded)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-700 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-300">Quick Stats</h3>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${statsExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-200 ${statsExpanded ? 'max-h-32' : 'max-h-0'}`}>
              <div className="px-4 pb-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Total Buildings</span>
                  <span className="text-white font-medium">{buildings.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Tallest</span>
                  <span className="text-white font-medium">
                    {buildings.length > 0 ? Math.max(...buildings.map(b => b.height)) : 0}m
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Types</span>
                  <span className="text-white font-medium">
                    {new Set(buildings.map(b => b.building_type)).size}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <div className="flex-1 flex flex-col min-h-0">
          <Chatbot 
            onBuildingHighlight={handleBuildingHighlight}
            onMultiBuildingHighlight={handleMultiBuildingHighlight}
            sidebarOpen={sidebarOpen}
          />
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-white font-semibold">Interactive Map</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Live Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="h-full w-full">
          <Map
            buildings={buildings}
            highlightedBuilding={highlightedBuilding}
            highlightedBuildings={highlightedBuildings}
            onBuildingClick={handleBuildingHighlight}
          />
        </div>


      </div>
    </div>
  );
}

export default App;
