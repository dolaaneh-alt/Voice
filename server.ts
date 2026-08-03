import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

/**
 * Splits long text into natural paragraph/sentence chunks (max ~500 chars)
 * to prevent TTS model volume decay over long narrations.
 */
function splitTextIntoChunks(text: string, maxChunkLength = 500): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChunkLength) {
    return [trimmed];
  }

  const paragraphs = trimmed.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk ? currentChunk + "\n" + paragraph : paragraph).length <= maxChunkLength) {
      currentChunk = currentChunk ? currentChunk + "\n" + paragraph : paragraph;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (paragraph.length > maxChunkLength) {
        // Split long paragraph by sentence boundaries (. ! ? ؟)
        const sentences = paragraph.match(/[^.!?؟\n]+[.!?؟\n]*/g) || [paragraph];
        let subChunk = "";
        for (const sentence of sentences) {
          if ((subChunk ? subChunk + " " + sentence : sentence).length <= maxChunkLength) {
            subChunk = subChunk ? subChunk + " " + sentence : sentence;
          } else {
            if (subChunk) chunks.push(subChunk.trim());
            subChunk = sentence;
          }
        }
        if (subChunk) currentChunk = subChunk.trim();
        else currentChunk = "";
      } else {
        currentChunk = paragraph;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks.length > 0 ? chunks : [trimmed];
}

/**
 * Normalizes PCM audio buffer and applies Automatic Gain Control (AGC) across 1-second windows
 * to prevent volume fading or decay in long recordings.
 */
function normalizeAndEqualizePcm(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const numSamples = Math.floor(pcmBuffer.length / 2);
  if (numSamples === 0) return pcmBuffer;

  const outBuffer = Buffer.alloc(pcmBuffer.length);
  const frameSamples = sampleRate; // 1 second window
  const totalFrames = Math.ceil(numSamples / frameSamples);

  // Target peak amplitude (88% of max 16-bit range 32767 = 28834)
  const targetVal = 28834;

  const sampleGains = new Float32Array(numSamples);

  for (let f = 0; f < totalFrames; f++) {
    const startSample = f * frameSamples;
    const endSample = Math.min(startSample + frameSamples, numSamples);
    let peak = 0;
    for (let i = startSample; i < endSample; i++) {
      const val = Math.abs(pcmBuffer.readInt16LE(i * 2));
      if (val > peak) peak = val;
    }

    // Determine gain for this frame
    let frameGain = targetVal / Math.max(peak, 2500);
    if (frameGain > 3.5) frameGain = 3.5; // Cap max boost
    if (frameGain < 0.6) frameGain = 0.6; // Cap max attenuation

    for (let i = startSample; i < endSample; i++) {
      sampleGains[i] = frameGain;
    }
  }

  // Smooth the gain curve using a 100ms moving average to eliminate sudden jumps
  const smoothWindow = 2400; // ~100ms at 24kHz
  const smoothedGains = new Float32Array(numSamples);
  let runningSum = 0;

  for (let i = 0; i < numSamples; i++) {
    runningSum += sampleGains[i];
    if (i >= smoothWindow) {
      runningSum -= sampleGains[i - smoothWindow];
      smoothedGains[i - Math.floor(smoothWindow / 2)] = runningSum / smoothWindow;
    } else {
      smoothedGains[i] = sampleGains[i];
    }
  }

  // Apply smoothed gain and clamp sample bounds
  for (let i = 0; i < numSamples; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    const gain = smoothedGains[i] || 1.0;
    let scaled = Math.round(sample * gain);
    if (scaled > 32767) scaled = 32767;
    if (scaled < -32768) scaled = -32768;
    outBuffer.writeInt16LE(scaled, i * 2);
  }

  return outBuffer;
}

/**
 * Converts raw 16-bit PCM audio buffer into a valid WAV audio buffer with RIFF header.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // Subchunk 1 "fmt "
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // Subchunk 2 "data"
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Helper to extract base64 audio data from any candidate part in the Gemini response.
 */
function extractAudioFromResponse(response: any): { base64Data: string; mimeType: string } | null {
  const candidates = response?.candidates || [];
  for (const cand of candidates) {
    const parts = cand.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          base64Data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "audio/pcm",
        };
      }
      if (part.inline_data?.data) {
        return {
          base64Data: part.inline_data.data,
          mimeType: part.inline_data.mimeType || "audio/pcm",
        };
      }
    }
  }
  return null;
}

