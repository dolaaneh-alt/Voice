import React, { useState } from 'react';
import { X, Download, FileAudio, Check, Sparkles, AlertCircle } from 'lucide-react';
import { ExportFormat } from '../types';
import { convertAndExportAudio, triggerFileDownload } from '../utils/audioExporter';

interface ExportFormatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioDataUrl: string;
  defaultTitle?: string;
  playbackSpeed?: number;
}

export const ExportFormatsModal: React.FC<ExportFormatsModalProps> = ({
  isOpen,
  onClose,
  audioDataUrl,
  defaultTitle = 'tts_voice',
  playbackSpeed = 1.0,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('wav');
  const [fileName, setFileName] = useState(defaultTitle);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const formatsList: { id: ExportFormat; extension: string; label: string; desc: string; isLossless?: boolean }[] = [
    { id: 'wav', extension: '.wav', label: 'WAV (با کیفیت بی‌نهایت - Lossless)', desc: 'فرمت استاندارد استودیویی، بدون فشرده‌سازی، مناسب تدوین ویدیو و پادکست', isLossless: true },
    { id: 'mp3', extension: '.mp3', label: 'MP3 (استاندارد محبوب)', desc: 'فرمت فشرده و سازگار با تمام گوشی‌ها، پخش‌کننده‌ها و وب‌سایت‌ها' },
    { id: 'ogg', extension: '.ogg', label: 'OGG (فرمت آزاد و وب)', desc: 'کیفیت بالا و حجم کم، مناسب استفاده در پروژه وب و بازی‌ها' },
    { id: 'webm', extension: '.webm', label: 'WebM (مخصوص مرورگر)', desc: 'بهینه‌شده برای مرورگرهای مدرن و استریم صوتی سریع' },
    { id: 'm4a', extension: '.m4a', label: 'M4A / AAC (کیفیت بالای اپل)', desc: 'فشرده‌سازی مدرن با کیفیت صدای بالا مخصوص دستگاه‌های iOS و مک' },
  ];

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      setDownloadSuccess(false);

      const { blob, downloadName } = await convertAndExportAudio(
        audioDataUrl,
        fileName.trim() || 'tts_voice',
        selectedFormat,
        playbackSpeed
      );

      triggerFileDownload(blob, downloadName);
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Export Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <FileAudio className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100">دانلود و خروجی صوتی چندفرمت</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">نام فایل خروجی:</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="مثال: my_voice_over"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">فرمت صوتی مورد نظر را انتخاب کنید:</label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {formatsList.map((fmt) => {
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`w-full text-right p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-indigo-400 bg-indigo-600' : 'border-slate-600'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">{fmt.label}</span>
                      <span className="text-xs font-mono text-indigo-400 font-semibold">{fmt.extension}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{fmt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <span>در حال تبدیل و آماده‌سازی فایل...</span>
            ) : downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>فایل دانلود شد!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>دانلود فوری ({selectedFormat.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
