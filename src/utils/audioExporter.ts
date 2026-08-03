import { ExportFormat } from '../types';

/**
 * Utility to decode base64 Audio Data URI to AudioBuffer
 */
export async function decodeAudioDataUrl(dataUrl: string): Promise<AudioBuffer> {
  const response = await fetch(dataUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

/**
 * Convert AudioBuffer to WAV ArrayBuffer/Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let result: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    result = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      result[i * 2] = left[i];
      result[i * 2 + 1] = right[i];
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = result.length * bytesPerSample;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataLength, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, dataLength, true);

  /* float to 16bit PCM */
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Converts AudioBuffer to different target audio formats using MediaRecorder or Blob headers
 */
export async function convertAndExportAudio(
  audioDataUrl: string,
  fileName: string,
  format: ExportFormat,
  playbackSpeed: number = 1.0
): Promise<{ blob: Blob; mimeType: string; downloadName: string }> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') || 'tts_voice';
  
  if (format === 'wav' && playbackSpeed === 1.0) {
    const response = await fetch(audioDataUrl);
    const blob = await response.blob();
    return {
      blob,
      mimeType: 'audio/wav',
      downloadName: `${cleanName}.wav`
    };
  }

  // For pitch-preserved playback speed or format conversion using WebAudio Context
  const audioBuffer = await decodeAudioDataUrl(audioDataUrl);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

  // Map requested formats to mimeTypes
  const mimeTypeMap: Record<ExportFormat, string[]> = {
    wav: ['audio/wav', 'audio/x-wav'],
    mp3: ['audio/mp3', 'audio/mpeg', 'audio/webm;codecs=opus'],
    ogg: ['audio/ogg', 'audio/webm;codecs=opus'],
    webm: ['audio/webm', 'audio/webm;codecs=opus'],
    m4a: ['audio/mp4', 'audio/aac', 'audio/webm']
  };

  const candidateMimeTypes = mimeTypeMap[format] || ['audio/webm'];
  let supportedMime = candidateMimeTypes.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));

  if (!supportedMime) {
    supportedMime = 'audio/webm';
  }

  // Offline or Live Stream recording
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = playbackSpeed;
  source.connect(dest);

  return new Promise((resolve) => {
    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(dest.stream, { mimeType: supportedMime });
    } catch {
      // Fallback
      mediaRecorder = new MediaRecorder(dest.stream);
    }

    const chunks: BlobPart[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: supportedMime || 'audio/webm' });
      resolve({
        blob: finalBlob,
        mimeType: supportedMime || 'audio/webm',
        downloadName: `${cleanName}.${format}`
      });
      audioCtx.close();
    };

    mediaRecorder.start();
    source.start(0);

    // Stop recorder when buffer playback completes
    const durationMs = (audioBuffer.duration / playbackSpeed) * 1000 + 200;
    setTimeout(() => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, durationMs);
  });
}

/**
 * Triggers browser download for a Blob
 */
export function triggerFileDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Extract audio peak waveform data for canvas rendering
 */
export function extractPeaks(audioBuffer: AudioBuffer, numPeaks = 60): number[] {
  const rawData = audioBuffer.getChannelData(0);
  const step = Math.floor(rawData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step && start + j < rawData.length; j++) {
      const datum = Math.abs(rawData[start + j]);
      if (datum > max) max = datum;
    }
    peaks.push(max);
  }

  // Normalize peaks
  const maxPeak = Math.max(...peaks, 0.01);
  return peaks.map(p => Math.max(0.1, p / maxPeak));
}
