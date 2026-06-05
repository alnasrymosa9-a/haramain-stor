/**
 * ===== إدارة حالة التطبيق - Supabase =====
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Product, Order, CartItem, Page, OrderStatus } from './types';
import { MOCK_PRODUCTS, MOCK_ORDERS, WHATSAPP_NUMBER } from './data';
import { supabase, isSupabaseConfigured } from './supabase';

interface AppContextType {
  currentPage: Page;
  navigateTo: (page: Page, data?: any) => void;
  pageData: any;
  user: any;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  uploadImage: (file: File, bucket: string, path: string) => Promise<string>;
  whatsappNumber: string;
  sendWhatsApp: (message: string) => void;
  loading: boolean;
  // السلة
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'haramain_cart';

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [pageData, setPageData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [loading, setLoading] = useState(false);
  const [whatsappNumber] = useState(WHATSAPP_NUMBER);

  // السلة - محفوظة في Local Storage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // حفظ السلة في Local Storage عند التغيير
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ===== مراقبة حالة تسجيل الدخول - Supabase =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAdmin(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAdmin(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ===== تحميل البيانات من Supabase =====
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });

        if (productsData && productsData.length > 0) {
          setProducts(productsData.map(p => ({
            ...p,
            mainImage: p.main_image || '',
            images: p.images || [],
            createdAt: p.created_at,
          })));
        }

        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (ordersData && ordersData.length > 0) {
          setOrders(ordersData.map(o => ({
            ...o,
            customerName: o.customer_name,
            totalPrice: o.total_price,
            transferReceipt: o.transfer_receipt || '',
            transferNumber: o.transfer_number || '',
            createdAt: o.created_at,
            updatedAt: o.updated_at,
            items: o.items || [],
          })));
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Realtime subscription
    const productsSub = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadData())
      .subscribe();

    const ordersSub = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
      .subscribe();

    return () => {
      productsSub.unsubscribe();
      ordersSub.unsubscribe();
    };
  }, []);

  const navigateTo = useCallback((page: Page, data?: any) => {
    setCurrentPage(page);
    setPageData(data || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      if (email === 'admin@haramain.com' && password === 'admin123') {
        setIsAdmin(true);
        return true;
      }
      return false;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    } catch {
      return false;
    }
  };

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsAdmin(false);
    setUser(null);
    setCurrentPage('home');
  }, []);

  const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...product,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('products').insert([{
          name: product.name,
          category: product.category,
          description: product.description,
          price: product.price,
          quantity: product.quantity,
          main_image: product.mainImage,
          images: product.images,
          available: product.available,
          featured: product.featured,
          created_at: new Date().toISOString(),
        }]).select().single();

        if (!error && data) {
          setProducts(prev => [{
            ...data,
            mainImage: data.main_image || '',
            images: data.images || [],
            createdAt: data.created_at,
          }, ...prev]);
          return;
        }
      } catch (err) {
        console.error('Error adding product:', err);
      }
    }
    setProducts(prev => [newProduct, ...prev]);
  };

  const updateProduct = async (id: string, data: Partial<Product>) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').update({
          ...(data.name && { name: data.name }),
          ...(data.category && { category: data.category }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.quantity !== undefined && { quantity: data.quantity }),
          ...(data.mainImage !== undefined && { main_image: data.mainImage }),
          ...(data.images !== undefined && { images: data.images }),
          ...(data.available !== undefined && { available: data.available }),
          ...(data.featured !== undefined && { featured: data.featured }),
        }).eq('id', id);
      } catch (err) {
        console.error('Error updating product:', err);
      }
    }
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...data } : p)));
  };

  const deleteProduct = async (id: string) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Order> => {
    const newOrder: Order = {
      ...orderData,
      id: `ORD-${Date.now()}`,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('orders').insert([{
          customer_name: orderData.customerName,
          phone: orderData.phone,
          governorate: orderData.governorate,
          district: orderData.district,
          address: orderData.address,
          items: orderData.items,
          total_price: orderData.totalPrice,
          deposit: orderData.deposit,
          transfer_receipt: orderData.transferReceipt,
          transfer_number: orderData.transferNumber,
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]).select().single();

        if (!error && data) {
          const mapped = {
            ...data,
            customerName: data.customer_name,
            totalPrice: data.total_price,
            transferReceipt: data.transfer_receipt || '',
            transferNumber: data.transfer_number || '',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            items: data.items || [],
          };
          setOrders(prev => [mapped, ...prev]);
          return mapped;
        }
      } catch (err) {
        console.error('Error adding order:', err);
      }
    }

    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    const updateData = { status, updatedAt: new Date().toISOString() };
    if (isSupabaseConfigured) {
      try {
        await supabase.from('orders').update({
          status,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
      } catch (err) {
        console.error('Error updating order:', err);
      }
    }
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...updateData } : o)));
  };

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: true,
        });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
          return urlData.publicUrl;
        }
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    return URL.createObjectURL(file);
  };

  const sendWhatsApp = useCallback((message: string) => {
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, '_blank');
  }, [whatsappNumber]);

  // ===== دوال السلة =====
  const addToCart = useCallback((product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity } : item
    ));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setCart([]), []);

  return (
    <AppContext.Provider value={{
      currentPage, navigateTo, pageData,
      user, isAdmin, login, logout,
      products, addProduct, updateProduct, deleteProduct,
      orders, addOrder, updateOrderStatus,
      uploadImage, whatsappNumber, sendWhatsApp,
      loading,
      cart, addToCart, removeFromCart, updateCartQuantity, clearCart,
      cartTotal, cartCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
