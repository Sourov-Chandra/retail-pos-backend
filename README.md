# Dokandari (দোকানদারি) — Backend API

> Production-ready RESTful API backend for Dokandari (দোকানদারি) Retail POS & Inventory Management System (Bangladesh Edition ৳ BDT, Asia/Dhaka timezone).

## Tech Stack
- **Runtime**: Node.js v22+ / Express 5
- **Database**: MongoDB Atlas Replica Set (ACID Multi-document Transactions)
- **Auth**: Better Auth with Mongo Adapter (Owner and Cashier roles)
- **Media**: ImgBB Cloud API with zero-disk `multer.memoryStorage()`
- **Currency & Precision**: Minor units (poisha) to prevent floating-point inaccuracies
- **Timezone**: Strict `Asia/Dhaka` UTC+6 business day boundaries
