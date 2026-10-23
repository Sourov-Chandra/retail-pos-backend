import { connectDB, client, db } from "../config/db.js";

const imagesBySku = {
  "DAIRY-001": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
  "BEV-001": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=400&q=80",
  "SNK-001": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80",
  "OIL-001": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
  "TEA-001": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80",
  "SPC-001": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&q=80",
  "SGR-001": "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&q=80",
  "DAIRY-002": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&q=80",
  "SNK-002": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80",
  "BAK-001": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80",
  "RICE-001": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80",
  "BEV-002": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80",
  "PC-001": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
  "PC-002": "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&q=80",
  "BAK-002": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
};

async function updateImages() {
  try {
    await connectDB();
    for (const [sku, url] of Object.entries(imagesBySku)) {
      await db.collection("products").updateOne({ sku }, { $set: { imageUrl: url } });
    }
    console.log("[UpdateImages] Successfully updated 15 items with high-res product photos!");
  } catch (error) {
    console.error("[UpdateImages] Error:", error);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
}

updateImages();
