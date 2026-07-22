import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config';

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
    this.loadingProgress = 0;
    
    // Konfigurasi default untuk generasi
    this.generationConfig = {
      max_new_tokens: 150,
      temperature: 0.7,
      top_p: 0.9,
      do_sample: true,
    };
    
    // Konfigurasi tone-based prompts
    this.tonePrompts = {
      normal: {
        prefix: 'Provide an interesting and informative fun fact about',
        suffix: 'Keep it factual and educational.'
      },
      funny: {
        prefix: 'Tell me a funny, entertaining, and witty fun fact about',
        suffix: 'Make it humorous and enjoyable to read!'
      },
      professional: {
        prefix: 'Provide a professional, scientific, and detailed fun fact about',
        suffix: 'Use precise terminology and maintain a formal tone.'
      },
      casual: {
        prefix: 'Give me a casual, friendly, and easy-to-read fun fact about',
        suffix: 'Keep it relaxed and conversational.'
      }
    };
  }

  // ========== LOAD MODEL ==========
  async loadModel() {
    try {
      console.log('🧠 Loading Generative AI model...');
      this.loadingProgress = 0;

      // Backend Adaptive
      console.log('🔍 Checking GPU support for Transformers.js...');
      const isWebGPUSupported = navigator.gpu !== undefined;
      
      if (isWebGPUSupported) {
        try {
          this.currentBackend = 'webgpu';
          console.log('✅ WebGPU backend available for Transformers.js');
        } catch (webgpuError) {
          console.warn('⚠️ WebGPU not available, falling back to WebGL/WASM:', webgpuError);
          this.currentBackend = 'webgl';
        }
      } else {
        this.currentBackend = 'webgl';
        console.log('✅ Using WebGL/WASM backend for Transformers.js');
      }

      // LOAD MODEL - Gunakan yang lebih ringan (77M)
      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/LaMini-Flan-T5-77M',  // ← 77M (lebih ringan dari 783M)
        {
          dtype: 'q4',
          device: this.currentBackend === 'webgpu' ? 'webgpu' : 'wasm',
          progress_callback: (progress) => {
            this.loadingProgress = Math.round(progress * 100);
            console.log(`📦 Loading Generative AI: ${this.loadingProgress}%`);
          }
        }
      );

      this.isModelLoaded = true;
      this.loadingProgress = 100;
      
      console.log('✅ Generative AI model loaded successfully!');
      console.log(`⚡ Backend: ${this.currentBackend.toUpperCase()}`);
      
      return true;

    } catch (error) {
      console.error('❌ Failed to load Generative AI model:', error);
      throw new Error(`Generative AI model loading failed: ${error.message}`);
    }
  }

  // ========== SET TONE ==========
  setTone(tone) {
    const availableTones = TONE_CONFIG.availableTones.map(t => t.value);
    if (availableTones.includes(tone)) {
      this.currentTone = tone;
      console.log(`🎵 Tone set to: ${tone}`);
      return true;
    } else {
      console.warn(`⚠️ Invalid tone: ${tone}. Using default: ${TONE_CONFIG.defaultTone}`);
      this.currentTone = TONE_CONFIG.defaultTone;
      return false;
    }
  }

  // ========== GENERATE FACTS ==========
  async generateFacts(vegetableName) {
    // ========== VALIDASI ==========
    if (!this.isModelLoaded || !this.generator) {
      console.warn('⚠️ Generative AI model not loaded yet');
      return 'Model AI belum siap. Silakan tunggu sebentar.';
    }

    if (!vegetableName || vegetableName.trim() === '') {
      console.warn('⚠️ No vegetable name provided');
      return 'Tidak ada sayuran yang terdeteksi.';
    }

    // Cegah multiple generation simultan
    if (this.isGenerating) {
      console.warn('⚠️ Generation already in progress');
      return 'Sedang menghasilkan fakta, harap tunggu...';
    }

    try {
      this.isGenerating = true;
      console.log(`🤖 Generating fun fact for: ${vegetableName} (tone: ${this.currentTone})`);

      // ========== BUILD PROMPT ==========
      const toneConfig = this.tonePrompts[this.currentTone] || this.tonePrompts.normal;
      
      // Buat prompt yang lebih terstruktur untuk hasil yang lebih baik
      const prompt = `${toneConfig.prefix} "${vegetableName}". ${toneConfig.suffix}`;
      
      console.log(`📝 Prompt: ${prompt}`);

      // ========== GENERATE ==========
      const result = await this.generator(prompt, {
        max_new_tokens: this.generationConfig.max_new_tokens,
        temperature: this.generationConfig.temperature,
        top_p: this.generationConfig.top_p,
        do_sample: this.generationConfig.do_sample,
        // Untuk model LaMini-Flan-T5
        repetition_penalty: 1.1,
        length_penalty: 1.0,
      });

      // ========== PARSE RESULT ==========
      let generatedText = '';
      if (Array.isArray(result) && result.length > 0) {
        generatedText = result[0]?.generated_text || result[0]?.text || '';
      } else if (typeof result === 'string') {
        generatedText = result;
      } else if (result && typeof result === 'object' && result.generated_text) {
        generatedText = result.generated_text;
      }

      // Clean up hasil
      generatedText = generatedText.trim();
      
      // Jika hasil kosong, berikan fallback
      if (!generatedText || generatedText.length < 10) {
        console.warn('⚠️ Generated text too short, using fallback');
        generatedText = this.getFallbackFact(vegetableName);
      }

      console.log(`✅ Fun fact generated: ${generatedText.substring(0, 60)}...`);
      
      this.isGenerating = false;
      return generatedText;

    } catch (error) {
      console.error('❌ Failed to generate facts:', error);
      this.isGenerating = false;
      
      // Fallback jika terjadi error
      return this.getFallbackFact(vegetableName);
    }
  }

  // ========== FALLBACK FACTS ==========
  getFallbackFact(vegetableName) {
    const fallbackFacts = {
      'Beetroot': 'Beetroot is rich in antioxidants and helps lower blood pressure. It also gives a natural red color to foods!',
      'Paprika': 'Paprika is made from dried and ground peppers. It\'s rich in vitamin C and adds vibrant color to dishes!',
      'Cabbage': 'Cabbage is a leafy green vegetable that has been cultivated for thousands of years. It\'s packed with vitamin K!',
      'Carrot': 'Carrots are root vegetables that are rich in beta-carotene, which converts to vitamin A in the body. They help improve eyesight!',
      'Cauliflower': 'Cauliflower is a cruciferous vegetable packed with nutrients. It contains compounds that may help fight cancer!',
      'Chilli': 'Chillies contain capsaicin, which gives them their spicy heat. They are rich in vitamin C and can boost metabolism!',
      'Corn': 'Corn is one of the most widely grown crops in the world. It\'s a good source of fiber, vitamins, and minerals!',
      'Cucumber': 'Cucumbers are 95% water and are very low in calories. They contain antioxidants that help reduce inflammation!',
      'Eggplant': 'Eggplant is a nightshade vegetable rich in fiber and antioxidants. It\'s a great meat substitute in many dishes!',
      'Garlic': 'Garlic has been used for medicinal purposes for centuries. It contains allicin, which has powerful antibacterial properties!',
      'Ginger': 'Ginger is a root spice that has anti-inflammatory properties. It\'s commonly used to treat nausea and digestive issues!',
      'Lettuce': 'Lettuce is a leafy vegetable that is very low in calories. It\'s a good source of vitamin A and K!',
      'Onion': 'Onions are bulb vegetables rich in antioxidants. They contain quercetin, which may help reduce inflammation!',
      'Peas': 'Peas are small green legumes that are rich in protein, fiber, and vitamins. They are very easy to grow!',
      'Potato': 'Potatoes are root vegetables that are high in carbohydrates. They are a good source of vitamin C and potassium!',
      'Turnip': 'Turnips are root vegetables that are high in fiber and vitamin C. Both the root and greens are edible!',
      'Soybean': 'Soybeans are legumes that are a complete protein source. They contain all essential amino acids!',
      'Spinach': 'Spinach is a leafy green vegetable rich in iron, calcium, and vitamins. Popeye was right, it makes you strong!',
    };

    // Cari fallback berdasarkan nama sayuran (case insensitive)
    const normalizedName = vegetableName.toLowerCase().trim();
    for (const [key, fact] of Object.entries(fallbackFacts)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        return fact;
      }
    }

    // Fallback default jika tidak ditemukan
    return `Did you know that ${vegetableName} is a nutritious vegetable packed with vitamins and minerals! It's a great addition to a healthy diet. 🥗`;
  }

  // ========== CHECK READY ==========
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }

  // ========== GETTERS ==========
  getBackend() {
    return this.currentBackend;
  }

  getLoadingProgress() {
    return this.loadingProgress;
  }

  getCurrentTone() {
    return this.currentTone;
  }

  getGenerationConfig() {
    return { ...this.generationConfig };
  }

  // ========== SETTERS ==========
  setGenerationConfig(config) {
    this.generationConfig = {
      ...this.generationConfig,
      ...config
    };
    console.log('⚙️ Generation config updated:', this.generationConfig);
  }

  setMaxNewTokens(maxTokens) {
    if (maxTokens && maxTokens > 0 && maxTokens <= 500) {
      this.generationConfig.max_new_tokens = maxTokens;
      console.log(`⚙️ Max new tokens set to: ${maxTokens}`);
    }
  }

  setTemperature(temp) {
    if (temp && temp >= 0 && temp <= 2) {
      this.generationConfig.temperature = temp;
      console.log(`⚙️ Temperature set to: ${temp}`);
    }
  }

  // ========== DISPOSE ==========
  dispose() {
    this.generator = null;
    this.isModelLoaded = false;
    this.config = null;
    console.log('🧹 RootFactsService disposed');
  }
}