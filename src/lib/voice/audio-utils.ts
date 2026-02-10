/**
 * Convert Float32Array audio data to Int16 PCM
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

/**
 * Convert Int16 PCM to Float32Array for Web Audio API
 */
export function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32Array;
}

/**
 * Downsample audio from source sample rate to target sample rate
 */
export function downsampleBuffer(
  buffer: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) return buffer;
  if (sourceSampleRate < targetSampleRate) {
    throw new Error("Source sample rate must be greater than target");
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Calculate volume from audio data (RMS)
 */
export function calculateVolume(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length) * 255;
}

/**
 * Play audio buffer through Web Audio API
 */
export function playAudioBuffer(
  audioContext: AudioContext,
  audioData: ArrayBuffer,
  sampleRate: number = 16000,
  onVolumeChange?: (volume: number) => void,
  onEnd?: () => void
): { stop: () => void } {
  const audioBuffer = audioContext.createBuffer(1, audioData.byteLength / 2, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const view = new DataView(audioData);

  for (let i = 0; i < channelData.length; i++) {
    channelData[i] = view.getInt16(i * 2, true) / 32768;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  if (onVolumeChange) {
    const dataArray = new Float32Array(analyser.frequencyBinCount);
    const monitorInterval = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);
      onVolumeChange(calculateVolume(dataArray));
    }, 50);

    source.onended = () => {
      clearInterval(monitorInterval);
      onVolumeChange(0);
      onEnd?.();
    };
  } else {
    source.onended = () => onEnd?.();
  }

  source.start();

  return {
    stop: () => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    },
  };
}
