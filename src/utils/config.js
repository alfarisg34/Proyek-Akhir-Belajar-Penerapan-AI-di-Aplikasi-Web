export const APP_CONFIG = {
  detectionConfidenceThreshold: 90,  // 90% minimum
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
  // ========== KONFIGURASI CAPTURE ==========
  stableDetectionCount: 3,           // Jumlah deteksi stabil sebelum capture
  captureConfidenceThreshold: 0.7,   // Minimal confidence untuk capture
};

export const TONE_CONFIG = {
  availableTones: [
    { value: 'normal', label: 'Normal' },
    { value: 'funny', label: 'Lucu' },
    { value: 'professional', label: 'Profesional' },
    { value: 'casual', label: 'Santai' }
  ],
  defaultTone: 'normal'
};

export const isValidDetection = (result) => {
  const { detectionConfidenceThreshold } = APP_CONFIG;
  return result && result.isValid && result.confidence >= detectionConfidenceThreshold;
};