/**
 * Map all 16+ expanded voices to valid base Gemini voices (Kore, Puck, Charon, Fenrir, Zephyr)
 * while passing stylistic hints into the prompt.
 */
const BASE_VOICE_MAP: Record<string, { baseVoice: string; styleHint: string }> = {
  // ElevenLabs Voice ID Match (mEf7WY0hvNO6KqdAkUeA) - Warm, rich, articulate male narrator
  mEf7WY0hvNO6KqdAkUeA: {
    baseVoice: 'Puck',
    styleHint: 'ultra-realistic, natural ElevenLabs style voice (mEf7WY0hvNO6KqdAkUeA): warm, rich, articulate, smooth-spoken young male presenter ideal for YouTube science, psychology, and neuroscience videos'
  },

  // Special YouTuber Character Voices (Young, warm male presenter for science & psychology)
  Puck_Neuro: { baseVoice: 'Puck', styleHint: 'young, modern, warm, friendly male voice explaining neuroscience, brain mechanics and dopamine for YouTube' },
  Nima_Sci: { baseVoice: 'Puck', styleHint: 'young, articulate, warm male podcast host explaining human behavior, cognitive psychology and mental growth' },
  Kian_Tech: { baseVoice: 'Puck', styleHint: 'confident, smart, energetic young male creator breaking down complex scientific & AI concepts' },
  Pouya_Youtuber: { baseVoice: 'Puck', styleHint: 'captivating, curious, engaging young male storyteller describing psychology experiments and history of science' },

  // Standard Voices
  Kore: { baseVoice: 'Kore', styleHint: 'calm, clear female voice' },
  Puck: { baseVoice: 'Puck', styleHint: 'friendly, energetic male voice' },
  Charon: { baseVoice: 'Charon', styleHint: 'deep, authoritative male voice' },
  Fenrir: { baseVoice: 'Fenrir', styleHint: 'bold, strong male voice' },
  Zephyr: { baseVoice: 'Zephyr', styleHint: 'soft, gentle female voice' },
  Aoede: { baseVoice: 'Zephyr', styleHint: 'poetic, lyrical, elegant female voice' },
  Calliope: { baseVoice: 'Kore', styleHint: 'articulate, resonant, broadcasting female voice' },
  Leda: { baseVoice: 'Kore', styleHint: 'vibrant, cheerful, youthful female voice' },
  Mimosa: { baseVoice: 'Zephyr', styleHint: 'sweet, warm, affectionate female voice' },
  Orpheus: { baseVoice: 'Charon', styleHint: 'deep, narrative, storytelling male voice' },
  Perseus: { baseVoice: 'Fenrir', styleHint: 'heroic, confident, inspiring male voice' },
  Thalia: { baseVoice: 'Puck', styleHint: 'joyful, lively, enthusiastic voice' },
  Urania: { baseVoice: 'Kore', styleHint: 'clear, professional, academic female voice' },
  Atlas: { baseVoice: 'Charon', styleHint: 'epic, resonant, narrator male voice' },
  Echo: { baseVoice: 'Zephyr', styleHint: 'clean, balanced, modern voice' },
};

function getVoiceConfig(voiceInput: string): { baseVoice: string; styleHint: string } {
  if (BASE_VOICE_MAP[voiceInput]) {
    return BASE_VOICE_MAP[voiceInput];
  }
  // If user passes a custom ElevenLabs voice ID string (like mEf7...)
  if (voiceInput && (voiceInput.length > 15 || voiceInput.includes('mEf7') || voiceInput.includes('ElevenLabs'))) {
    return {
      baseVoice: 'Puck',
      styleHint: `natural, warm ElevenLabs model voice (${voiceInput}): articulate young male presenter for YouTube science, psychology and neuroscience`
    };
  }
  return { baseVoice: 'Puck', styleHint: 'warm, articulate, friendly voice for YouTube narration' };
}

