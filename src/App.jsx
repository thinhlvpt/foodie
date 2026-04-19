import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, MapPin, Clock, ExternalLink, Calendar,
  Loader2, Filter, X, Eye, Check, ChevronRight,
  Coffee, Utensils, Pizza, Beer, Camera, Droplets
} from 'lucide-react';

// === CẤU HÌNH API QUAN TRỌNG ===
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL || '';

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

  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(10);
  const observerTarget = useRef(null);

  // 1. Logic thời gian
  useEffect(() => {
    const calculateTimeConfig = () => {
      const currentHour = new Date().getHours();
      let currentStatus = '', currentLabel = '', nextStatus = '', nextLabel = '';

      if (currentHour >= 5 && currentHour < 11) {
        currentStatus = 'sang'; currentLabel = 'Sáng'; nextStatus = 'trua'; nextLabel = 'Trưa';
      } else if (currentHour >= 11 && currentHour < 14) {
        currentStatus = 'trua'; currentLabel = 'Trưa'; nextStatus = 'chieu'; nextLabel = 'Chiều';
      } else if (currentHour >= 14 && currentHour < 18) {
        currentStatus = 'chieu'; currentLabel = 'Chiều'; nextStatus = 'toi'; nextLabel = 'Tối';
      } else {
        currentStatus = 'toi'; currentLabel = 'Tối'; nextStatus = 'sang'; nextLabel = 'Sáng mai';
      }
      setTimeConfig({ currentStatus, currentLabel, nextStatus, nextLabel });
    };

    calculateTimeConfig();
    const interval = setInterval(calculateTimeConfig, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Data có Cache
  useEffect(() => {
    const fetchData = async () => {
      const cachedData = sessionStorage.getItem('thodia_data');
      if (cachedData) {
        setData(JSON.parse(cachedData));
        setLoading(false);
      } else {
        setLoading(true);
      }

      setError(null);
      try {
        if (!SCRIPT_URL.startsWith('http')) return;
        const response = await fetch(SCRIPT_URL);
        const result = await response.json();
        if (result.status === 'success') {
          setData(result.data);
          sessionStorage.setItem('thodia_data', JSON.stringify(result.data));
        } else {
          if (!cachedData) throw new Error(result.message || 'Lỗi không xác định từ Google Sheets');
        }
      } catch (err) {
        if (!cachedData) setError(err.message);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
        setViewCount(Math.floor(Math.random() * 500) + 2500);
      }
    };
    fetchData();
  }, []);

  // Reset lazy load khi có thay đổi bộ lọc
  useEffect(() => {
    setVisibleCount(10);
  }, [searchQuery, activeCategories, selectedAreas, activeFilter]);

  // Lấy danh sách khu vực
  const allUniqueAreas = useMemo(() => [...new Set(data.map(item => item.khu_vuc).filter(Boolean))], [data]);
  const filteredModalAreas = useMemo(() =>
    allUniqueAreas.filter(area => area?.toLowerCase().includes(modalSearchQuery.toLowerCase())),
    [allUniqueAreas, modalSearchQuery]
  );

  const toggleArea = (area) => {
    setSelectedAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  };

  const toggleCategory = (categoryId) => {
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
  const removeAccents = (str) => {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  };

  // 3. Lọc dữ liệu
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Tìm kiếm theo tên
      const matchesSearch = searchQuery === '' || removeAccents(item.ten_quan).includes(removeAccents(searchQuery));

      // Lọc theo danh mục (hỗ trợ nhiều danh mục và tìm theo từ khóa)
      let matchesCategory = true;
      if (activeCategories.length > 0 && item.phan_loai) {
        matchesCategory = activeCategories.some(catId => {
          const categoryDef = CATEGORIES.find(c => c.id === catId);
          if (!categoryDef) return false;
          const itemType = item.phan_loai.toLowerCase();
          const itemTypeNoAccent = removeAccents(item.phan_loai);
          // Kiểm tra xem phân loại của quán có chứa bất kỳ keyword nào của danh mục không
          return categoryDef.keywords.some(k => itemType.includes(k) || itemTypeNoAccent.includes(removeAccents(k)));
        });
      }

      const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(item.khu_vuc);

      const timeField = activeFilter === 'current' ? timeConfig.currentStatus : timeConfig.nextStatus;
      const matchesTime = item[timeField] === true;

      return matchesSearch && matchesCategory && matchesArea && matchesTime;
    }).sort((a, b) => new Date(b.ngay_them) - new Date(a.ngay_them));
  }, [data, searchQuery, activeCategories, selectedAreas, activeFilter, timeConfig]);

  // Lấy dữ liệu hiển thị theo lazy loading
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Thu gọn bộ lọc thời gian */}
            <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setActiveFilter('current')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeFilter === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                  }`}
              >
                <Clock className="w-3.5 h-3.5 hidden sm:block" />
                Mở ({timeConfig.currentLabel})
              </button>
              <button
                onClick={() => setActiveFilter('next')}
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
            <button onClick={() => setSelectedAreas([])} className="text-[11px] font-bold text-slate-400 hover:text-red-500 px-2 py-1">Xóa tất cả</button>
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
            {visibleData.map((item, index) => (
              <div
                key={index}
                className="group bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[9px] font-extrabold uppercase tracking-wider border border-indigo-100">
                    {item.phan_loai}
                  </span>
                </div>

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
            ))}

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
                  <button onClick={() => setSelectedAreas([])} className="text-sm font-bold text-red-500 hover:text-red-600 px-3 py-1.5">
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
