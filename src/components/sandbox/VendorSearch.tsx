import { useState, useEffect } from 'react';
import { useVendorSearch, useVendorShortlist } from '@/hooks/use-vendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Star, MapPin, DollarSign, Shield, TrendingUp } from 'lucide-react';
import type { Vendor } from '@/lib/api';

interface VendorSearchProps {
  keywords?: string;
  onVendorsFound?: (vendors: Vendor[]) => void;
  onSearchComplete?: (count: number) => void;
  maxResults?: number;
  showCompliance?: boolean;
}

export function VendorSearch({ 
  keywords = '', 
  onVendorsFound, 
  onSearchComplete,
  maxResults = 10,
  showCompliance = true 
}: VendorSearchProps) {
  const [searchQuery, setSearchQuery] = useState(keywords);
  const [filters, setFilters] = useState({
    minRating: 0,
    maxPrice: 100,
    complianceOnly: false,
    geography: ''
  });

  // Use the shortlist hook for AI-powered vendor selection
  const shortlistQuery = useVendorShortlist({
    keywords: searchQuery,
    minRating: filters.minRating,
    maxPrice: filters.maxPrice,
    complianceOnly: filters.complianceOnly,
    geography: filters.geography
  });

  // Use regular search for manual filtering
  const searchQuery_regular = useVendorSearch({
    query: searchQuery,
    minRating: filters.minRating,
    maxPrice: filters.maxPrice,
    complianceOnly: filters.complianceOnly,
    geography: filters.geography,
    limit: maxResults
  });

  const vendors = shortlistQuery.data || searchQuery_regular.data?.vendors || [];
  const isLoading = shortlistQuery.isLoading || searchQuery_regular.isLoading;

  useEffect(() => {
    if (keywords && keywords !== searchQuery) {
      setSearchQuery(keywords);
    }
  }, [keywords, searchQuery]);

  useEffect(() => {
    if (vendors.length > 0) {
      onVendorsFound?.(vendors);
      onSearchComplete?.(vendors.length);
    }
  }, [vendors, onVendorsFound, onSearchComplete]);

  const formatPrice = (price: string) => {
    const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
    if (isNaN(numericPrice)) return price;
    return `$${numericPrice.toFixed(2)}`;
  };

  const getComplianceStatus = (vendor: Vendor) => {
    if (!vendor.compliance_violations || vendor.compliance_violations.length === 0) {
      return { status: 'compliant', label: 'Compliant', color: 'bg-green-100 text-green-800' };
    }
    return { status: 'non-compliant', label: 'Non-compliant', color: 'bg-red-100 text-red-800' };
  };

  const getSustainabilityScore = (vendor: Vendor) => {
    if (vendor.sustainability_index && vendor.sustainability_index > 80) {
      return { score: vendor.sustainability_index, level: 'Excellent', color: 'text-green-600' };
    } else if (vendor.sustainability_index && vendor.sustainability_index > 60) {
      return { score: vendor.sustainability_index, level: 'Good', color: 'text-yellow-600' };
    } else if (vendor.sustainability_index && vendor.sustainability_index > 40) {
      return { score: vendor.sustainability_index, level: 'Fair', color: 'text-orange-600' };
    }
    return { score: vendor.sustainability_index || 0, level: 'Poor', color: 'text-red-600' };
  };

  return (
    <div className="space-y-4">
      {/* Search Controls */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search vendors by name, location, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button 
            onClick={() => setSearchQuery(searchQuery)}
            disabled={isLoading}
          >
            Search
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label htmlFor="minRating" className="text-xs">Min Rating</Label>
            <Input
              id="minRating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={filters.minRating}
              onChange={(e) => setFilters(prev => ({ ...prev, minRating: parseFloat(e.target.value) || 0 }))}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="maxPrice" className="text-xs">Max Price</Label>
            <Input
              id="maxPrice"
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: parseFloat(e.target.value) || 100 }))}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor="geography" className="text-xs">Location</Label>
            <Input
              id="geography"
              placeholder="e.g., Wyoming"
              value={filters.geography}
              onChange={(e) => setFilters(prev => ({ ...prev, geography: e.target.value }))}
              className="h-8"
            />
          </div>
          {showCompliance && (
            <div className="flex items-end">
              <Button
                variant={filters.complianceOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, complianceOnly: !prev.complianceOnly }))}
                className="w-full h-8"
              >
                <Shield className="h-3 w-3 mr-1" />
                Compliant Only
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Searching vendors...</p>
          </div>
        ) : vendors.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Found {vendors.length} vendors</h3>
              {shortlistQuery.data && (
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  AI Shortlisted
                </Badge>
              )}
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-3 pr-4">
                {vendors.map((vendor, index) => {
                  const compliance = getComplianceStatus(vendor);
                  const sustainability = getSustainabilityScore(vendor);
                  
                  return (
                    <Card key={vendor.vendor_id || index} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm font-semibold">{vendor.vendor_name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{vendor.geography}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{vendor.average_rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {/* Pricing */}
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">{formatPrice(vendor.pricing)}</span>
                          </div>

                          {/* Compliance Status */}
                          {showCompliance && (
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className={`text-xs ${compliance.color}`}>
                                {compliance.label}
                              </Badge>
                            </div>
                          )}

                          {/* Sustainability Score */}
                          {vendor.sustainability_index && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                              <span className={`text-xs ${sustainability.color}`}>
                                Sustainability: {sustainability.score}/100 ({sustainability.level})
                              </span>
                            </div>
                          )}

                          {/* Reviews */}
                          {vendor.highlight_reviews.length > 0 && (
                            <div className="text-xs text-muted-foreground italic">
                              "{vendor.highlight_reviews[0]}"
                            </div>
                          )}

                          {/* Media Mentions */}
                          {vendor.media_mentions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {vendor.media_mentions.slice(0, 2).map((mention, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {mention}
                                </Badge>
                              ))}
                              {vendor.media_mentions.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{vendor.media_mentions.length - 2} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : searchQuery ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No vendors found matching your criteria.</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search terms or filters.</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Enter search terms to find vendors.</p>
          </div>
        )}
      </div>
    </div>
  );
}
