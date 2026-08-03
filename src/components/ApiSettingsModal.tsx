import React, { useState } from 'react';
import { X, Key, CheckCircle2, AlertCircle, ShieldCheck, Trash2, ExternalLink } from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  const [inputKey, setInputKey] = useState(apiKey);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!inputKey.trim()) {
      setVerifyStatus({ type: 'error', message: 'لطفاً ابتدا کلید API را تایپ یا پیست کنید.' });
      return;
    }

    try {
      setIsVerifying(true);
      setVerifyStatus({ type: null, message: '' });

      const res = await fetch('/api/tts/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: inputKey.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setVerifyStatus({ type: 'success', message: 'کلید API شما معتبر است و آماده استفاده می‌باشد.' });
      } else {
        setVerifyStatus({ type: 'error', message: data.error || 'کلید API وارد شده نامعتبر است.' });
      }
    } catch (err: any) {
      setVerifyStatus({ type: 'error', message: 'خطا در ارتباط با سرور جهت بررسی کلید.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    onClose();
  };

  const handleClearKey = () => {
    setInputKey('');
    onSaveApiKey('');
    setVerifyStatus({ type: 'success', message: 'کلید اختصاصی پاک شد؛ از کلید پیش‌فرض سیستم استفاده خواهد شد.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100">تنظیمات کلید API اختصاصی Gemini</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs text-slate-300">
          <p className="leading-relaxed">
            برنامه به‌صورت پیش‌فرض از کلید سیستم استفاده می‌کند. در صورت تمایل یا داشتن سقف درخواست مجزا، می‌توانید کلید اختصاصی <strong>Gemini API Key</strong> خود را اینجا وارد کنید.
          </p>
          <div className="flex items-center gap-1.5 text-indigo-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>کلید شما فقط در مرورگر ذخیره شده و به هیچ سرور ثانویه‌ای ارسال نمی‌شود.</span>
          </div>
        </div>

        {/* Key Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">وارد کردن کلید GEMINI_API_KEY:</label>
          <div className="relative">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Verification Alert status */}
        {verifyStatus.message && (
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
            verifyStatus.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {verifyStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{verifyStatus.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isVerifying || !inputKey.trim()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
            >
              {isVerifying ? 'در حال تست...' : 'بررسی اعتبار کلید'}
            </button>

            {apiKey && (
              <button
                type="button"
                onClick={handleClearKey}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1"
                title="حذف کلید اختصاصی"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف کلید
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-lg shadow-emerald-600/20"
            >
              ذخیره کلید
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