/**
 * Helper to initialize GoogleGenAI client with custom or system API key
 */
function getGenAIClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("کلید GEMINI_API_KEY یافت نشد. لطفاً کلید API اختصاصی خود را در تنظیمات وارد کنید.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Verify API Key
app.post("/api/tts/verify-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    const ai = getGenAIClient(apiKey);
    // Quick lightweight check using a tiny generate call
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "ping",
    });
    if (response.text) {
      res.json({ success: true, message: "کلید API معتبر و فعال است." });
    } else {
      res.json({ success: false, message: "پاسخی از مدل دریافت نشد." });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "کلید API نامعتبر است." });
  }
});

// Main Text-To-Speech Endpoint
app.post("/api/tts/generate", async (req, res) => {
  try {
    const {
      text,
      voice = "Kore",
      tone = "natural",
      speed = "1.0x",
      language = "auto",
      customInstructions = "",
      apiKey = "",
      isMultiSpeaker = false,
      speakers = [],
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "متن ورودی نمی‌تواند خالی باشد." });
    }

    const ai = getGenAIClient(apiKey);

    let promptText = "";

    // Build emotional and stylistic direction for Gemini TTS
    const toneInstructionsMap: Record<string, string> = {
      natural: "natural, clear, and articulate tone",
      energetic: "enthusiastic, lively, and highly energetic tone",
      calm: "calm, soothing, relaxed, and gentle tone",
      professional: "formal, professional, articulate, and authoritative news-broadcaster tone",
      dramatic: "dramatic, expressive, emotional, and captivating narrative tone",
      storyteller: "warm, engaging, expressive storyteller tone with captivating pacing",
      cheerful: "cheerful, joyful, warm, and happy tone",
      serious: "serious, firm, clear, and composed tone",
      whisper: "soft, intimate, hushed whisper tone",
    };

    const speedInstructionMap: Record<string, string> = {
      "0.5x": "at a very slow and deliberate pacing",
      "0.75x": "at a slightly slow and relaxed pacing",
      "1.0x": "at a normal conversational pacing",
      "1.25x": "at a brisk and moderately fast pacing",
      "1.5x": "at a fast, fluent, and rapid pacing",
      "2.0x": "at a very fast and brisk pacing",
    };

    const toneDesc = toneInstructionsMap[tone] || "natural, pleasant tone";
    const speedDesc = speedInstructionMap[speed] || "normal pacing";

    let langNote = "";
    if (language === "fa") {
      langNote = "Speak in fluent, flawless, natural Persian (Farsi) language.";
    } else if (language === "en") {
      langNote = "Speak in clear, fluent English.";
    } else if (language === "ar") {
      langNote = "Speak in fluent, eloquent Arabic.";
    }

    const { baseVoice, styleHint } = getVoiceConfig(voice);
    let voiceStylePrompt = styleHint ? `Voice character style: ${styleHint}.` : "";
    const volumeDirective = "CRITICAL AUDIO DIRECTION: Maintain a consistently strong, clear, steady, and energetic vocal volume and projection from start to finish. Do NOT decrease volume, drop energy, fade out, or whisper towards the end.";

    let extraStyle = [voiceStylePrompt, volumeDirective, customInstructions.trim()].filter(Boolean).join(" ");

    if (!isMultiSpeaker) {
      // For long texts (> 500 chars), split into chunks to prevent TTS volume decay over time
      const textChunks = splitTextIntoChunks(text, 500);
      const pcmBuffers: Buffer[] = [];
      const silencePadding = Buffer.alloc(24000 * 2 * 0.2); // 200ms silence between paragraph chunks

      for (let idx = 0; idx < textChunks.length; idx++) {
        const chunkText = textChunks[idx];
        const chunkPrompt = `Say in a ${toneDesc} ${speedDesc}. ${langNote} ${extraStyle}\n\nText: ${chunkText}`;

        let response = await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: chunkPrompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: baseVoice },
              },
            },
          },
        });

        let audioPart = extractAudioFromResponse(response);

        if (!audioPart) {
          console.warn(`Chunk ${idx + 1}/${textChunks.length} retry with simple prompt...`);
          const simplePrompt = `Say in a ${toneDesc}: ${chunkText}`;
          const retryResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: simplePrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: baseVoice },
                },
              },
            },
          });
          audioPart = extractAudioFromResponse(retryResponse);
        }

        if (audioPart) {
          const rawChunkBuffer = Buffer.from(audioPart.base64Data, "base64");
          pcmBuffers.push(rawChunkBuffer);
          if (idx < textChunks.length - 1) {
            pcmBuffers.push(silencePadding);
          }
        }
      }

      if (pcmBuffers.length === 0) {
        throw new Error("هیچ داده صوتی از مدل دریافت نشد.");
      }

      const combinedRawBuffer = Buffer.concat(pcmBuffers);

      // Apply AGC and Level Normalization to maintain steady, uniform volume throughout
      const normalizedBuffer = normalizeAndEqualizePcm(combinedRawBuffer, 24000);

      // Add 44-byte WAV header (24000Hz, Mono, 16-bit PCM)
      const wavBuffer = pcmToWav(normalizedBuffer, 24000, 1, 16);
      const base64Wav = wavBuffer.toString("base64");

      // Calculate approximate duration in seconds
      const duration = (normalizedBuffer.length / (24000 * 2)).toFixed(2);

      return res.json({
        success: true,
        audioData: `data:audio/wav;base64,${base64Wav}`,
        format: "wav",
        sampleRate: 24000,
        duration: Number(duration),
        voiceUsed: voice,
        toneUsed: tone,
        speedUsed: speed,
      });
    } else {
      // Multi-speaker handling
      const rawSpeakerList = Array.isArray(speakers) && speakers.length >= 2 ? speakers : [
        { name: "Joe", voice: "Kore" },
        { name: "Jane", voice: "Puck" },
      ];

      const speakerList = rawSpeakerList.map((s: any) => {
        const vConf = getVoiceConfig(s.voice);
        return {
          name: s.name,
          baseVoice: vConf.baseVoice,
          voiceName: s.voice,
        };
      });

      const multiPrompt = `TTS the following conversation in a ${toneDesc} ${speedDesc}. ${langNote} ${extraStyle}\n\n${text.trim()}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: multiPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speakerList.map((s: any) => ({
                speaker: s.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: s.baseVoice },
                },
              })),
            },
          },
        },
      });

      const multiAudioPart = extractAudioFromResponse(response);

      if (!multiAudioPart) {
        throw new Error("هیچ داده صوتی برای گفتگوی چند نفره دریافت نشد.");
      }

      const rawBuffer = Buffer.from(multiAudioPart.base64Data, "base64");
      const normalizedBuffer = normalizeAndEqualizePcm(rawBuffer, 24000);
      const wavBuffer = pcmToWav(normalizedBuffer, 24000, 1, 16);
      const base64Wav = wavBuffer.toString("base64");
      const duration = (normalizedBuffer.length / (24000 * 2)).toFixed(2);

      return res.json({
        success: true,
        audioData: `data:audio/wav;base64,${base64Wav}`,
        format: "wav",
        sampleRate: 24000,
        duration: Number(duration),
        voiceUsed: speakerList.map((s: any) => `${s.name} (${s.voiceName})`).join(", "),
        toneUsed: tone,
        speedUsed: speed,
      });
    }
  } catch (err: any) {
    console.error("TTS Generation Error:", err);
    let errorMsg = err.message || "خطا در ساخت فایل صوتی.";

    const errStr = (typeof err === "object" ? JSON.stringify(err) : "") + " " + (err.message || "");
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || errStr.includes("quota")) {
      errorMsg = "سقف استفاده رایگان (کوتای روزانه) به پایان رسیده است. لطفاً کلید اختصاصی API Gemini خود را در بخش «تنظیمات کلید API» (بالا سمت چپ) وارد نمایید یا دقایقی دیگر مجدداً تلاش کنید.";
    } else if (errStr.includes("NOT_FOUND") || errStr.includes("404")) {
      errorMsg = "خطا در اتصال به سرویس گوینده Gemini. لطفاً دوباره تلاش کنید.";
    }

    if (!res.headersSent) {
      res.status(500).json({
        error: errorMsg,
      });
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
