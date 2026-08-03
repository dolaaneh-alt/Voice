import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, RefreshCw, Radio, Share2, Sparkles } from 'lucide-react';
import { decodeAudioDataUrl, extractPeaks } from '../utils/audioExporter';
import { ExportFormat } from '../types';

interface AudioPlayerSectionProps {
  audioDataUrl: string | null;
  duration: number;
  voiceUsed: string;
  toneUsed: string;
  speedUsed: string;
  originalText: string;
  onOpenExportModal: () => void;
  onSaveToHistory: () => void;
  isSaved: boolean;
}

export const AudioPlayerSection: React.FC<AudioPlayerSectionProps> = ({
  audioDataUrl,
  duration,
  voiceUsed,
  toneUsed,
  speedUsed,
  originalText,
  onOpenExportModal,
  onSaveToHistory,
  isSaved,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Initialize Audio & extract peaks
  useEffect(() => {
    if (!audioDataUrl) return;

    setIsPlaying(false);
    setCurrentTime(0);

    // Decode audio peaks for visualization
    decodeAudioDataUrl(audioDataUrl)
      .then((buffer) => {
        setTotalDuration(buffer.duration);
        const extracted = extractPeaks(buffer, 80);
        setPeaks(extracted);
      })
      .catch(() => {
        // Fallback peaks
        setPeaks(Array.from({ length: 60 }, () => Math.random() * 0.7 + 0.2));
      });
  }, [audioDataUrl]);

  // Update canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / peaks.length;
    const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

    peaks.forEach((peak, index) => {
      const barHeight = peak * (height * 0.85);
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      const isPlayed = index / peaks.length <= progress;

      // Gradient color
      if (isPlayed) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#818cf8');
        gradient.addColorStop(1, '#4f46e5');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
      }

      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(1, barWidth - 2), barHeight, [3]);
      ctx.fill();
    });
  }, [peaks, currentTime, totalDuration]);

  if (!audioDataUrl) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMute = !isMuted;
    setIsMuted(newMute);
    audioRef.current.muted = newMute;
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec)) return '00:00';
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div id="audio-player-section" className="bg-gradient-to-b from-slate-900 to-indigo-950/40 rounded-2xl border border-indigo-500/30 p-5 shadow-2xl space-y-4 animate-in fade-in duration-300">
      
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={audioDataUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
            <Radio className="w-4 h-4 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">صدای تولید شده آماده‌ی پخش و دانلود است</h3>
            <p className="text-xs text-slate-400">
              گوینده: <strong className="text-indigo-300">{voiceUsed}</strong> | لحن: <strong className="text-indigo-300">{toneUsed}</strong> | مدت: <strong className="text-indigo-300">{formatTime(totalDuration)}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons: Download & Save */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveToHistory}
            disabled={isSaved}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isSaved
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 cursor-default'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isSaved ? 'ذخیره شد' : 'ذخیره در آرشیو'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenExportModal}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>دانلود (انتخاب فرمت)</span>
          </button>
        </div>
      </div>

      {/* Waveform Canvas Visualizer */}
      <div className="relative py-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={80}
          className="w-full h-20 bg-slate-950/80 rounded-xl border border-slate-800 cursor-pointer shadow-inner"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = clickX / rect.width;
            const targetTime = pct * totalDuration;
            setCurrentTime(targetTime);
            if (audioRef.current) audioRef.current.currentTime = targetTime;
          }}
        />

        {/* Seeker Overlay Slider */}
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="w-full mt-2 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
        />
      </div>

      {/* Controls Bar: Play / Seek / Volume / Speed */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        
        {/* Play/Pause & Time */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
          </button>

          <div className="text-xs font-mono font-bold text-slate-200">
            <span>{formatTime(currentTime)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-slate-400">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 px-2">سرعت پخش:</span>
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                playbackRate === rate
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleMute} className="text-slate-400 hover:text-slate-200 transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

      </div>

    </div>
  );
};
