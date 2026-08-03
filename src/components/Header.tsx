import React from 'react';
import { Volume2, Key, History, Sparkles, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
  onOpenApiModal: () => void;
  onToggleHistory: () => void;
  historyCount: number;
  hasCustomApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenApiModal,
  onToggleHistory,
  historyCount,
  hasCustomApiKey,
}) => {
  return (
    <header id="app-header" className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                استودیو گویندگی Gemini TTS
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                هوش مصنوعی Gemini
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              تبدیل هوشمند متن به صدای طبیعی با تنظیم لحن، سرعت و خروجی چندفرمت
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* History Button */}
          <button
            id="btn-toggle-history"
            onClick={onToggleHistory}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-sm font-medium border border-slate-700 transition-all active:scale-95"
            title="تاریخچه فایل‌های صوتی ساخته شده"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">تاریخچه</span>
            {historyCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* API Key Modal Button */}
          <button
            id="btn-open-api-modal"
            onClick={onOpenApiModal}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all active:scale-95 ${
              hasCustomApiKey
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700'
            }`}
            title="وارد کردن کلید اختصاصی API"
          >
            <Key className={`w-4 h-4 ${hasCustomApiKey ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {hasCustomApiKey ? 'کلید API اختصاصی' : 'تنظیمات API'}
            </span>
            {hasCustomApiKey && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
