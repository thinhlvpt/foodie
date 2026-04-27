import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, MapPin, Clock, ExternalLink, Calendar,
  Loader2, Filter, X, Eye, Check, ChevronRight,
  Coffee, Utensils, Pizza, Beer, Camera, Droplets
} from 'lucide-react';

// === CẤU HÌNH API QUAN TRỌNG ===
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || '';
const VISIT_GUARD_KEY = '__thodia_visit_sent__';

// === CẤU HÌNH TÊN WEB ===
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Foodie Local';

// === CẤU HÌNH DANH MỤC ===
const CATEGORIES = [
  { id: 'an-no', label: 'Ăn no / Quán ăn', keywords: ['ăn no', 'quán ăn', 'anno', 'quanan'], icon: <Pizza className="w-4 h-4" /> },
  { id: 'an-vat', label: 'Ăn vặt', keywords: ['ăn vặt', 'anvat', 'an vat'], icon: <Droplets className="w-4 h-4" /> },
  { id: 'cafe', label: 'Cafe & Trà', keywords: ['cafe', 'cà phê', 'trà', 'tra'], icon: <Coffee className="w-4 h-4" /> },
  { id: 'giai-khat', label: 'Giải khát', keywords: ['giải khát', 'giaikhat', 'nước'], icon: <Coffee className="w-4 h-4" /> },
  { id: 'quan-nhau', label: 'Quán nhậu / Bar', keywords: ['nhậu', 'nhau', 'bar', 'pub'], icon: <Beer className="w-4 h-4" /> },
  { id: 'checkin', label: 'Địa điểm Check-in', keywords: ['check-in', 'checkin', 'check in', 'địa điểm'], icon: <Camera className="w-4 h-4" /> },
];

const SPONSOR_TIER_WEIGHTS = {
  0: 1,
  1: 2,
  2: 4,
  3: 8,
  4: 20,
};

const TIME_FIELD_ALIASES = {
  sang: ['sang'],
  trua: ['trua'],
  chieu: ['chieu'],
  toi: ['toi'],
  khuya: ['khuya', 'rangsang', 'khuyarangsang'],
};

const TIME_SLOTS = ['khuya', 'sang', 'trua', 'chieu', 'toi'];

function removeAccents(str) {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
}

function normalizeKey(str) {
  return removeAccents(str || '').replace(/[^a-z0-9]/g, '');
}

function splitCategoryValues(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,;/]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseSponsorTier(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(0, Math.round(numeric));
}

function parseBoostScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return numeric;
}

function getTierWeight(tier) {
  const normalizedTier = parseSponsorTier(tier);
  if (SPONSOR_TIER_WEIGHTS[normalizedTier]) return SPONSOR_TIER_WEIGHTS[normalizedTier];
  return SPONSOR_TIER_WEIGHTS[4] + (normalizedTier - 4) * 4;
}

function getMerchantWeight(item) {
  const tierWeight = getTierWeight(item.sponsor_tier);
  const boostScore = parseBoostScore(item.boost_score);
  return Math.max(0.0001, tierWeight * boostScore);
}

function hashToUnitInterval(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positiveHash = hash >>> 0;
  return (positiveHash + 1) / 4294967297;
}

function doesCategoryValueMatch(categoryValue, categoryDef) {
  if (!categoryValue || !categoryDef) return false;
  const categoryLower = String(categoryValue).toLowerCase();
  const categoryNoAccent = removeAccents(categoryValue);
  return categoryDef.keywords.some(keyword =>
    categoryLower.includes(keyword) || categoryNoAccent.includes(removeAccents(keyword))
  );
}

function getItemCategoryValues(item) {
  if (Array.isArray(item.__categoryValues) && item.__categoryValues.length > 0) {
    return item.__categoryValues;
  }
  return splitCategoryValues(item.phan_loai);
}

function isTruthyTimeValue(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalizedValue = removeAccents(value).trim();
    return ['true', '1', 'yes', 'y', 'x', 'co'].includes(normalizedValue);
  }
  return false;
}

function isOpenInSingleRow(row, slot) {
  const aliases = TIME_FIELD_ALIASES[slot] || [slot];

  return Object.entries(row).some(([key, value]) => {
    const normalized = normalizeKey(key);
    return aliases.includes(normalized) && isTruthyTimeValue(value);
  });
}

