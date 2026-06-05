/**
 * ===== صفحة عرض المنتجات =====
 * تعرض جميع المنتجات مع إمكانية التصفية حسب القسم
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../context';
import { ProductCard } from '../components/ProductCard';
import { Category } from '../types';
import { CATEGORIES } from '../types';

export function ProductsPage() {
  const { products, pageData } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>(
    pageData?.category || 'all'
  );
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // تصفية المنتجات
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.available);

    // تصفية حسب القسم
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // البحث
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // الترتيب
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [products, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* رأس الصفحة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-10"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            {selectedCategory === 'all'
              ? 'جميع المنتجات'
              : CATEGORIES.find((c) => c.id === selectedCategory)?.name}
          </h1>
          <p className="text-dark-300 text-sm">
            {filteredProducts.length} منتج متاح
          </p>
          <div className="gold-line w-24 mx-auto mt-4" />
        </motion.div>

        {/* شريط البحث والفلترة */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 sm:mb-8 space-y-4"
        >
          {/* البحث */}
          <div className="relative">
            <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-800 border border-gold-400/10 rounded-xl pr-12 pl-4 py-3 text-white placeholder-dark-400 focus:border-gold-400/30 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* أزرار الأقسام */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-gold-400 text-dark-900'
                  : 'glass text-dark-300 hover:text-gold-400'
              }`}
            >
              الكل
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1 ${
                  selectedCategory === cat.id
                    ? 'bg-gold-400 text-dark-900'
                    : 'glass text-dark-300 hover:text-gold-400'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="hidden sm:inline">{cat.name}</span>
              </button>
            ))}

            {/* زر الترتيب */}
            <div className="mr-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="glass px-3 py-2 rounded-xl text-dark-300 hover:text-gold-400 transition-all flex items-center gap-1"
              >
                <SlidersHorizontal size={16} />
                <span className="text-xs">ترتيب</span>
              </button>
            </div>
          </div>

          {/* خيارات الترتيب */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex gap-2"
            >
              {[
                { id: 'newest' as const, label: 'الأحدث' },
                { id: 'price-low' as const, label: 'السعر: الأقل' },
                { id: 'price-high' as const, label: 'السعر: الأعلى' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => { setSortBy(option.id); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === option.id
                      ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                      : 'bg-dark-800 text-dark-400 hover:text-white border border-transparent'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* شبكة المنتجات */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-white text-xl font-bold mb-2">لا توجد منتجات</h3>
            <p className="text-dark-400 text-sm">
              {searchQuery
                ? 'لم يتم العثور على منتجات تطابق بحثك'
                : 'لا توجد منتجات في هذا القسم حالياً'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
