import React, { useState } from 'react';
import { History, Play, Pause, Trash2, Download, Search, FileAudio, Calendar, Volume2, Sparkles, X } from 'lucide-react';
import { SavedAudioItem, ExportFormat } from '../types';

interface HistorySectionProps {
  isOpen: boolean;
  onClose: () => void;
  historyList: SavedAudioItem[];
  onDeleteHistoryItem: (id: string) => void;
  onClearAllHistory: () => void;
  onSelectHistoryItemToPlay: (item: SavedAudioItem) => void;
  onOpenExportModalForHistory: (item: SavedAudioItem) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  isOpen,
  onClose,
  historyList,
  onDeleteHistoryItem,
  onClearAllHistory,
  onSelectHistoryItemToPlay,
  onOpenExportModalForHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredHistory = historyList.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.voice.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">تاریخچه فایل‌های صوتی ذخیره‌شده</h3>
              <p className="text-xs text-slate-400">آرشیو گفتگوها و ویس‌های ساخته‌شده با هوش مصنوعی</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {historyList.length > 0 && (
              <button
                type="button"
                onClick={onClearAllHistory}
                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                پاکسازی همه
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {historyList.length > 0 && (
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در متن یا گوینده..."
              className="w-full pr-9 pl-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {historyList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <FileAudio className="w-10 h-10 mx-auto text-slate-700" />
              <p className="text-sm font-medium text-slate-400">هنوز هیچ وویسی در آرشیو ذخیره نشده است.</p>
              <p className="text-xs text-slate-500">پس از تولید ویس، روی دکمه «ذخیره در آرشیو» کلیک کنید.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              هیچ آیتمی با عبارت مورد نظر یافت نشد.
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/30 transition-all space-y-3"
              >
                {/* Title & Date */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 line-clamp-1">{item.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>گوینده: <strong className="text-indigo-300">{item.voice}</strong></span>
                      <span>•</span>
                      <span>لحن: <strong className="text-indigo-300">{item.tone}</strong></span>
                      <span>•</span>
                      <span>مدت: <strong className="text-indigo-300">{item.duration} ثانیه</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectHistoryItemToPlay(item)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>پخش</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenExportModalForHistory(item)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      title="دانلود با فرمت دلخواه"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteHistoryItem(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
                      title="حذف از تاریخچه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Text Preview */}
                <div className="p-2.5 rounded-lg bg-slate-900 text-xs text-slate-300 leading-relaxed line-clamp-2 border border-slate-800/50">
                  {item.text}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
