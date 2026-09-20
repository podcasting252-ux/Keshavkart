import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_SHOP_INFO, INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ORDERS } from './src/data/initialData';
import { ShopInfo, Category, Product, Order } from './src/types';

interface DatabaseSchema {
  shop: ShopInfo;
  categories: Category[];
  products: Product[];
  orders: Order[];
}

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure data and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory cache synced to disk
let db: DatabaseSchema;

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.shop && Array.isArray(parsed.products)) {
        return {
          shop: { ...INITIAL_SHOP_INFO, ...parsed.shop },
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : INITIAL_CATEGORIES,
          products: parsed.products,
          orders: Array.isArray(parsed.orders) ? parsed.orders : INITIAL_ORDERS,
        };
      }
    }
  } catch (err) {
    console.error('Error loading database.json, initializing fresh seed:', err);
  }

  const initialDb: DatabaseSchema = {
    shop: INITIAL_SHOP_INFO,
    categories: INITIAL_CATEGORIES,
    products: INITIAL_PRODUCTS,
    orders: INITIAL_ORDERS,
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data: DatabaseSchema) {
  try {
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Failed to write database to disk:', err);
  }
}

db = loadDatabase();

async function startServer() {
  const app = express();

  // Allow larger payload for image uploads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Serve static uploads
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ==========================================
  // API ROUTES
  // ==========================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Direct ZIP download endpoint
  app.get(['/api/download-zip', '/download-zip', '/project.zip'], (req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'project.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="apna-mart-project.zip"');
      return res.sendFile(zipPath);
    }
    res.status(404).json({ error: 'ZIP file not found' });
  });

  // 1. SHOP ENDPOINTS
  app.get('/api/shop', (req, res) => {
    res.json(db.shop);
  });

  app.put('/api/shop', (req, res) => {
    try {
      const updates = req.body;
      db.shop = {
        ...db.shop,
        ...updates,
        retailWholesaleSettings: {
          ...db.shop.retailWholesaleSettings,
          ...(updates.retailWholesaleSettings || {}),
        },
      };
      saveDatabase(db);
      res.json(db.shop);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update shop settings' });
    }
  });

  // 2. CATEGORIES ENDPOINTS
  app.get('/api/categories', (req, res) => {
    const sorted = [...db.categories].sort((a, b) => a.displayOrder - b.displayOrder);
    res.json(sorted);
  });

  app.post('/api/categories', (req, res) => {
    try {
      const { name, image, displayOrder } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const newCategory: Category = {
        id: req.body.id || `cat-${Date.now()}`,
        name: name.trim(),
        image: image?.trim() || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
        displayOrder: Number(displayOrder) || db.categories.length + 1,
      };
      db.categories.push(newCategory);
      saveDatabase(db);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  app.put('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = db.categories.findIndex((c) => c.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }
      db.categories[idx] = { ...db.categories[idx], ...req.body };
      saveDatabase(db);
      res.json(db.categories[idx]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.categories = db.categories.filter((c) => c.id !== id);
      saveDatabase(db);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // 3. PRODUCTS ENDPOINTS
  app.get('/api/products', (req, res) => {
    res.json(db.products);
  });

  app.post('/api/products', (req, res) => {
    try {
      const body = req.body;
      if (!body.name) {
        return res.status(400).json({ error: 'Product name is required' });
      }

      const retailPrice = Number(body.retailPrice ?? body.price ?? 0);
      const stock = Number(body.stock ?? 10);
      const primaryImage = body.image || (body.images && body.images[0]) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80';

      const newProduct: Product = {
        id: body.id || `prod-${Date.now()}`,
        name: body.name.trim(),
        nameHindi: body.nameHindi?.trim() || undefined,
        category: body.category || 'Groceries & Staples',
        description: body.description?.trim() || `Fresh quality item from ${db.shop.name}`,
        unit: body.unit?.trim() || '1 kg',
        retailPrice,
        price: retailPrice,
        wholesalePrice: Number(body.wholesalePrice ?? Math.round(retailPrice * 0.9)),
        stock,
        inStock: stock > 0,
        barcode: body.barcode?.trim() || `${Date.now()}`,
        images: Array.isArray(body.images) && body.images.length > 0 ? body.images : [primaryImage],
        image: primaryImage,
        variants: Array.isArray(body.variants) ? body.variants : undefined,
        badge: body.badge?.trim() || undefined,
        isVeg: body.isVeg !== false,
        originalPrice: body.originalPrice ? Number(body.originalPrice) : undefined,
      };

      db.products.unshift(newProduct);
      saveDatabase(db);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = db.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const current = db.products[idx];
      const updates = req.body;

      let updatedRetailPrice = current.retailPrice;
      if (updates.retailPrice !== undefined) {
        updatedRetailPrice = Number(updates.retailPrice);
      } else if (updates.price !== undefined) {
        updatedRetailPrice = Number(updates.price);
      }

      let updatedStock = current.stock;
      if (updates.stock !== undefined) {
        updatedStock = Number(updates.stock);
      }

      let updatedInStock = current.inStock;
      if (updates.inStock !== undefined) {
        updatedInStock = Boolean(updates.inStock);
      } else if (updates.stock !== undefined) {
        updatedInStock = updatedStock > 0;
      }

      const primaryImage = updates.image || (updates.images && updates.images[0]) || current.image;

      db.products[idx] = {
        ...current,
        ...updates,
        retailPrice: updatedRetailPrice,
        price: updatedRetailPrice,
        stock: updatedStock,
        inStock: updatedInStock,
        image: primaryImage,
      };

      saveDatabase(db);
      res.json(db.products[idx]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.products = db.products.filter((p) => p.id !== id);
      saveDatabase(db);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // 4. ORDERS ENDPOINTS (DATA SAFETY: Real product prices, Stock reduction, Immutable orders)
  app.get('/api/orders', (req, res) => {
    // Return orders sorted newest first
    const sorted = [...db.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(sorted);
  });

  app.post('/api/orders', (req, res) => {
    try {
      const { items, customer, distanceKm = 2 } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain items' });
      }

      const wholesaleSettings = db.shop.retailWholesaleSettings;
      let calculatedSubtotal = 0;
      const orderItemsSnapshots: any[] = [];
      const cartItemsForClient: any[] = [];

      // Validate items against stored product data and compute authoritative prices
      for (const item of items) {
        const storedProd = db.products.find((p) => p.id === item.productId);
        if (!storedProd) {
          return res.status(400).json({ error: `Product not found: ${item.productId}` });
        }

        const qty = Math.max(1, Number(item.quantity) || 1);

        // Check if wholesale pricing applies
        const isWholesale = Boolean(
          wholesaleSettings.enableWholesale &&
          qty >= wholesaleSettings.wholesaleMinOrderQuantity &&
          storedProd.wholesalePrice > 0
        );

        // Authoritative unit price from stored database
        const unitPrice = isWholesale ? storedProd.wholesalePrice : storedProd.retailPrice;
        calculatedSubtotal += unitPrice * qty;

        // Frozen item snapshot preserving original prices permanently
        const snapshot = {
          productId: storedProd.id,
          name: storedProd.name,
          unit: storedProd.unit,
          quantity: qty,
          price: unitPrice,
          originalPrice: storedProd.originalPrice,
          wholesalePrice: storedProd.wholesalePrice,
          isWholesale,
          image: storedProd.image,
        };
        orderItemsSnapshots.push(snapshot);

        // Frozen product object inside items for backward compatibility
        cartItemsForClient.push({
          product: {
            ...storedProd,
            price: unitPrice,
            retailPrice: unitPrice,
          },
          quantity: qty,
        });

        // Stock update: Deduct purchased stock from stored product data
        const newStock = Math.max(0, (storedProd.stock ?? 0) - qty);
        storedProd.stock = newStock;
        storedProd.inStock = newStock > 0;
      }

      // Authoritative delivery fee calculation
      const isDelivery = customer.deliveryType === 'delivery';
      let deliveryFee = 0;
      if (isDelivery) {
        if (calculatedSubtotal >= db.shop.freeDeliveryAbove) {
          deliveryFee = 0;
        } else {
          const perKm = db.shop.deliveryPricePerKm || 0;
          const dist = Math.max(1, Number(distanceKm) || 1);
          deliveryFee = Math.max(db.shop.deliveryFee, Math.round(perKm * dist));
        }
      }

      const totalAmount = calculatedSubtotal + deliveryFee;
      const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      const newOrder: Order = {
        id: orderNumber,
        orderNumber,
        shopId: db.shop.id,
        shopName: db.shop.name,
        items: cartItemsForClient,
        orderItems: orderItemsSnapshots,
        itemCount: items.reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0),
        subtotal: calculatedSubtotal,
        deliveryFee,
        deliveryCharge: deliveryFee,
        discount: 0,
        totalAmount,
        grandTotal: totalAmount,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          address: isDelivery ? customer.address.trim() : `Store Pickup at ${db.shop.address}`,
          deliveryType: isDelivery ? 'delivery' : 'pickup',
          paymentMethod: customer.paymentMethod || 'cod',
          notes: customer.notes?.trim() || undefined,
        },
        pickupOrDelivery: isDelivery ? 'delivery' : 'pickup',
        deliveryAddress: isDelivery ? customer.address.trim() : `Store Pickup at ${db.shop.address}`,
        distanceKm: isDelivery ? Number(distanceKm) : 0,
        status: 'pending',
        orderStatus: 'pending',
        createdAt: new Date().toISOString(),
        estimatedDelivery: isDelivery ? '30-45 mins' : 'Ready in 20 mins',
      };

      // Add to persistent orders
      db.orders.unshift(newOrder);

      // Save database atomically
      saveDatabase(db);

      res.status(201).json({
        order: newOrder,
        updatedProducts: db.products,
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to process order' });
    }
  });

  app.put('/api/orders/:id/status', (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['pending', 'accepted', 'out_for_delivery', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid order status' });
      }

      const order = db.orders.find((o) => o.id === id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      order.status = status;
      order.orderStatus = status;
      saveDatabase(db);

      res.json(order);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // 5. PERSISTENT IMAGE STORAGE
  app.post('/api/upload', (req, res) => {
    try {
      const { data, name } = req.body;
      if (!data) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      // Check if data is a base64 data URI
      const matches = data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      let buffer: Buffer;
      let extension = 'jpg';

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('webp')) extension = 'webp';
        else if (mimeType.includes('gif')) extension = 'gif';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(data, 'base64');
      }

      const safeName = (name || `image-${Date.now()}`)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();
      const fileName = `${Date.now()}-${safeName}${safeName.endsWith(`.${extension}`) ? '' : `.${extension}`}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/${fileName}`;
      res.json({ url: publicUrl, success: true });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to store image' });
    }
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
