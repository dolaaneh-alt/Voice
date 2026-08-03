import React from 'react';
import { SlidersHorizontal, UserCheck, Sparkles, Gauge, Languages, MessageSquareCode, Volume2 } from 'lucide-react';
import { VOICE_OPTIONS, TONE_OPTIONS, SPEED_PRESETS } from '../data/voices';
import { VoiceName, ToneType, SpeedPreset } from '../types';

interface VoiceSettingsSectionProps {
  selectedVoice: VoiceName;
  setSelectedVoice: (voice: VoiceName) => void;
  selectedTone: ToneType;
  setSelectedTone: (tone: ToneType) => void;
  selectedSpeed: SpeedPreset;
  setSelectedSpeed: (speed: SpeedPreset) => void;
  language: string;
  setLanguage: (lang: string) => void;
  customInstructions: string;
  setCustomInstructions: (inst: string) => void;
  isMultiSpeaker: boolean;
}

export const VoiceSettingsSection: React.FC<VoiceSettingsSectionProps> = ({
  selectedVoice,
  setSelectedVoice,
  selectedTone,
  setSelectedTone,
  selectedSpeed,
  setSelectedSpeed,
  language,
  setLanguage,
  customInstructions,
  setCustomInstructions,
  isMultiSpeaker,
}) => {
  const [genderFilter, setGenderFilter] = React.useState<'all' | 'زن' | 'مرد'>('all');

  const filteredVoices = VOICE_OPTIONS.filter((v) => {
    if (genderFilter === 'all') return true;
    return v.gender === genderFilter;
  });

  return (
    <div id="voice-settings-section" className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-6">
      
      {/* Title */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-semibold text-slate-100">تنظیمات تخصصی صدا و لحن گفتار</h2>
      </div>

      {/* 1. Voice Selector Cards (Only if not multi-speaker) */}
      {!isMultiSpeaker && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              انتخاب گوینده ({VOICE_OPTIONS.length} گوینده متنوع):
            </label>

            {/* Gender Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setGenderFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  genderFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                همه ({VOICE_OPTIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('زن')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  genderFilter === 'زن'
                    ? 'bg-pink-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                گویندگان زن ({VOICE_OPTIONS.filter(v => v.gender === 'زن').length})
              </button>
              <button
                type="button"
                onClick={() => setGenderFilter('مرد')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  genderFilter === 'مرد'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                گویندگان مرد ({VOICE_OPTIONS.filter(v => v.gender === 'مرد').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {filteredVoices.map((v) => {
              const isSelected = selectedVoice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVoice(v.id)}
                  className={`p-3 rounded-xl text-right transition-all flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-100">{v.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        v.gender === 'زن' ? 'bg-pink-500/15 text-pink-300 border border-pink-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                      }`}>
                        {v.gender}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-indigo-300 mb-1">{v.character}</p>
                    <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">{v.toneDescription}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Tone & Emotion Selector */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            لحن و احساس گفتار (Tone & Emotion):
          </span>
          <span className="text-slate-400 font-normal">لحن فعلی: <strong className="text-indigo-300">{TONE_OPTIONS.find(t => t.id === selectedTone)?.title}</strong></span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {TONE_OPTIONS.map((tone) => {
            const isSelected = selectedTone === tone.id;
            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => setSelectedTone(tone.id)}
                className={`p-2.5 rounded-xl text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="text-xs font-semibold truncate w-full">{tone.title}</span>
                <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'} truncate w-full`}>
                  {tone.description.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Speed & Language Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Speed Selector */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-indigo-400" />
              سرعت گفتار (Speech Pace):
            </span>
            <span className="text-indigo-300 font-bold text-xs">{selectedSpeed}</span>
          </label>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
            {SPEED_PRESETS.map((sp) => {
              const isSelected = selectedSpeed === sp.value;
              return (
                <button
                  key={sp.value}
                  type="button"
                  onClick={() => setSelectedSpeed(sp.value)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {sp.value}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-indigo-400" />
              زبان متن (Language Guidance):
            </span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { id: 'fa', label: 'فارسی (Persian)' },
              { id: 'en', label: 'انگلیسی (English)' },
              { id: 'ar', label: 'عربی (Arabic)' },
              { id: 'auto', label: 'تشخیص خودکار' }
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  language === lang.id
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 4. Custom Speech Instructions (Advanced Tuning) */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <MessageSquareCode className="w-4 h-4 text-indigo-400" />
          دستورالعمل سفارشی لحن و تلفظ (Advanced Style Prompting):
        </label>
        <input
          type="text"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="مثال: با شتاب کمتر، مکث بین جملات بلندتر، تلفظ کلمات با لهجه گویندگان رادیویی..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-all"
        />
      </div>

    </div>
  );
};
