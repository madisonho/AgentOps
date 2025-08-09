import React from 'react';
import { Card, CardContent, Typography, Box, Rating, Chip } from '@mui/material';

export interface Vendor {
  vendor_name: string;
  geography: string;
  pricing: string;
  media_mentions: string[];
  average_rating: number;
  highlight_reviews: string[];
}

interface VendorCardProps {
  vendor: Vendor;
  isSelected?: boolean;
  onClick?: () => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({ vendor, isSelected = false, onClick }) => {
  return (
    <Card 
      onClick={onClick}
      sx={{
        mb: 2,
        cursor: 'pointer',
        border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" component="div">
              {vendor.vendor_name}
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              {vendor.geography}
            </Typography>
          </Box>
          <Box>
            <Chip label={vendor.pricing} color="primary" size="small" />
          </Box>
        </Box>
        
        <Box display="flex" alignItems="center" my={1}>
          <Rating value={vendor.average_rating} precision={0.1} readOnly />
          <Typography variant="body2" color="text.secondary" ml={1}>
            {vendor.average_rating.toFixed(1)}
          </Typography>
        </Box>

        {vendor.media_mentions.length > 0 && (
          <Box mb={1}>
            <Typography variant="caption" color="text.secondary">
              Featured in: {vendor.media_mentions.join(', ')}
            </Typography>
          </Box>
        )}

        <Box>
          {vendor.highlight_reviews.map((review, index) => (
            <Typography key={index} variant="body2" sx={{ fontStyle: 'italic', mb: 1 }}>
              "{review}"
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};
