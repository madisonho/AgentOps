import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load vendor data
let vendorData = [];

async function loadVendorData() {
  try {
    const syntheticData = JSON.parse(
      await fs.readFile("./synthetic_vendor_data.json", "utf8")
    );
    const complianceList1 = JSON.parse(
      await fs.readFile("./vendor_data_compliance_List1.json", "utf8")
    );
    const complianceList2 = JSON.parse(
      await fs.readFile("./vendor_data_compliance_List2.json", "utf8")
    );

    vendorData = [...syntheticData, ...complianceList1, ...complianceList2];
    console.log(`Loaded ${vendorData.length} vendors`);
  } catch (error) {
    console.error("Error loading vendor data:", error);
    vendorData = [];
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get all vendors with pagination and filtering
app.get("/api/vendors", (req, res) => {
  const {
    query,
    category,
    geography,
    minRating,
    maxPrice,
    complianceOnly,
    limit = 20,
    offset = 0,
  } = req.query;

  let filteredVendors = [...vendorData];

  // Apply filters
  if (query) {
    const searchQuery = query.toLowerCase();
    filteredVendors = filteredVendors.filter(
      vendor =>
        vendor.vendor_name.toLowerCase().includes(searchQuery) ||
        vendor.geography.toLowerCase().includes(searchQuery) ||
        vendor.highlight_reviews.some(review =>
          review.toLowerCase().includes(searchQuery)
        ) ||
        vendor.media_mentions.some(mention =>
          mention.toLowerCase().includes(searchQuery)
        )
    );
  }

  if (category) {
    filteredVendors = filteredVendors.filter(
      vendor => vendor.category?.toLowerCase() === category.toLowerCase()
    );
  }

  if (geography) {
    filteredVendors = filteredVendors.filter(vendor =>
      vendor.geography.toLowerCase().includes(geography.toLowerCase())
    );
  }

  if (minRating) {
    filteredVendors = filteredVendors.filter(
      vendor => vendor.average_rating >= parseFloat(minRating)
    );
  }

  if (maxPrice) {
    filteredVendors = filteredVendors.filter(vendor => {
      const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ""));
      return !isNaN(price) && price <= parseFloat(maxPrice);
    });
  }

  if (complianceOnly === "true") {
    filteredVendors = filteredVendors.filter(
      vendor =>
        vendor.compliance_violations &&
        vendor.compliance_violations.length === 0
    );
  }

  // Apply pagination
  const paginatedVendors = filteredVendors.slice(
    parseInt(offset),
    parseInt(offset) + parseInt(limit)
  );

  res.json({
    vendors: paginatedVendors,
    total: filteredVendors.length,
    page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
    limit: parseInt(limit),
  });
});

// Get vendor by ID
app.get("/api/vendors/:id", (req, res) => {
  const vendor = vendorData.find(v => v.vendor_id === req.params.id);
  if (!vendor) {
    return res.status(404).json({ error: "Vendor not found" });
  }
  res.json(vendor);
});

// Get vendor analytics
app.get("/api/vendors/analytics", (req, res) => {
  const totalVendors = vendorData.length;
  const averageRating =
    vendorData.reduce((sum, vendor) => sum + vendor.average_rating, 0) /
    totalVendors;

  const compliantVendors = vendorData.filter(
    vendor =>
      vendor.compliance_violations && vendor.compliance_violations.length === 0
  );
  const complianceRate = (compliantVendors.length / totalVendors) * 100;

  // Top categories
  const categoryCounts = vendorData.reduce((acc, vendor) => {
    if (vendor.category) {
      acc[vendor.category] = (acc[vendor.category] || 0) + 1;
    }
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top geographies
  const geographyCounts = vendorData.reduce((acc, vendor) => {
    acc[vendor.geography] = (acc[vendor.geography] || 0) + 1;
    return acc;
  }, {});
  const topGeographies = Object.entries(geographyCounts)
    .map(([geography, count]) => ({ geography, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    totalVendors,
    averageRating,
    complianceRate,
    topCategories,
    topGeographies,
  });
});

// Shortlist vendors
app.post("/api/vendors/shortlist", (req, res) => {
  const { keywords, maxPrice, minRating, geography, complianceOnly } = req.body;

  let candidates = [...vendorData];

  // Apply criteria filters
  if (keywords) {
    const keywordsArray = keywords.toLowerCase().split(" ");
    candidates = candidates.filter(vendor =>
      keywordsArray.some(
        keyword =>
          vendor.vendor_name.toLowerCase().includes(keyword) ||
          vendor.highlight_reviews.some(review =>
            review.toLowerCase().includes(keyword)
          ) ||
          vendor.media_mentions.some(mention =>
            mention.toLowerCase().includes(keyword)
          )
      )
    );
  }

  if (maxPrice) {
    candidates = candidates.filter(vendor => {
      const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ""));
      return !isNaN(price) && price <= maxPrice;
    });
  }

  if (minRating) {
    candidates = candidates.filter(
      vendor => vendor.average_rating >= minRating
    );
  }

  if (geography) {
    candidates = candidates.filter(vendor =>
      vendor.geography.toLowerCase().includes(geography.toLowerCase())
    );
  }

  if (complianceOnly) {
    candidates = candidates.filter(
      vendor =>
        vendor.compliance_violations &&
        vendor.compliance_violations.length === 0
    );
  }

  // Score and rank vendors
  const scoredVendors = candidates.map(vendor => {
    let score = vendor.average_rating * 20; // Base score from rating

    // Bonus for compliance
    if (
      vendor.compliance_violations &&
      vendor.compliance_violations.length === 0
    ) {
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
    const price = parseFloat(vendor.pricing.replace(/[^0-9.]/g, ""));
    if (!isNaN(price) && price > 50) {
      score -= (price - 50) * 0.1;
    }

    return { ...vendor, score };
  });

  // Sort by score and return top results
  const topVendors = scoredVendors
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(vendor => {
      const { score, ...vendorData } = vendor;
      return vendorData;
    });

  res.json(topVendors);
});

// Get top rated vendors
app.get("/api/vendors/top-rated", (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const topVendors = vendorData
    .filter(vendor => vendor.average_rating > 0)
    .sort((a, b) => b.average_rating - a.average_rating)
    .slice(0, limit);

  res.json(topVendors);
});

// Get compliant vendors
app.get("/api/vendors/compliant", (req, res) => {
  const compliantVendors = vendorData.filter(
    vendor =>
      vendor.compliance_violations && vendor.compliance_violations.length === 0
  );
  res.json(compliantVendors);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
async function startServer() {
  await loadVendorData();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

startServer().catch(console.error);