function isOpenInTimeSlot(item, slot) {
  const rows = Array.isArray(item.__rows) && item.__rows.length > 0 ? item.__rows : [item];
  return rows.some(row => isOpenInSingleRow(row, slot));
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]); // Mảng chứa các danh mục đã chọn

  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [viewCount, setViewCount] = useState(0);

  const [timeConfig, setTimeConfig] = useState({
    currentStatus: 'sang', currentLabel: 'Sáng', nextStatus: 'trua', nextLabel: 'Trưa'
  });
  const [activeFilter, setActiveFilter] = useState('current');
  const [shuffleSeed, setShuffleSeed] = useState(() => Date.now());

  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(10);
  const observerTarget = useRef(null);

  // 1. Logic thời gian
  useEffect(() => {
    const calculateTimeConfig = () => {
      const currentHour = new Date().getHours();
      let currentStatus = '', currentLabel = '', nextStatus = '', nextLabel = '';

      if (currentHour >= 0 && currentHour < 5) {
        currentStatus = 'khuya'; currentLabel = 'Khuya'; nextStatus = 'sang'; nextLabel = 'Sáng';
      } else if (currentHour >= 5 && currentHour < 11) {
        currentStatus = 'sang'; currentLabel = 'Sáng'; nextStatus = 'trua'; nextLabel = 'Trưa';
      } else if (currentHour >= 11 && currentHour < 14) {
        currentStatus = 'trua'; currentLabel = 'Trưa'; nextStatus = 'chieu'; nextLabel = 'Chiều';
      } else if (currentHour >= 14 && currentHour < 18) {
        currentStatus = 'chieu'; currentLabel = 'Chiều'; nextStatus = 'toi'; nextLabel = 'Tối';
      } else {
        currentStatus = 'toi'; currentLabel = 'Tối'; nextStatus = 'khuya'; nextLabel = 'Khuya';
      }
      setTimeConfig({ currentStatus, currentLabel, nextStatus, nextLabel });
    };

    calculateTimeConfig();
    const interval = setInterval(calculateTimeConfig, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Data có Cache
  useEffect(() => {
    const parseViewCount = (payload) => {
      if (!payload || typeof payload !== 'object') return null;
      const rawCount = payload.viewCount ?? payload.view_count ?? payload.views ?? payload.totalViews;
      const numericCount = Number(rawCount);
      return Number.isFinite(numericCount) ? numericCount : null;
    };

    const buildScriptUrl = (action) => {
      const url = new URL(SCRIPT_URL);
      if (action) url.searchParams.set('action', action);
      return url.toString();
    };

    const shouldTrackVisit = () => {
      if (typeof window === 'undefined') return false;
      if (window[VISIT_GUARD_KEY]) return false;
      window[VISIT_GUARD_KEY] = true;
      return true;
    };

    const incrementVisitCount = async () => {
      if (!SCRIPT_URL.startsWith('http') || !shouldTrackVisit()) return null;
      try {
        const response = await fetch(buildScriptUrl('visit'));
        const result = await response.json();
        const count = parseViewCount(result);
        if (count !== null) {
          setViewCount(count);
          sessionStorage.setItem('thodia_view_count', String(count));
        }
        return count;
      } catch (err) {
        console.error('Visit tracking error:', err);
        return null;
      }
    };

    const fetchData = async () => {
      const cachedData = sessionStorage.getItem('thodia_data');
      const cachedViewCount = sessionStorage.getItem('thodia_view_count');
      if (cachedData) {
        setData(JSON.parse(cachedData));
        setLoading(false);
      } else {
        setLoading(true);
      }
      if (cachedViewCount) {
        const parsedCachedCount = Number(cachedViewCount);
        if (Number.isFinite(parsedCachedCount)) {
          setViewCount(parsedCachedCount);
        }
      }

      setError(null);
      try {
        if (!SCRIPT_URL.startsWith('http')) return;
        const response = await fetch(SCRIPT_URL);
        const result = await response.json();
        if (result.status === 'success') {
          setData(result.data);
          sessionStorage.setItem('thodia_data', JSON.stringify(result.data));

          const countFromData = parseViewCount(result);
          if (countFromData !== null) {
            setViewCount(countFromData);
            sessionStorage.setItem('thodia_view_count', String(countFromData));
          }
        } else {
          if (!cachedData) throw new Error(result.message || 'Lỗi không xác định từ Google Sheets');
        }
      } catch (err) {
        if (!cachedData) setError(err.message);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
        await incrementVisitCount();
      }
    };
    fetchData();
  }, []);

  // Lấy danh sách khu vực
  const toggleArea = (area) => {
    setVisibleCount(10);
    setSelectedAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const toggleCategory = (categoryId) => {
    setVisibleCount(10);
    setShuffleSeed(prev => prev + 1);
    if (categoryId === 'all') {
      setActiveCategories([]);
    } else {
      setActiveCategories(prev => prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]);
    }
  };

  const getRelativeTime = (dateString) => {
    if (!dateString) return "Chưa cập nhật";
    const updatedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    updatedDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - updatedDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Hôm nay";
    if (diffDays === 1) return "Hôm qua";
    return `${diffDays} ngày trước`;
  };

  // Hàm loại bỏ dấu tiếng Việt để tìm kiếm
  const hasSearchQuery = searchQuery.trim() !== '';

  const getDisplayCategory = (item) => {
    const categories = getItemCategoryValues(item);
    if (categories.length === 0) return item.phan_loai || 'Khac';
    if (activeCategories.length === 0) return categories[0];

    const matchedCategory = categories.find(categoryValue =>
      activeCategories.some(catId => {
        const categoryDef = CATEGORIES.find(category => category.id === catId);
        return doesCategoryValueMatch(categoryValue, categoryDef);
      })
    );

    return matchedCategory || categories[0];
  };

  const getAvailabilityMeta = (item) => {
    const selectedTimeField = activeFilter === 'current' ? timeConfig.currentStatus : timeConfig.nextStatus;
    const isInSelectedTimeWindow = isOpenInTimeSlot(item, selectedTimeField);

    if (isInSelectedTimeWindow) {
      return { isInSelectedTimeWindow: true, statusLabel: '' };
    }

    if (activeFilter === 'next') {
      return { isInSelectedTimeWindow: false, statusLabel: 'Chưa tới giờ mở' };
    }

    const currentSlotIndex = TIME_SLOTS.indexOf(timeConfig.currentStatus);
    const openSlotIndexes = TIME_SLOTS
      .filter(slot => isOpenInTimeSlot(item, slot))
      .map(slot => TIME_SLOTS.indexOf(slot));

    if (openSlotIndexes.length === 0) {
      return { isInSelectedTimeWindow: false, statusLabel: 'Đã đóng cửa' };
    }

    const hasUpcomingSlotToday = openSlotIndexes.some(index => index > currentSlotIndex);

    return {
      isInSelectedTimeWindow: false,
      statusLabel: hasUpcomingSlotToday ? 'Chưa tới giờ mở' : 'Đã đóng cửa',
    };
  };

  // 3. Lọc dữ liệu
  const groupedData = useMemo(() => {
    const merchantMap = new Map();

    data.forEach((row, index) => {
      const merchantId = String(row.merchant_id ?? row.quan_id ?? '').trim();
      const fallbackName = normalizeKey(row.ten_quan || row.ten || '');
      const fallbackArea = normalizeKey(row.khu_vuc || '');
      const fallbackLink = normalizeKey(row.link || '');
      const fallbackKeyRaw = [fallbackName, fallbackArea, fallbackLink].filter(Boolean).join('__');
      const merchantKey = merchantId ? `id:${merchantId}` : `fallback:${fallbackKeyRaw || `row_${index}`}`;

      if (!merchantMap.has(merchantKey)) {
        merchantMap.set(merchantKey, {
          key: merchantKey,
          representative: row,
          rows: [],
          categories: new Set(),
          areas: new Set(),
          sponsorTier: 0,
          boostScore: 1,
        });
      }

      const merchant = merchantMap.get(merchantKey);
      merchant.rows.push(row);

      splitCategoryValues(row.phan_loai).forEach(value => merchant.categories.add(value));
      if (row.khu_vuc) merchant.areas.add(row.khu_vuc);

      merchant.sponsorTier = Math.max(
        merchant.sponsorTier,
        parseSponsorTier(row.sponsor_tier ?? row.ad_tier ?? row.paid_tier)
      );
      merchant.boostScore = Math.max(
        merchant.boostScore,
        parseBoostScore(row.boost_score ?? row.display_rate ?? row.weight_score)
      );
    });

    return Array.from(merchantMap.values()).map(merchant => ({
      ...merchant.representative,
      __merchantKey: merchant.key,
      __rows: merchant.rows,
      __categoryValues: merchant.categories.size > 0
        ? Array.from(merchant.categories)
        : splitCategoryValues(merchant.representative.phan_loai),
      __areas: merchant.areas.size > 0
        ? Array.from(merchant.areas)
        : [merchant.representative.khu_vuc].filter(Boolean),
      sponsor_tier: merchant.sponsorTier,
      boost_score: merchant.boostScore,
    }));
  }, [data]);

  const allUniqueAreas = useMemo(() => {
    const allAreas = groupedData.flatMap(item => item.__areas || []);
    return [...new Set(allAreas.filter(Boolean))];
  }, [groupedData]);

  const filteredModalAreas = useMemo(() =>
    allUniqueAreas.filter(area => area?.toLowerCase().includes(modalSearchQuery.toLowerCase())),
    [allUniqueAreas, modalSearchQuery]
  );

  // 3. Loc du lieu
  const filteredData = useMemo(() => {
    const timeField = activeFilter === 'current' ? timeConfig.currentStatus : timeConfig.nextStatus;

    const filtered = groupedData.filter(item => {
      const matchesSearch = searchQuery === '' || removeAccents(item.ten_quan).includes(removeAccents(searchQuery));

      let matchesCategory = true;
      if (activeCategories.length > 0) {
        const itemCategories = getItemCategoryValues(item);
        matchesCategory = activeCategories.some(catId => {
          const categoryDef = CATEGORIES.find(c => c.id === catId);
          if (!categoryDef) return false;
          return itemCategories.some(categoryValue => doesCategoryValueMatch(categoryValue, categoryDef));
        });
      }

      const itemAreas = Array.isArray(item.__areas) ? item.__areas : [item.khu_vuc].filter(Boolean);
      const matchesArea = selectedAreas.length === 0 || itemAreas.some(area => selectedAreas.includes(area));
      const matchesTime = isOpenInTimeSlot(item, timeField);

      return matchesSearch && matchesCategory && matchesArea && (hasSearchQuery || matchesTime);
    });

    return [...filtered].sort((a, b) => {
      const aKey = `${shuffleSeed}|${a.__merchantKey || normalizeKey(a.ten_quan || '')}`;
      const bKey = `${shuffleSeed}|${b.__merchantKey || normalizeKey(b.ten_quan || '')}`;

      const aRandom = Math.max(hashToUnitInterval(aKey), Number.EPSILON);
      const bRandom = Math.max(hashToUnitInterval(bKey), Number.EPSILON);
      const aWeight = getMerchantWeight(a);
      const bWeight = getMerchantWeight(b);

      const aPriorityKey = -Math.log(aRandom) / aWeight;
      const bPriorityKey = -Math.log(bRandom) / bWeight;

      return aPriorityKey - bPriorityKey;
    });
  }, [groupedData, searchQuery, activeCategories, selectedAreas, activeFilter, timeConfig, hasSearchQuery, shuffleSeed]);

  // Lay du lieu hien thi theo lazy loading
  const visibleData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);

  // 4. Observer cho Lazy Loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < filteredData.length) {
          setVisibleCount(prev => prev + 10);
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredData.length]);

  return (
    <div className="min-h-screen bg-pattern text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">

      {/* Header & Sticky Area - Thu gọn */}
      <header className="bg-white/95 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2">

          {/* Dòng 1: Logo & Area Selector */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                <Utensils className="text-white w-4 h-4" />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-800">
                {APP_NAME}
              </h1>
            </div>

            <button
              onClick={() => setIsAreaModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-bold transition-all active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
              <span>{selectedAreas.length === 0 ? 'Toàn khu vực' : `${selectedAreas.length} Khu vực`}</span>
            </button>
          </div>

          {/* Dòng 2: Search & Giờ mở cửa */}
          <div className="flex gap-2 mb-3">
            <div className="relative group flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Tìm tên quán..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-slate-700 text-sm font-medium"
                value={searchQuery}
                onChange={(e) => {
                  setVisibleCount(10);
                  setSearchQuery(e.target.value);
                }}
              />
            </div>

            {/* Thu gọn bộ lọc thời gian */}
            <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => {
                  setVisibleCount(10);
                  setActiveFilter('current');
                  setShuffleSeed(prev => prev + 1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeFilter === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                  }`}
              >
                <Clock className="w-3.5 h-3.5 hidden sm:block" />
                Mở ({timeConfig.currentLabel})
              </button>
              <button
                onClick={() => {
                  setVisibleCount(10);
                  setActiveFilter('next');
                  setShuffleSeed(prev => prev + 1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeFilter === 'next' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                  }`}
              >
                Sắp mở
              </button>
            </div>
          </div>

          {/* Dòng 3: Tab danh mục có scrollbar mỏng */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map((cat) => {
              const isSelected = cat.id === 'all' ? activeCategories.length === 0 : activeCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 border ${isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Selected Areas Chips */}
        {selectedAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedAreas.map((area, i) => (
              <button
                key={i}
                onClick={() => toggleArea(area)}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                {area}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button onClick={() => {
              setVisibleCount(10);
              setSelectedAreas([]);
            }} className="text-[11px] font-bold text-slate-400 hover:text-red-500 px-2 py-1">Xóa tất cả</button>
          </div>
        )}

        {/* Thông báo lỗi */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-3">
            <X className="w-5 h-5 bg-red-100 p-1 rounded-full" />
            {error}
          </div>
        )}

        {/* List Section */}
        {loading && !data.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="font-medium text-sm animate-pulse">Đang tải dữ liệu...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleData.map((item, index) => {
              const availability = getAvailabilityMeta(item);
              const isDimmedBySearch = hasSearchQuery && !availability.isInSelectedTimeWindow;

              return (
              <div
                key={item.__merchantKey || `${item.ten_quan}-${index}`}
                className={`group bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full ${isDimmedBySearch ? 'bg-slate-50 border-slate-300/70' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-extrabold uppercase tracking-wider border border-indigo-100">
                    {getDisplayCategory(item)}
                  </span>
                  {isDimmedBySearch && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[9px] font-extrabold uppercase tracking-wider border border-amber-300 shadow-sm">
                      {availability.statusLabel}
                    </span>
                  )}
                </div>

                <div className={isDimmedBySearch ? 'opacity-55' : ''}>
                  <h2 className="text-lg font-extrabold text-slate-800 leading-tight mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {item.ten_quan}
                  </h2>

                  <div className="flex-1 flex flex-col justify-end gap-2 mb-4">
                    <div className="flex items-center text-slate-500 text-[13px] font-medium">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-indigo-400 shrink-0" />
                      <span className="line-clamp-1">{item.khu_vuc}</span>
                    </div>
                    <div className="flex items-center text-slate-400 text-[10px] font-bold uppercase tracking-wide">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300 shrink-0" />
                      Cập nhật {getRelativeTime(item.ngay_them)}
                    </div>
                  </div>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-4 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-sm active:scale-95 mt-auto"
                  >
                    Chi tiết
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )})}

            {/* Lazy load observer target */}
            {visibleCount < filteredData.length && (
              <div ref={observerTarget} className="col-span-full py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 mb-1">Không tìm thấy quán nào</h3>
            <p className="text-slate-500 text-sm px-10">Hãy thử đổi khu vực hoặc chọn khung giờ khác nhé!</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-8 text-center border-t border-slate-200/60 mt-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm mb-3">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-600">{viewCount.toLocaleString()} lượt xem</span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium">© 2026 {APP_NAME}. Made for Food Lovers.</p>
      </footer>

      {/* Area Modal */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsAreaModalOpen(false)}></div>

          <div className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Chọn khu vực</h3>
              <div className="flex items-center gap-2">
                {selectedAreas.length > 0 && (
                  <button onClick={() => {
                    setVisibleCount(10);
                    setSelectedAreas([]);
                  }} className="text-sm font-bold text-red-500 hover:text-red-600 px-3 py-1.5">
                    Xóa chọn
                  </button>
                )}
                <button onClick={() => setIsAreaModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm quận, huyện..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {filteredModalAreas.length > 0 ? (
                filteredModalAreas.map((area, idx) => {
                  const isSelected = selectedAreas.includes(area);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleArea(area)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'
                        }`}
                    >
                      <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700' : ''}`}>
                        {area}
                      </span>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'
                        }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm font-medium">Không tìm thấy khu vực nào</div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white">
              <button
                onClick={() => setIsAreaModalOpen(false)}
                className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Xác nhận {selectedAreas.length > 0 ? `(${selectedAreas.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}} />
    </div>
  );
}



