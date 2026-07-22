import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import '@tensorflow/tfjs-backend-webgl';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
    this.isModelLoaded = false;
    this.loadingProgress = 0;
    this.backend = 'webgl';
    this.fpsLimit = 30;
    this.lastPredictionTime = 0;
    this.inputSize = [224, 224];
  }

  // ========== LOAD MODEL ==========
  async loadModel(modelPath = '/models/model.json') {
    try {
      // Backend Adaptive
      console.log('🔍 Checking GPU support...');
      const isWebGPUSupported = navigator.gpu !== undefined;
      
      if (isWebGPUSupported) {
        try {
          await tf.setBackend('webgpu');
          await tf.ready();
          this.backend = 'webgpu';
          console.log('✅ WebGPU backend activated');
        } catch (webgpuError) {
          console.warn('⚠️ WebGPU failed, falling back to WebGL:', webgpuError);
          await tf.setBackend('webgl');
          await tf.ready();
          this.backend = 'webgl';
        }
      } else {
        await tf.setBackend('webgl');
        await tf.ready();
        this.backend = 'webgl';
        console.log('✅ WebGL backend activated (fallback)');
      }

      // Load model
      console.log('🔄 Loading model...');
      this.loadingProgress = 0;

      this.model = await tf.loadLayersModel(
        tf.io.browserHTTPRequest(modelPath, {
          onProgress: (fraction) => {
            this.loadingProgress = Math.round(fraction * 100);
            console.log(`📦 Loading model: ${this.loadingProgress}%`);
          }
        })
      );

      // Load metadata
      console.log('📋 Loading metadata...');
      const basePath = modelPath.substring(0, modelPath.lastIndexOf('/'));
      const metadataResponse = await fetch(`${basePath}/metadata.json`);
      this.config = await metadataResponse.json();
      
      this.labels = this.config.labels || [];
      if (this.config.inputSize) {
        this.inputSize = this.config.inputSize;
      }

      this.isModelLoaded = true;
      this.loadingProgress = 100;
      
      console.log('✅ Model loaded successfully!');
      console.log(`📋 Labels (${this.labels.length}):`, this.labels);
      console.log(`⚡ Backend: ${this.backend.toUpperCase()}`);
      
      return true;

    } catch (error) {
      console.error('❌ Failed to load model:', error);
      throw new Error(`Model loading failed: ${error.message}`);
    }
  }

  // ========== PREDICT ==========
  async predict(imageElement) {
    if (!this.isModelLoaded || !this.model) {
      console.warn('⚠️ Model not loaded yet');
      return null;
    }

    // FPS Limiting
    const now = performance.now();
    const interval = 1000 / this.fpsLimit;
    if (now - this.lastPredictionTime < interval) {
      return null;
    }
    this.lastPredictionTime = now;

    try {
      // Preprocessing dengan tf.tidy()
      const inputTensor = tf.tidy(() => {
        const tensor = tf.browser.fromPixels(imageElement);
        const resized = tf.image.resizeBilinear(tensor, this.inputSize);
        const normalized = resized.div(255);
        const batched = normalized.expandDims(0);
        return batched;
      });

      // Prediction
      const predictions = this.model.predict(inputTensor);
      const data = await predictions.data();

      // Cleanup
      predictions.dispose();
      inputTensor.dispose();

      // Parse results
      const maxConfidence = Math.max(...data);
      const maxIndex = data.indexOf(maxConfidence);

      const THRESHOLD = 0.6;
      if (maxConfidence < THRESHOLD) {
        return null;
      }

      return {
        label: this.labels[maxIndex] || 'Unknown',
        confidence: maxConfidence,
        index: maxIndex,
        allPredictions: Array.from(data)
      };

    } catch (error) {
      console.error('❌ Prediction error:', error);
      return null;
    }
  }

  // ========== CHECK LOADED ==========
  isLoaded() {
    return this.isModelLoaded && this.model !== null;
  }

  // ========== GETTERS ==========
  getBackend() {
    return this.backend;
  }

  getLabels() {
    return this.labels;
  }

  getLoadingProgress() {
    return this.loadingProgress;
  }

  // ========== SETTERS ==========
  setFpsLimit(fps) {
    this.fpsLimit = Math.max(1, fps);
  }

  // ========== DISPOSE ==========
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isModelLoaded = false;
    this.labels = [];
    this.config = null;
    console.log('🧹 DetectionService disposed');
  }
}