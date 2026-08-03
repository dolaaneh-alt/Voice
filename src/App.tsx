import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TextInputSection } from './components/TextInputSection';
import { VoiceSettingsSection } from './components/VoiceSettingsSection';
import { AudioPlayerSection } from './components/AudioPlayerSection';
import { ExportFormatsModal } from './components/ExportFormatsModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { HistorySection } from './components/HistorySection';
import { VoiceName, ToneType, SpeedPreset, SpeakerConfig, SavedAudioItem, TTSResponseData } from './types';
import { Sparkles, AlertTriangle, ShieldCheck, Headphones, CheckCircle2, Volume2, Globe, Key } from 'lucide-react';

export default function App() {
  // Main TTS Form State
  const [text, setText] = useState<string>(
    'سلام! به استودیوی هوشمند تبدیل متن به گفتار خوش آمدید. با این ابزار می‌توانید هر متنی را به صدای طبیعی و دلنشین تبدیل کنید.'
  );
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [selectedTone, setSelectedTone] = useState<ToneType>('natural');
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedPreset>('1.0x');
  const [language, setLanguage] = useState<string>('fa');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Multi Speaker Dialogue state
  const [isMultiSpeaker, setIsMultiSpeaker] = useState<boolean>(false);
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([
    { name: 'Joe', voice: 'Kore' },
    { name: 'Jane', voice: 'Puck' },
  ]);

  // API Key & Modals State
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Audio Result State
  const [audioResult, setAudioResult] = useState<TTSResponseData | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History State
  const [historyList, setHistoryList] = useState<SavedAudioItem[]>([]);
  const [isCurrentAudioSaved, setIsCurrentAudioSaved] = useState<boolean>(false);

  // Load custom API key and History from localStorage on mount
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('gemini_custom_tts_api_key');
      if (savedKey) setCustomApiKey(savedKey);

      const savedHistory = localStorage.getItem('gemini_tts_history_v1');
      if (savedHistory) setHistoryList(JSON.parse(savedHistory));
    } catch {
      // Ignore local storage errors
    }
  }, []);

  // Save API key
  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem('gemini_custom_tts_api_key', key);
    } else {
      localStorage.removeItem('gemini_custom_tts_api_key');
    }
  };

  // Generate TTS Audio Call
  const handleGenerateSpeech = async () => {
    if (!text.trim()) {
      setErrorMsg('لطفاً ابتدا متنی برای تبدیل به صدا وارد کنید.');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMsg(null);
      setIsCurrentAudioSaved(false);

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          tone: selectedTone,
          speed: selectedSpeed,
          language,
          customInstructions,
          apiKey: customApiKey,
          isMultiSpeaker,
          speakers,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('پاسخ نامعتبر از سرور دریافت شد. لطفاً دوباره تلاش کنید.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'خطا در تولید وویس. لطفاً دوباره تلاش کنید.');
      }

      setAudioResult(data);

      // Auto scroll to player section
      setTimeout(() => {
        const playerElement = document.getElementById('audio-player-section');
        if (playerElement) {
          playerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } catch (err: any) {
      console.error('Error generating TTS:', err);
      let msg = err.message || 'مشکلی در برقراری ارتباط با سرور پیش آمد.';
      if (err.name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('fetch')) {
        msg = 'ارتباط با سرور صوتی برقرار نشد یا قطع شد. لطفاً مجدداً دکمه ساخت وویس را فشار دهید.';
      }
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Current Audio Result to Local History
  const handleSaveToHistory = () => {
    if (!audioResult || isCurrentAudioSaved) return;

    const newItem: SavedAudioItem = {
      id: `tts_${Date.now()}`,
      title: text.trim().slice(0, 45) + (text.length > 45 ? '...' : ''),
      text: text.trim(),
      audioData: audioResult.audioData,
      createdAt: new Date().toISOString(),
      duration: audioResult.duration,
      voice: audioResult.voiceUsed,
      tone: selectedTone,
      speed: selectedSpeed,
      format: 'wav',
    };

    const updated = [newItem, ...historyList].slice(0, 30); // max 30 items
    setHistoryList(updated);
    setIsCurrentAudioSaved(true);

    try {
      localStorage.setItem('gemini_tts_history_v1', JSON.stringify(updated));
    } catch {
      // Storage quota exception fallback
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updated = historyList.filter((item) => item.id !== id);
    setHistoryList(updated);
    try {
      localStorage.setItem('gemini_tts_history_v1', JSON.stringify(updated));
    } catch {}
  };

  const handleClearAllHistory = () => {
    setHistoryList([]);
    localStorage.removeItem('gemini_tts_history_v1');
  };

  const handlePlayHistoryItem = (item: SavedAudioItem) => {
    setAudioResult({
      success: true,
      audioData: item.audioData,
      format: item.format,
      sampleRate: 24000,
      duration: item.duration,
      voiceUsed: item.voice,
      toneUsed: item.tone,
      speedUsed: item.speed,
    });
    setText(item.text);
    setIsHistoryOpen(false);
    setIsCurrentAudioSaved(true);

    setTimeout(() => {
      const playerElement = document.getElementById('audio-player-section');
      if (playerElement) {
        playerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-16">
      
      {/* App Navigation Bar */}
      <Header
        onOpenApiModal={() => setIsApiModalOpen(true)}
        onToggleHistory={() => setIsHistoryOpen(true)}
        historyCount={historyList.length}
        hasCustomApiKey={Boolean(customApiKey)}
      />

      {/* Hero Banner Intro */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              تولید صدای هوشمند نسل جدید با Gemini 3.1 TTS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              متن خود را به وویس باکیفیت، طبیعی و احساسی تبدیل کنید
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              با قابلیت تنظیم دقیق گوینده، سرعت گفتار، لحن و احساس، زبان، و دانلود مستقیم در فرمت‌های صوتی MP3 ،WAV ،OGG ،WebM و M4A.
            </p>
          </div>
          {/* Subtle Ambient Glow */}
          <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-2">
        
        {/* Error Notification Toast */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm leading-relaxed">
                <strong className="font-bold block mb-0.5">خطا در فرآیند گویندگی:</strong>
                {errorMsg}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {(errorMsg.includes('کوتا') || errorMsg.includes('API') || errorMsg.includes('کلید')) && (
                <button
                  onClick={() => setIsApiModalOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-colors flex items-center gap-1 shadow-lg shadow-indigo-600/20"
                >
                  <Key className="w-3.5 h-3.5" />
                  تنظیم کلید API اختصاصی
                </button>
              )}
              <button
                onClick={() => setErrorMsg(null)}
                className="text-xs font-medium px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-300 transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        )}

        {/* Text Input Section */}
        <TextInputSection
          text={text}
          setText={setText}
          isMultiSpeaker={isMultiSpeaker}
          setIsMultiSpeaker={setIsMultiSpeaker}
          speakers={speakers}
          setSpeakers={setSpeakers}
          onGenerate={handleGenerateSpeech}
          isGenerating={isGenerating}
        />

        {/* Audio Player Section (Rendered when Audio is ready) */}
        {audioResult && audioResult.audioData && (
          <AudioPlayerSection
            audioDataUrl={audioResult.audioData}
            duration={audioResult.duration}
            voiceUsed={audioResult.voiceUsed}
            toneUsed={selectedTone}
            speedUsed={selectedSpeed}
            originalText={text}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onSaveToHistory={handleSaveToHistory}
            isSaved={isCurrentAudioSaved}
          />
        )}

        {/* Voice & Tone Customization Settings */}
        <VoiceSettingsSection
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          selectedTone={selectedTone}
          setSelectedTone={setSelectedTone}
          selectedSpeed={selectedSpeed}
          setSelectedSpeed={setSelectedSpeed}
          language={language}
          setLanguage={setLanguage}
          customInstructions={customInstructions}
          setCustomInstructions={setCustomInstructions}
          isMultiSpeaker={isMultiSpeaker}
        />

      </main>

      {/* Modals */}
      <ApiSettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiKey={customApiKey}
        onSaveApiKey={handleSaveApiKey}
      />

      {audioResult?.audioData && (
        <ExportFormatsModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          audioDataUrl={audioResult.audioData}
          defaultTitle={text.trim().slice(0, 20)}
          playbackSpeed={parseFloat(selectedSpeed) || 1.0}
        />
      )}

      <HistorySection
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyList={historyList}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearAllHistory={handleClearAllHistory}
        onSelectHistoryItemToPlay={handlePlayHistoryItem}
        onOpenExportModalForHistory={(item) => {
          setAudioResult({
            success: true,
            audioData: item.audioData,
            format: item.format,
            sampleRate: 24000,
            duration: item.duration,
            voiceUsed: item.voice,
            toneUsed: item.tone,
            speedUsed: item.speed,
          });
          setIsExportModalOpen(true);
        }}
      />

    </div>
  );
}
