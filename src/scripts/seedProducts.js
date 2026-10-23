import { connectDB, client, db } from "../config/db.js";
import { productService } from "../modules/products/product.service.js";

const SAMPLE_PRODUCTS = [
  {
    name: "Aarong Dairy Liquid Milk (1L)",
    category: "Dairy",
    sku: "DAIRY-001",
    sellingPrice: 9500, // ৳95.00
    stockQuantity: 40,
    lowStockThreshold: 10,
  },
  {
    name: "Pran Mango Fruit Drink (250ml)",
    category: "Beverages",
    sku: "BEV-001",
    sellingPrice: 3500, // ৳35.00
    stockQuantity: 60,
    lowStockThreshold: 15,
  },
  {
    name: "Ruchi Chanachur Barbecue (150g)",
    category: "Snacks",
    sku: "SNK-001",
    sellingPrice: 4500, // ৳45.00
    stockQuantity: 50,
    lowStockThreshold: 10,
  },
  {
    name: "Teer Fortified Soyabean Oil (1L)",
    category: "Pantry",
    sku: "OIL-001",
    sellingPrice: 18500, // ৳185.00
    stockQuantity: 30,
    lowStockThreshold: 8,
  },
  {
    name: "Ispahani Mirzapore Tea (400g)",
    category: "Beverages",
    sku: "TEA-001",
    sellingPrice: 21000, // ৳210.00
    stockQuantity: 25,
    lowStockThreshold: 5,
  },
  {
    name: "Radhuni Turmeric Powder (200g)",
    category: "Spices",
    sku: "SPC-001",
    sellingPrice: 8000, // ৳80.00
    stockQuantity: 35,
    lowStockThreshold: 8,
  },
  {
    name: "Fresh Refined Sugar (1kg)",
    category: "Pantry",
    sku: "SGR-001",
    sellingPrice: 13500, // ৳135.00
    stockQuantity: 50,
    lowStockThreshold: 10,
  },
  {
    name: "Danish Condensed Milk (397g)",
    category: "Dairy",
    sku: "DAIRY-002",
    sellingPrice: 9000, // ৳90.00
    stockQuantity: 25,
    lowStockThreshold: 6,
  },
  {
    name: "Maggi 2-Minute Noodles (4-Pack)",
    category: "Snacks",
    sku: "SNK-002",
    sellingPrice: 9000, // ৳90.00
    stockQuantity: 45,
    lowStockThreshold: 10,
  },
  {
    name: "Olympic Energy Plus Biscuit (300g)",
    category: "Bakery",
    sku: "BAK-001",
    sellingPrice: 6000, // ৳60.00
    stockQuantity: 50,
    lowStockThreshold: 12,
  },
  {
    name: "ACI Pure Miniket Premium Rice (5kg)",
    category: "Grains",
    sku: "RICE-001",
    sellingPrice: 38000, // ৳380.00
    stockQuantity: 20,
    lowStockThreshold: 5,
  },
  {
    name: "Mojo Carbonated Soft Drink (500ml)",
    category: "Beverages",
    sku: "BEV-002",
    sellingPrice: 3000, // ৳30.00
    stockQuantity: 75,
    lowStockThreshold: 15,
  },
  {
    name: "Lifebuoy Care Handwash (200ml)",
    category: "Personal Care",
    sku: "PC-001",
    sellingPrice: 11500, // ৳115.00
    stockQuantity: 25,
    lowStockThreshold: 6,
  },
  {
    name: "Sensodyne Fresh Mint Toothpaste (70g)",
    category: "Personal Care",
    sku: "PC-002",
    sellingPrice: 16500, // ৳165.00
    stockQuantity: 20,
    lowStockThreshold: 5,
  },
  {
    name: "All Time Premium Butter Bread (400g)",
    category: "Bakery",
    sku: "BAK-002",
    sellingPrice: 6500, // ৳65.00
    stockQuantity: 30,
    lowStockThreshold: 8,
  },
];

async function seedProducts() {
  console.log("[SeedProducts] Starting product catalog seeding...");

  try {
    await connectDB();

    // 1. Find the owner user to attribute initial stock creation
    const owner = await db.collection("user").findOne({ role: "owner" });
    const actorId = owner ? owner._id : "system-seed";

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of SAMPLE_PRODUCTS) {
      const existing = await db.collection("products").findOne({ sku: item.sku });
      if (existing) {
        console.log(`  - [SKIPPED] ${item.sku} already exists: "${item.name}"`);
        skippedCount++;
        continue;
      }

      await productService.createProduct(item, actorId);
      console.log(`  + [ADDED]   ${item.sku} — "${item.name}" (Stock: ${item.stockQuantity})`);
      addedCount++;
    }

    console.log(`\n[SeedProducts] Seeding completed:`);
    console.log(`  • Newly added: ${addedCount}`);
    console.log(`  • Already existed: ${skippedCount}`);
    console.log(`  • Total in catalog: ${addedCount + skippedCount}`);
  } catch (error) {
    console.error("[SeedProducts] Error seeding products:", error);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
}

seedProducts();
