// API service for vendor data operations
export interface Vendor {
  vendor_id?: string;
  vendor_name: string;
  category?: string;
  geography: string;
  pricing: string;
  products?: string[];
  average_rating: number;
  review_count?: number;
  sentiment?: string;
  highlight_reviews: string[];
  media_mentions: string[];
  first_seen?: string;
  last_updated?: string;
  carbon_score?: number;
  supply_chain_transparency?: string;
  compliance_violations?: string[];
  sustainability_index?: number;
}

export interface VendorSearchParams {
  query?: string;
  category?: string;
  geography?: string;
  minRating?: number;
  maxPrice?: number;
  complianceOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface VendorSearchResult {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
}

// Configuration
const API_BASE_URL = (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:3001/api';
const USE_MOCK_DATA = (typeof process !== 'undefined' && process.env?.REACT_APP_USE_MOCK_DATA === 'true') || !(typeof process !== 'undefined' && process.env?.REACT_APP_API_URL);

// For testing purposes - you can manually override this
export const API_CONFIG = {
  useMockData: USE_MOCK_DATA,
  baseURL: API_BASE_URL,
  setUseMockData: (useMock: boolean) => {
    (API_CONFIG as any).useMockData = useMock;
  }
};

// Mock data imports
import syntheticVendorData from '../../synthetic_vendor_data.json';
import complianceList1 from '../../vendor_data_compliance_List1.json';
import complianceList2 from '../../vendor_data_compliance_List2.json';

// Combine all vendor data
const allVendors: Vendor[] = [
  ...syntheticVendorData,
  ...complianceList1,
  ...complianceList2
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API client
class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }
}

const apiClient = new APIClient(API_BASE_URL);

export class VendorAPI {
  private static vendors = allVendors;

  static async searchVendors(params: VendorSearchParams = {}): Promise<VendorSearchResult> {
    if (API_CONFIG.useMockData) {
      await delay(300); // Simulate network delay

      let filteredVendors = [...this.vendors];

      // Apply filters
      if (params.query) {
        const query = params.query.toLowerCase();
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.vendor_name.toLowerCase().includes(query) ||
          vendor.geography.toLowerCase().includes(query) ||
          vendor.highlight_reviews.some(review => review.toLowerCase().includes(query)) ||
          vendor.media_mentions.some(mention => mention.toLowerCase().includes(query))
        );
      }

      if (params.category) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.category?.toLowerCase() === params.category?.toLowerCase()
        );
      }

