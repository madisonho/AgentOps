# Frontend-Backend Integration Guide

This document explains how the frontend and backend are integrated to work with vendor data from the JSON files.

## Overview

The integration provides a complete vendor management system with:
- **Frontend**: React application with AI workflow visualization
- **Backend**: Express.js API server serving vendor data
- **Data**: Mock vendor data from JSON files
- **Features**: Search, filtering, analytics, and AI-powered shortlisting

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Data Files    │
│   (React)       │◄──►│   (Express.js)  │◄──►│   (JSON)        │
│                 │    │                 │    │                 │
│ • AIFlowCanvas  │    │ • REST API      │    │ • synthetic_    │
│ • VendorSearch  │    │ • Filtering     │    │   vendor_data   │
│ • Analytics     │    │ • Analytics     │    │ • compliance_   │
│ • React Query   │    │ • Shortlisting  │    │   List1/2       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Start the Backend Server

```bash
# Install backend dependencies
cd /path/to/project
npm install --prefix . express cors

# Start the server
node server.js
```

The server will run on `http://localhost:3001` and load vendor data from the JSON files.

### 2. Start the Frontend

```bash
# Install frontend dependencies
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173` and connect to the backend API.

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Backend API URL (optional - defaults to mock data if not set)
REACT_APP_API_URL=http://localhost:3001/api

# Force mock data usage
REACT_APP_USE_MOCK_DATA=true
```

### Switching Between Mock and Real API

The system automatically switches between mock data and real API based on configuration:

- **Mock Data**: Used when `REACT_APP_API_URL` is not set or `REACT_APP_USE_MOCK_DATA=true`
- **Real API**: Used when `REACT_APP_API_URL` is set and `REACT_APP_USE_MOCK_DATA` is not `true`

## API Endpoints

### Backend API (Express.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/vendors` | GET | Get vendors with filtering/pagination |
| `/api/vendors/:id` | GET | Get vendor by ID |
| `/api/vendors/analytics` | GET | Get vendor analytics |
| `/api/vendors/shortlist` | POST | AI-powered vendor shortlisting |
| `/api/vendors/top-rated` | GET | Get top-rated vendors |
| `/api/vendors/compliant` | GET | Get compliant vendors |

### Query Parameters

- `query`: Search term
- `category`: Filter by category
- `geography`: Filter by location
- `minRating`: Minimum rating filter
- `maxPrice`: Maximum price filter
- `complianceOnly`: Filter compliant vendors only
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

## Frontend Components

### 1. AIFlowCanvas

The main workflow visualization component that integrates vendor data:

- **Prompt Node**: Accepts user queries
- **Vendor Search Node**: Searches and filters vendors
- **Shortlisting Node**: AI-powered vendor selection
- **Weighting Node**: Configurable scoring criteria
- **Output Node**: Final results with real vendor data

### 2. VendorSearch

Interactive vendor search component with:
- Real-time search with filters
- Compliance status indicators
- Sustainability scores
- Media mentions
- Review highlights

### 3. VendorAnalytics

Dashboard showing vendor insights:
- Total vendor count
- Average ratings
- Compliance rates
- Category distribution
- Geographic distribution

## Data Flow

### 1. User Query Flow

```
User Input → Prompt Node → Vendor Search → Shortlisting → Output
     ↓              ↓            ↓            ↓           ↓
  Keywords → API Search → Filter Results → AI Scoring → Display
```

### 2. Vendor Search Process

1. **Input**: User enters search terms
2. **API Call**: Frontend calls backend API
3. **Filtering**: Backend applies filters to JSON data
4. **Scoring**: AI algorithm scores vendors
5. **Results**: Ranked vendor list returned
6. **Display**: Frontend shows results with metrics

### 3. Analytics Generation

1. **Data Aggregation**: Backend processes all vendor data
2. **Metrics Calculation**: Computes statistics and trends
3. **Chart Data**: Prepares data for visualization
4. **Frontend Display**: Shows charts and metrics

## Key Features

### AI-Powered Shortlisting

The system uses an intelligent scoring algorithm:

```javascript
Score = (Rating × 20) + Compliance Bonus + Sustainability Bonus - Price Penalty
```

- **Base Score**: Vendor rating × 20
- **Compliance Bonus**: +10 for compliant vendors
- **Sustainability Bonus**: +5 for high sustainability index
- **Price Penalty**: -0.1 per dollar over $50

### Real-time Search

- Instant filtering as user types
- Multiple filter criteria
- Pagination support
- Search across vendor names, locations, reviews

### Compliance Tracking

- Automatic compliance violation detection
- Visual indicators for compliance status
- Filtering by compliance requirements
- Compliance rate analytics

## Integration Points

### 1. React Query Integration

```typescript
// Hooks for data fetching
const { data: vendors, isLoading } = useVendorSearch(params);
const { data: analytics } = useVendorAnalytics();
const { data: shortlist } = useVendorShortlist(criteria);
```

### 2. AIFlowCanvas Integration

```typescript
// Vendor data flows through workflow nodes
updateNodeFields(nodeId, { 
  vendors: foundVendors,
  searchResults: vendorCount 
});
```

### 3. Real-time Updates

- Search results update automatically
- Analytics refresh on data changes
- Workflow metrics reflect real data

## Error Handling

### Frontend Error Handling

- Network request failures
- Data validation errors
- Loading states
- Fallback to mock data

### Backend Error Handling

- File read errors
- Invalid query parameters
- Database connection issues
- API rate limiting

## Performance Considerations

### Frontend Optimization

- React Query caching
- Debounced search inputs
- Lazy loading of components
- Optimized re-renders

### Backend Optimization

- Efficient JSON parsing
- Pagination for large datasets
- Caching of analytics
- Optimized filtering algorithms

## Testing

### Frontend Testing

```bash
# Run frontend tests
npm test

# Test vendor search functionality
npm run test:vendor-search

# Test analytics components
npm run test:analytics
```

### Backend Testing

```bash
# Test API endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/vendors?query=paint
curl -X POST http://localhost:3001/api/vendors/shortlist \
  -H "Content-Type: application/json" \
  -d '{"keywords": "paint", "maxPrice": 50}'
```

## Deployment

### Frontend Deployment

```bash
# Build for production
npm run build

# Deploy to static hosting
npm run deploy
```

### Backend Deployment

```bash
# Install production dependencies
npm install --production

# Start production server
NODE_ENV=production node server.js
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend CORS is configured correctly
2. **Data Not Loading**: Check JSON file paths and permissions
3. **Search Not Working**: Verify API endpoints are accessible
4. **Performance Issues**: Check for large dataset processing

### Debug Mode

Enable debug logging:

```bash
# Frontend debug
DEBUG=* npm run dev

# Backend debug
DEBUG=* node server.js
```

## Future Enhancements

- Database integration (PostgreSQL/MongoDB)
- Real-time notifications
- Advanced analytics
- Machine learning improvements
- Multi-tenant support
- API rate limiting
- Authentication/authorization

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Test with mock data first
4. Verify environment configuration
