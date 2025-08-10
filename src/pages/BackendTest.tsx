import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VendorSearch } from '@/components/sandbox/VendorSearch';
import { VendorAnalytics } from '@/components/sandbox/VendorAnalytics';
import { useVendorSearch, useVendorAnalytics } from '@/hooks/use-vendors';
import { VendorAPI, API_CONFIG } from '@/lib/api';
import type { Vendor } from '@/lib/api';

export default function BackendTest() {
  const [searchQuery, setSearchQuery] = useState('paint');
  const [searchResults, setSearchResults] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiMode, setApiMode] = useState<'mock' | 'backend'>('mock');
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  // Test backend connection
  useEffect(() => {
    const testBackend = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/health');
        if (response.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (error) {
        setBackendStatus('error');
      }
    };
    testBackend();
  }, []);

  // Test search with current mode
  const testSearch = async () => {
    setIsLoading(true);
    try {
      // Update API configuration
      API_CONFIG.setUseMockData(apiMode === 'mock');
      
      if (apiMode === 'backend') {
        // Use real backend
        const response = await fetch(`http://localhost:3001/api/vendors?query=${searchQuery}&limit=5`);
        const data = await response.json();
        setSearchResults(data.vendors || []);
      } else {
        // Use mock data
        const results = await VendorAPI.searchVendors({ query: searchQuery, limit: 5 });
        setSearchResults(results.vendors);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      testSearch();
    }
  }, [searchQuery, apiMode]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Backend Integration Test</h1>
        <p className="text-muted-foreground">
          See the difference between mock data and real backend integration
        </p>
      </div>

      {/* Backend Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Backend Status
            <Badge 
              variant={backendStatus === 'connected' ? 'default' : 'destructive'}
            >
              {backendStatus === 'connected' ? '✅ Connected' : 
               backendStatus === 'error' ? '❌ Disconnected' : '⏳ Checking...'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Backend URL:</strong> http://localhost:3001/api
            </p>
            <p className="text-sm">
              <strong>Status:</strong> {backendStatus === 'connected' ? 
                'Backend server is running and accessible' : 
                'Backend server is not accessible. Make sure to run: node server.js'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Data Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={apiMode === 'mock' ? 'default' : 'outline'}
              onClick={() => setApiMode('mock')}
            >
              🎭 Mock Data
            </Button>
            <Button
              variant={apiMode === 'backend' ? 'default' : 'outline'}
              onClick={() => setApiMode('backend')}
              disabled={backendStatus !== 'connected'}
            >
              🔌 Real Backend
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {apiMode === 'mock' ? 
              'Using local mock data (fast, no network calls)' : 
              'Using real backend API (network calls, real data processing)'}
          </p>
        </CardContent>
      </Card>

      {/* Search Test */}
      <Card>
        <CardHeader>
          <CardTitle>Search Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Search Query</Label>
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., paint, Wyoming, eco-friendly"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={testSearch} disabled={isLoading}>
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
              <Badge variant="secondary">
                {searchResults.length} results
              </Badge>
            </div>

            {/* Results */}
            <div className="space-y-2">
              <h4 className="font-medium">Search Results:</h4>
              {searchResults.map((vendor, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="font-medium">{vendor.vendor_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {vendor.geography} • {vendor.pricing} • Rating: {vendor.average_rating}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Tests */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Vendor Search</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>VendorSearch Component</CardTitle>
            </CardHeader>
            <CardContent>
              <VendorSearch 
                keywords={searchQuery}
                maxResults={5}
                showCompliance={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>VendorAnalytics Component</CardTitle>
            </CardHeader>
            <CardContent>
              <VendorAnalytics />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="comparison" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mock vs Backend Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">🎭 Mock Data</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Instant response (no network delay)</li>
                    <li>• Local data processing</li>
                    <li>• No server required</li>
                    <li>• Limited to local JSON files</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">🔌 Real Backend</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Network requests (realistic delays)</li>
                    <li>• Server-side processing</li>
                    <li>• Scalable architecture</li>
                    <li>• Can connect to databases</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1. Start the Backend:</strong></p>
            <code className="block bg-muted p-2 rounded">node server.js</code>
            
            <p><strong>2. Switch Between Modes:</strong></p>
            <p>• Click "Mock Data" for instant local results</p>
            <p>• Click "Real Backend" for network-based results</p>
            
            <p><strong>3. Notice the Differences:</strong></p>
            <p>• Response times (mock is instant, backend has network delay)</p>
            <p>• Data processing (backend can handle more complex queries)</p>
            <p>• Error handling (backend shows real network errors)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