      if (params.geography) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.geography.toLowerCase().includes(params.geography!.toLowerCase())
        );
      }

      if (params.minRating) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.average_rating >= params.minRating!
        );
      }

      if (params.maxPrice) {
        filteredVendors = filteredVendors.filter(vendor => {
          const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ''));
          return !isNaN(price) && price <= params.maxPrice!;
        });
      }

      if (params.complianceOnly) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.compliance_violations && vendor.compliance_violations.length === 0
        );
      }

      // Apply pagination
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      const paginatedVendors = filteredVendors.slice(offset, offset + limit);

      return {
        vendors: paginatedVendors,
        total: filteredVendors.length,
        page: Math.floor(offset / limit) + 1,
        limit
      };
    } else {
      // Use real API
      return apiClient.get<VendorSearchResult>('/vendors', params);
    }
  }

  static async getVendorById(vendorId: string): Promise<Vendor | null> {
    if (API_CONFIG.useMockData) {
      await delay(200);
      return this.vendors.find(vendor => vendor.vendor_id === vendorId) || null;
    } else {
      try {
        return await apiClient.get<Vendor>(`/vendors/${vendorId}`);
      } catch (error) {
        return null;
      }
    }
  }

  static async getVendorsByCategory(category: string): Promise<Vendor[]> {
    if (API_CONFIG.useMockData) {
      await delay(250);
      return this.vendors.filter(vendor => vendor.category === category);
    } else {
      return apiClient.get<Vendor[]>('/vendors', { category });
    }
  }

  static async getTopRatedVendors(limit: number = 10): Promise<Vendor[]> {
    if (API_CONFIG.useMockData) {
      await delay(200);
      return this.vendors
        .filter(vendor => vendor.average_rating > 0)
        .sort((a, b) => b.average_rating - a.average_rating)
        .slice(0, limit);
    } else {
      return apiClient.get<Vendor[]>('/vendors/top-rated', { limit });
    }
  }

  static async getCompliantVendors(): Promise<Vendor[]> {
    if (API_CONFIG.useMockData) {
      await delay(300);
      return this.vendors.filter(vendor =>
        vendor.compliance_violations && vendor.compliance_violations.length === 0
      );
    } else {
      return apiClient.get<Vendor[]>('/vendors/compliant');
    }
  }

  static async getVendorAnalytics(): Promise<{
    totalVendors: number;
    averageRating: number;
    complianceRate: number;
    topCategories: { category: string; count: number }[];
    topGeographies: { geography: string; count: number }[];
  }> {
    if (API_CONFIG.useMockData) {
      await delay(400);

      const totalVendors = this.vendors.length;
      const averageRating = this.vendors.reduce((sum, vendor) => sum + vendor.average_rating, 0) / totalVendors;
      
      const compliantVendors = this.vendors.filter(vendor =>
        vendor.compliance_violations && vendor.compliance_violations.length === 0
      );
      const complianceRate = (compliantVendors.length / totalVendors) * 100;

      // Top categories
      const categoryCounts = this.vendors.reduce((acc, vendor) => {
        if (vendor.category) {
          acc[vendor.category] = (acc[vendor.category] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      const topCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top geographies
      const geographyCounts = this.vendors.reduce((acc, vendor) => {
        acc[vendor.geography] = (acc[vendor.geography] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topGeographies = Object.entries(geographyCounts)
        .map(([geography, count]) => ({ geography, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalVendors,
        averageRating,
        complianceRate,
        topCategories,
        topGeographies
      };
    } else {
      return apiClient.get('/vendors/analytics');
    }
  }

  static async shortlistVendors(criteria: {
    keywords: string;
    maxPrice?: number;
    minRating?: number;
    geography?: string;
    complianceOnly?: boolean;
  }): Promise<Vendor[]> {
    if (API_CONFIG.useMockData) {
      await delay(500);

      let candidates = [...this.vendors];

      // Apply criteria filters
      if (criteria.keywords) {
        const keywords = criteria.keywords.toLowerCase().split(' ');
        candidates = candidates.filter(vendor =>
          keywords.some(keyword =>
            vendor.vendor_name.toLowerCase().includes(keyword) ||
            vendor.highlight_reviews.some(review => review.toLowerCase().includes(keyword)) ||
            vendor.media_mentions.some(mention => mention.toLowerCase().includes(keyword))
          )
        );
      }

      if (criteria.maxPrice) {
        candidates = candidates.filter(vendor => {
          const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ''));
          return !isNaN(price) && price <= criteria.maxPrice!;
        });
      }

      if (criteria.minRating) {
        candidates = candidates.filter(vendor =>
          vendor.average_rating >= criteria.minRating!
        );
      }

      if (criteria.geography) {
        candidates = candidates.filter(vendor =>
          vendor.geography.toLowerCase().includes(criteria.geography!.toLowerCase())
        );
      }

      if (criteria.complianceOnly) {
        candidates = candidates.filter(vendor =>
          vendor.compliance_violations && vendor.compliance_violations.length === 0
        );
      }

      // Score and rank vendors
      const scoredVendors = candidates.map(vendor => {
        let score = vendor.average_rating * 20; // Base score from rating
        
        // Bonus for compliance
        if (vendor.compliance_violations && vendor.compliance_violations.length === 0) {
          score += 10;
        }
        
        // Bonus for sustainability
        if (vendor.sustainability_index && vendor.sustainability_index > 70) {
          score += 5;
        }
        
        // Bonus for carbon score
        if (vendor.carbon_score && vendor.carbon_score > 80) {
          score += 5;
        }
        
        // Penalty for high price
        const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 50) {
          score -= (price - 50) * 0.1;
        }

        return { ...vendor, score };
      });

      // Sort by score and return top results
      return scoredVendors
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, 10)
        .map(vendor => {
          const { score, ...vendorData } = vendor as any;
          return vendorData;
        });
    } else {
      // Use real API
      return apiClient.post<Vendor[]>('/vendors/shortlist', criteria);
    }
  }
}
