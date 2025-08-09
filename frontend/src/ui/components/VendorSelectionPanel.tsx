import React, { useState, useEffect } from 'react';
import { Box, TextField, MenuItem, Typography, Paper, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Vendor, VendorCard } from './VendorCard';

interface VendorSelectionPanelProps {
  vendors: Vendor[];
  onSelectVendor: (vendor: Vendor) => void;
  selectedVendor: Vendor | null;
}

export const VendorSelectionPanel: React.FC<VendorSelectionPanelProps> = ({
  vendors,
  onSelectVendor,
  selectedVendor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price'>('rating');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>(vendors);

  // Extract price from pricing string (e.g., "$43/gallon" -> 43)
  const getPrice = (pricing: string): number => {
    const priceMatch = pricing.match(/\$([\d.]+)/);
    return priceMatch ? parseFloat(priceMatch[1]) : 0;
  };

  // Filter and sort vendors
  useEffect(() => {
    let result = [...vendors];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (vendor) =>
          vendor.vendor_name.toLowerCase().includes(term) ||
          vendor.geography.toLowerCase().includes(term) ||
          vendor.highlight_reviews.some((review) =>
            review.toLowerCase().includes(term)
          )
      );
    }

    // Filter by price range
    result = result.filter((vendor) => {
      const price = getPrice(vendor.pricing);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Sort vendors
    result.sort((a, b) => {
      if (sortBy === 'rating') {
        return b.average_rating - a.average_rating;
      } else {
        return getPrice(a.pricing) - getPrice(b.pricing);
      }
    });

    setFilteredVendors(result);
  }, [vendors, searchTerm, sortBy, priceRange]);

  // Calculate price range for slider
  const priceValues = vendors.map((v) => getPrice(v.pricing));
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  return (
    <Box sx={{ width: '100%', maxWidth: 500, mx: 'auto' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filter Vendors
        </Typography>
        
        <TextField
          fullWidth
          label="Search vendors"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>Sort by:</Typography>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={(_, newSort) => newSort && setSortBy(newSort)}
            aria-label="sort by"
            size="small"
          >
            <ToggleButton value="rating" aria-label="sort by rating">
              Rating
            </ToggleButton>
            <ToggleButton value="price" aria-label="sort by price">
              Price
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography gutterBottom>
            Price Range: ${priceRange[0]} - ${priceRange[1]}
          </Typography>
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
            style={{ width: '100%' }}
          />
        </Box>
      </Paper>

      <Typography variant="subtitle1" gutterBottom>
        Showing {filteredVendors.length} of {vendors.length} vendors
      </Typography>

      <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {filteredVendors.map((vendor) => (
          <Box key={vendor.vendor_name} mb={2}>
            <VendorCard
              vendor={vendor}
              isSelected={selectedVendor?.vendor_name === vendor.vendor_name}
              onClick={() => onSelectVendor(vendor)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
};
