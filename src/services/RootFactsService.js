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
    
    // ========== KONFIGURASI OPTIMAL ==========
    this.generationConfig = {
      max_new_tokens: 60,      // DIPERKECIL (sebelumnya 150)
      temperature: 0.6,        // DITURUNKAN untuk hasil lebih konsisten
      top_p: 0.85,             // DITURUNKAN sedikit
      do_sample: true,
      repetition_penalty: 1.2,
      length_penalty: 1.0,
    };
    
    // Tone config tetap sama
    this.tonePrompts = {
      normal: {
        prefix: 'Generate one short and interesting fun fact about',
        suffix: 'Output only the fun fact. Do not mention other objects.'
      },
      funny: {
        prefix: 'Generate one short and funny fun fact about',
        suffix: 'Make it humorous but still factual. Do not mention other objects.'
      },
      professional: {
        prefix: 'Generate one short and scientifically accurate fun fact about',
        suffix: 'Use precise terminology. Do not mention other objects.'
      },
      casual: {
        prefix: 'Generate one short and casual fun fact about',
        suffix: 'Keep it friendly and easy to read. Do not mention other objects.'
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

      // ========== BUILD PROMPT YANG LEBIH SPESIFIK ==========
      const toneConfig = this.tonePrompts[this.currentTone] || this.tonePrompts.normal;
      
      // Prompt yang sangat spesifik untuk menghindari fakta tidak relevan
      const prompt = `Generate one short, interesting, and specific fun fact about "${vegetableName}". 
  The fun fact must be directly related to "${vegetableName}" and must NOT mention or describe any other vegetable, fruit, food, person, place, or unrelated topic. 
  Output only the fun fact in one short sentence.`;

      console.log(`📝 Prompt: ${prompt}`);

      // ========== GENERATE DENGAN PARAMETER OPTIMAL ==========
      const result = await this.generator(prompt, {
        max_new_tokens: 60,  // DIPERKECIL untuk kecepatan (sebelumnya 150)
        temperature: 0.6,    // DITURUNKAN untuk hasil lebih konsisten (sebelumnya 0.7)
        top_p: 0.85,         // DITURUNKAN sedikit (sebelumnya 0.9)
        do_sample: true,
        repetition_penalty: 1.2,  // DITINGKATKAN untuk mengurangi pengulangan
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
      
      // ========== VALIDASI HASIL ==========
      // Cek apakah hasil mengandung nama objek lain yang tidak relevan
      const irrelevantKeywords = ['chilli', 'pepper', 'tomato', 'potato', 'carrot', 'cabbage', 
                                'broccoli', 'spinach', 'onion', 'garlic', 'cucumber', 'corn',
                                'mountain', 'climber', 'person', 'people', 'country', 'city'];
      
      const lowerText = generatedText.toLowerCase();
      const vegetableLower = vegetableName.toLowerCase();
      
      // Cek apakah hasil mengandung kata yang tidak relevan
      const hasIrrelevantContent = irrelevantKeywords.some(keyword => {
        // Jangan flag jika keyword adalah bagian dari nama sayuran itu sendiri
        if (vegetableLower.includes(keyword) || keyword.includes(vegetableLower)) {
          return false;
        }
        return lowerText.includes(keyword);
      });

      // Jika hasil tidak mengandung nama sayuran atau mengandung konten tidak relevan
      if (!lowerText.includes(vegetableLower) || hasIrrelevantContent) {
        console.warn(`⚠️ Generated fact seems irrelevant, using fallback for: ${vegetableName}`);
        console.warn(`   Generated: ${generatedText}`);
        this.isGenerating = false;
        return this.getFallbackFact(vegetableName);
      }

      // Jika hasil terlalu pendek atau terlalu panjang
      if (generatedText.length < 15 || generatedText.length > 200) {
        console.warn(`⚠️ Generated fact too short/long, using fallback for: ${vegetableName}`);
        this.isGenerating = false;
        return this.getFallbackFact(vegetableName);
      }

      console.log(`✅ Fun fact generated: ${generatedText.substring(0, 60)}...`);
      
      this.isGenerating = false;
      return generatedText;

    } catch (error) {
      console.error('❌ Failed to generate facts:', error);
      this.isGenerating = false;
      return this.getFallbackFact(vegetableName);
    }
  }

  // ========== FALLBACK FACTS (Lebih Spesifik & Menarik) ==========
  getFallbackFact(vegetableName) {
    const fallbackFacts = {
      'Beetroot': 'Beetroot gets its deep red color from betalains, a natural pigment that also acts as a powerful antioxidant!',
      'Paprika': 'Paprika is made from dried and ground bell peppers or chili peppers. The spice can range from sweet to hot!',
      'Cabbage': 'Cabbage contains high levels of vitamin K and C. One cup of cabbage has about 85% of your daily vitamin K needs!',
      'Carrot': 'Carrots were originally purple or white, not orange! The orange carrot was developed in the Netherlands in the 17th century.',
      'Cauliflower': 'Cauliflower comes in four colors: white, orange, purple, and green. Each color has different nutritional benefits!',
      'Chilli': 'The heat of chili peppers is measured in Scoville Heat Units. The Carolina Reaper is currently the hottest at 2.2 million SHU!',
      'Corn': 'Corn is actually a grain, not a vegetable! It was first domesticated by indigenous peoples in Mexico over 10,000 years ago.',
      'Cucumber': 'Cucumbers are 95% water and belong to the same family as pumpkins, squash, and melons (Cucurbitaceae)!',
      'Eggplant': 'Eggplant is technically a berry, not a vegetable! It belongs to the nightshade family, along with tomatoes and potatoes.',
      'Garlic': 'Garlic contains a compound called allicin, which gives it its pungent smell. Allicin has powerful antibacterial properties!',
      'Ginger': 'Ginger is a rhizome, not a root! It has been used for over 5,000 years in traditional medicine for nausea and inflammation.',
      'Lettuce': 'Lettuce is 95% water and can be grown hydroponically. It was first cultivated by the ancient Egyptians 4,500 years ago!',
      'Onion': 'Onions contain quercetin, a powerful antioxidant that may help reduce blood pressure and fight inflammation.',
      'Peas': 'Peas are legumes that fix nitrogen in the soil, making them great for crop rotation and improving soil health!',
      'Potato': 'The potato was first domesticated in the Andes mountains of South America over 7,000 years ago. There are over 4,000 varieties!',
      'Turnip': 'Both the root and the leaves of turnips are edible. The leaves are rich in calcium, iron, and vitamin C!',
      'Soybean': 'Soybeans are a complete protein, meaning they contain all nine essential amino acids that humans need from food!',
      'Spinach': 'Spinach is rich in iron, calcium, and vitamins A, C, and K. It was made famous by Popeye the Sailor in the 1930s!',
    };

    // Cari fallback berdasarkan nama sayuran (case insensitive)
    const normalizedName = vegetableName.toLowerCase().trim();
    
    // Cek exact match dulu
    for (const [key, fact] of Object.entries(fallbackFacts)) {
      if (normalizedName === key.toLowerCase()) {
        return fact;
      }
    }
    
    // Cek partial match
    for (const [key, fact] of Object.entries(fallbackFacts)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        return fact;
      }
    }

    // Fallback default dengan nama sayuran yang valid
    return `🌱 ${vegetableName} is a nutritious plant that provides essential vitamins and minerals for a healthy diet. Try adding it to your meals today!`;
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