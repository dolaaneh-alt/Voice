import React, { useState } from 'react';
import { Type, Trash2, Clipboard, Sparkles, Users, MessageSquare, Play, RotateCcw } from 'lucide-react';
import { SAMPLE_TEXTS, VOICE_OPTIONS } from '../data/voices';
import { SpeakerConfig, VoiceName } from '../types';

interface TextInputSectionProps {
  text: string;
  setText: (val: string) => void;
  isMultiSpeaker: boolean;
  setIsMultiSpeaker: (val: boolean) => void;
  speakers: SpeakerConfig[];
  setSpeakers: React.Dispatch<React.SetStateAction<SpeakerConfig[]>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const TextInputSection: React.FC<TextInputSectionProps> = ({
  text,
  setText,
  isMultiSpeaker,
  setIsMultiSpeaker,
  speakers,
  setSpeakers,
  onGenerate,
  isGenerating,
}) => {
  const [showSamplesDropdown, setShowSamplesDropdown] = useState(false);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(text ? `${text}\n${clipboardText}` : clipboardText);
      }
    } catch {
      // Fallback
    }
  };

  const handleClear = () => {
    setText('');
  };

  const handleSelectSample = (sampleText: string) => {
    setText(sampleText);
    setShowSamplesDropdown(false);
  };

  const handleUpdateSpeaker = (index: number, field: 'name' | 'voice', value: string) => {
    setSpeakers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  return (
    <div id="text-input-section" className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
      
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-slate-100">متن ورودی گویندگی</h2>
        </div>

        {/* Multi-speaker Toggle */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setIsMultiSpeaker(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !isMultiSpeaker
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            تک گوینده (تک‌صدا)
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMultiSpeaker(true);
              if (!text.trim()) {
                const multiSample = SAMPLE_TEXTS.find((s) => s.category === 'چند گوینده');
                if (multiSample) setText(multiSample.text);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isMultiSpeaker
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            گفتگوی چندصدایی (دیالوگ)
          </button>
        </div>
      </div>

      {/* Multi Speaker Setup Box */}
      {isMultiSpeaker && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-300 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              تنظیم گویندگان مکالمه (در متن نام هر گوینده را قبل از : بنویسید)
            </span>
            {speakers.length < 6 && (
              <button
                type="button"
                onClick={() => {
                  const availableVoices = VOICE_OPTIONS.map(v => v.id);
                  const nextVoice = availableVoices[speakers.length % availableVoices.length];
                  setSpeakers(prev => [...prev, { name: `Speaker ${prev.length + 1}`, voice: nextVoice }]);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
              >
                + افزودن گوینده جدید
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {speakers.map((spk, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                <input
                  type="text"
                  value={spk.name}
                  onChange={(e) => handleUpdateSpeaker(idx, 'name', e.target.value)}
                  placeholder={`نام گوینده ${idx + 1}`}
                  className="w-28 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={spk.voice}
                  onChange={(e) => handleUpdateSpeaker(idx, 'voice', e.target.value as VoiceName)}
                  className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.persianName}
                    </option>
                  ))}
                </select>
                {speakers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSpeakers(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="حذف این گوینده"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Textarea Area */}
      <div className="relative">
        <textarea
          id="tts-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isMultiSpeaker
              ? 'مثال گفتگوی چندصدایی:\nJoe: سلام جین، حالتون چطوره؟\nJane: سلام جو! ممنون، همه‌چیز عالیه.'
              : 'متن خود را اینجا تایپ یا پیست کنید... (پشتیبانی کامل از زبان فارسی و انگلیسی)'
          }
          dir="auto"
          rows={6}
          className="w-full p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm sm:text-base leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y min-h-[140px]"
        />

        {/* Quick Utility Tools inside bottom of text box */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
          
          {/* Word / Char Counters */}
          <div className="flex items-center gap-3">
            <span>تعداد کاراکتر: <strong className="text-slate-200">{charCount}</strong></span>
            <span>|</span>
            <span>تعداد کلمات: <strong className="text-slate-200">{wordCount}</strong></span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            
            {/* Sample Texts Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSamplesDropdown(!showSamplesDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                متن‌های نمونه
              </button>

              {showSamplesDropdown && (
                <div className="absolute right-0 bottom-full mb-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1 max-h-64 overflow-y-auto">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                    انتخاب یک متن آماده:
                  </div>
                  {SAMPLE_TEXTS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSample(sample.text)}
                      className="w-full text-right px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-xs transition-colors flex flex-col gap-0.5"
                    >
                      <span className="font-semibold text-indigo-300">{sample.title}</span>
                      <span className="text-[11px] text-slate-400 truncate">{sample.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Paste */}
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              title="جایگذاری از کلیپ‌بورد"
            >
              <Clipboard className="w-3.5 h-3.5 text-slate-400" />
              پیست
            </button>

            {/* Clear */}
            {text && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs font-medium transition-colors"
                title="پاکسازی متن"
              >
                <Trash2 className="w-3.5 h-3.5" />
                پاک کردن
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Main Generate Button */}
      <div className="pt-2">
        <button
          id="btn-generate-speech"
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !text.trim()}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] ${
            isGenerating || !text.trim()
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30'
          }`}
        >
          {isGenerating ? (
            <>
              <RotateCcw className="w-5 h-5 animate-spin text-indigo-200" />
              <span>در حال تولید فایل صوتی با هوش مصنوعی...</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-white" />
              <span>تبدیل متن به صدا با هوش مصنوعی (Gemini TTS)</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
