import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VendorAPI, type Vendor, type VendorSearchParams, type VendorSearchResult } from '@/lib/api';

// Query keys
export const vendorKeys = {
  all: ['vendors'] as const,
  lists: () => [...vendorKeys.all, 'list'] as const,
  list: (params: VendorSearchParams) => [...vendorKeys.lists(), params] as const,
  details: () => [...vendorKeys.all, 'detail'] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
  analytics: () => [...vendorKeys.all, 'analytics'] as const,
  topRated: () => [...vendorKeys.all, 'top-rated'] as const,
  compliant: () => [...vendorKeys.all, 'compliant'] as const,
  shortlist: (criteria: any) => [...vendorKeys.all, 'shortlist', criteria] as const,
};

// Vendor search hook
export function useVendorSearch(params: VendorSearchParams = {}) {
  return useQuery({
    queryKey: vendorKeys.list(params),
    queryFn: () => VendorAPI.searchVendors(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Individual vendor hook
export function useVendor(vendorId: string) {
  return useQuery({
    queryKey: vendorKeys.detail(vendorId),
    queryFn: () => VendorAPI.getVendorById(vendorId),
    enabled: !!vendorId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Top rated vendors hook
export function useTopRatedVendors(limit: number = 10) {
  return useQuery({
    queryKey: vendorKeys.topRated(),
    queryFn: () => VendorAPI.getTopRatedVendors(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Compliant vendors hook
export function useCompliantVendors() {
  return useQuery({
    queryKey: vendorKeys.compliant(),
    queryFn: () => VendorAPI.getCompliantVendors(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Vendor analytics hook
export function useVendorAnalytics() {
  return useQuery({
    queryKey: vendorKeys.analytics(),
    queryFn: () => VendorAPI.getVendorAnalytics(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Vendor shortlist hook
export function useVendorShortlist(criteria: {
  keywords: string;
  maxPrice?: number;
  minRating?: number;
  geography?: string;
  complianceOnly?: boolean;
}) {
  return useQuery({
    queryKey: vendorKeys.shortlist(criteria),
    queryFn: () => VendorAPI.shortlistVendors(criteria),
    enabled: !!criteria.keywords,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Vendor search with pagination
export function useVendorSearchWithPagination(
  params: VendorSearchParams,
  page: number = 1,
  limit: number = 20
) {
  const searchParams = {
    ...params,
    offset: (page - 1) * limit,
    limit,
  };

  return useQuery({
    queryKey: vendorKeys.list(searchParams),
    queryFn: () => VendorAPI.searchVendors(searchParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Real-time vendor search (for autocomplete)
export function useVendorSearchAutocomplete(query: string, limit: number = 5) {
  return useQuery({
    queryKey: vendorKeys.list({ query, limit }),
    queryFn: () => VendorAPI.searchVendors({ query, limit }),
    enabled: query.length >= 2,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Custom hook for vendor workflow operations
export function useVendorWorkflow() {
  const queryClient = useQueryClient();

  // Search vendors based on workflow criteria
  const searchVendors = useMutation({
    mutationFn: (params: VendorSearchParams) => VendorAPI.searchVendors(params),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
    },
  });

  // Shortlist vendors for workflow
  const shortlistVendors = useMutation({
    mutationFn: (criteria: {
      keywords: string;
      maxPrice?: number;
      minRating?: number;
      geography?: string;
      complianceOnly?: boolean;
    }) => VendorAPI.shortlistVendors(criteria),
    onSuccess: (data, variables) => {
      // Invalidate shortlist queries
      queryClient.invalidateQueries({ queryKey: vendorKeys.shortlist(variables) });
    },
  });

  return {
    searchVendors,
    shortlistVendors,
  };
}

// Hook for vendor comparison
export function useVendorComparison(vendorIds: string[]) {
  const vendorQueries = vendorIds.map(id => useVendor(id));
  
  const isLoading = vendorQueries.some(query => query.isLoading);
  const isError = vendorQueries.some(query => query.isError);
  const vendors = vendorQueries
    .map(query => query.data)
    .filter((vendor): vendor is Vendor => vendor !== null && vendor !== undefined);

  return {
    vendors,
    isLoading,
    isError,
    error: vendorQueries.find(query => query.isError)?.error,
  };
}

// Hook for vendor recommendations
export function useVendorRecommendations(baseVendorId?: string, limit: number = 5) {
  const baseVendor = useVendor(baseVendorId || '');
  
  const recommendations = useQuery({
    queryKey: ['vendor-recommendations', baseVendorId, limit],
    queryFn: async () => {
      if (!baseVendor.data) return [];
      
      // Find similar vendors based on category, geography, and rating
      const similarVendors = await VendorAPI.searchVendors({
        category: baseVendor.data.category,
        geography: baseVendor.data.geography,
        minRating: Math.max(0, baseVendor.data.average_rating - 0.5),
        limit: limit + 1, // +1 to exclude the base vendor
      });
      
      // Filter out the base vendor
      return similarVendors.vendors.filter(vendor => 
        vendor.vendor_id !== baseVendorId
      ).slice(0, limit);
    },
    enabled: !!baseVendorId && !!baseVendor.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    ...recommendations,
    baseVendor: baseVendor.data,
  };
}
