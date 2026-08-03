import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

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

    let extraStyle = [voiceStylePrompt, customInstructions.trim()].filter(Boolean).join(" ");

    if (!isMultiSpeaker) {
      promptText = `Say in a ${toneDesc} ${speedDesc}. ${langNote} ${extraStyle}\n\nText: ${text.trim()}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: baseVoice },
            },
          },
        },
      });

      // Extract audio data by searching all parts in candidates
      let audioPart = extractAudioFromResponse(response);

      // Fallback attempt if gemini-3.1-flash-tts-preview didn't return audio
      if (!audioPart) {
        console.warn("gemini-3.1-flash-tts-preview did not return audio part. Retrying with direct prompt...");
        // Simplify prompt to direct text for TTS
        const simplePrompt = `Say in a ${toneDesc}: ${text.trim()}`;
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

      if (!audioPart) {
        // Collect any text parts returned for debugging
        const textParts = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean) || [];
        const textMsg = textParts.length > 0 ? ` (مدل این متن را پاسخ داد: "${textParts.join(' ')}")` : '';
        throw new Error(`هیچ داده صوتی از مدل دریافت نشد.${textMsg}`);
      }

      const rawBuffer = Buffer.from(audioPart.base64Data, "base64");
      // Add 44-byte WAV header (24000Hz, Mono, 16-bit PCM)
      const wavBuffer = pcmToWav(rawBuffer, 24000, 1, 16);
      const base64Wav = wavBuffer.toString("base64");

      // Calculate approximate duration in seconds
      const duration = (rawBuffer.length / (24000 * 2)).toFixed(2);

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
      const wavBuffer = pcmToWav(rawBuffer, 24000, 1, 16);
      const base64Wav = wavBuffer.toString("base64");
      const duration = (rawBuffer.length / (24000 * 2)).toFixed(2);

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
