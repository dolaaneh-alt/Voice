export type VoiceName = string;

export type ToneType = 
  | 'natural' 
  | 'energetic' 
  | 'calm' 
  | 'professional' 
  | 'dramatic' 
  | 'storyteller' 
  | 'cheerful' 
  | 'serious' 
  | 'whisper';

export type SpeedPreset = '0.5x' | '0.75x' | '1.0x' | '1.25x' | '1.5x' | '2.0x';

export type ExportFormat = 'wav' | 'mp3' | 'ogg' | 'webm' | 'm4a';

export interface VoiceOption {
  id: VoiceName;
  name: string;
  persianName: string;
  gender: 'زن' | 'مرد';
  character: string;
  toneDescription: string;
  sampleText: string;
}

export interface SpeakerConfig {
  name: string;
  voice: VoiceName;
}

export interface TTSRequestOptions {
  text: string;
  voice: VoiceName;
  tone: ToneType;
  speed: SpeedPreset;
  language: string;
  customInstructions: string;
  apiKey?: string;
  isMultiSpeaker?: boolean;
  speakers?: SpeakerConfig[];
}

export interface TTSResponseData {
  success: boolean;
  audioData: string; // Data URL (data:audio/wav;base64,...)
  format: string;
  sampleRate: number;
  duration: number;
  voiceUsed: string;
  toneUsed: string;
  speedUsed: string;
  error?: string;
}

export interface SavedAudioItem {
  id: string;
  title: string;
  text: string;
  audioData: string;
  createdAt: string;
  duration: number;
  voice: string;
  tone: ToneType;
  speed: SpeedPreset;
  format: ExportFormat;
}
