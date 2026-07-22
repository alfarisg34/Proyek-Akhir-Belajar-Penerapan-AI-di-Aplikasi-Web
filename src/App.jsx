import { useRef, useState, useEffect } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { CameraService } from './services/CameraService';
import { DetectionService } from './services/DetectionService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG } from './utils/config';

function App() {
  const { state, actions } = useAppState();
  
  // ========== REFS ==========
  const detectionServiceRef = useRef(null);
  const cameraServiceRef = useRef(null);
  const rootFactsServiceRef = useRef(null);
  const detectionLoopRef = useRef(null);
  const isRunningRef = useRef(false);
  const lastDetectedLabelRef = useRef(null);
  
  // ========== STATE ==========
  const [currentTone, setCurrentTone] = useState('normal');
  const [copySuccess, setCopySuccess] = useState(false);

  // ========== INISIALISASI SERVICES ==========
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('🚀 Initializing services...');
        actions.setModelStatus('Memuat Model AI...');

        // 1. Inisialisasi DetectionService
        const detectionService = new DetectionService();
        detectionServiceRef.current = detectionService;

        // 2. Inisialisasi CameraService
        const cameraService = new CameraService();
        cameraServiceRef.current = cameraService;

        // 3. Inisialisasi RootFactsService
        const rootFactsService = new RootFactsService();
        rootFactsServiceRef.current = rootFactsService;

        // 4. Update state dengan services
        actions.setServices({
          detection: detectionService,
          camera: cameraService,
          generator: rootFactsService
        });

        // 5. Load Detection Model (PATH: /model/ TUNGGAL)
        actions.setModelStatus('Memuat Model Deteksi...');
        await detectionService.loadModel('/model/model.json');
        console.log('✅ Detection model loaded');

        // 6. Load Generative AI Model
        actions.setModelStatus('Memuat Model AI Generatif...');
        await rootFactsService.loadModel();
        console.log('✅ Generative AI model loaded');

        // 7. Load daftar kamera
        actions.setModelStatus('Memuat Daftar Kamera...');
        await cameraService.loadCameras();
        console.log('✅ Cameras loaded');

        // 8. Selesai
        actions.setModelStatus('Model AI Siap');
        console.log('✅ All services initialized successfully!');

      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        actions.setError(`Gagal memuat layanan: ${error.message}`);
        actions.setModelStatus('Gagal Memuat Model');
      }
    };

    initializeServices();

    // ========== CLEANUP ==========
    return () => {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
      if (cameraServiceRef.current) {
        cameraServiceRef.current.stopCamera();
      }
      if (detectionServiceRef.current) {
        detectionServiceRef.current.dispose();
      }
      if (rootFactsServiceRef.current) {
        rootFactsServiceRef.current.dispose();
      }
      console.log('🧹 App cleaned up');
    };
  }, []); // Empty dependency array = run once on mount

  // ========== FUNGSI DETEKSI LOOP ==========
  const startDetectionLoop = () => {
    const videoElement = cameraServiceRef.current?.getVideoElement();
    const detectionService = detectionServiceRef.current;
    
    if (!videoElement || !detectionService) {
      console.warn('⚠️ Cannot start detection: video or detection service not ready');
      return;
    }

    console.log('🔄 Starting detection loop...');

    const detect = async () => {
      try {
        if (!isRunningRef.current) {
          console.log('🛑 Detection loop stopped');
          return;
        }

        if (videoElement.readyState < 2 || videoElement.videoWidth === 0) {
          detectionLoopRef.current = requestAnimationFrame(detect);
          return;
        }

        const result = await detectionService.predict(videoElement);

        if (result) {
          // Update state deteksi
          actions.setDetectionResult({
            className: result.label,
            score: result.confidence,
            isValid: result.confidence >= (APP_CONFIG.detectionConfidenceThreshold / 100)
          });

          // Cek apakah sayuran berbeda dari deteksi sebelumnya
          const currentLabel = result.label;
          if (lastDetectedLabelRef.current !== currentLabel) {
            lastDetectedLabelRef.current = currentLabel;
            
            // Set state ke 'analyzing'
            actions.setAppState('analyzing');
            
            // Generate fun fact dengan delay
            setTimeout(async () => {
              try {
                // Panggil generateFacts dengan tone yang dipilih
                rootFactsServiceRef.current.setTone(currentTone);
                const fact = await rootFactsServiceRef.current.generateFacts(currentLabel);
                
                actions.setFunFactData(fact);
                actions.setAppState('result');
                console.log(`📝 Fun fact generated for: ${currentLabel}`);
                
              } catch (error) {
                console.error('❌ Failed to generate fun fact:', error);
                actions.setFunFactData('error');
                actions.setAppState('result');
              }
            }, APP_CONFIG.analyzingDelay);
          }
        }

      } catch (error) {
        console.warn('⚠️ Detection loop error:', error);
      }

      if (isRunningRef.current) {
        detectionLoopRef.current = requestAnimationFrame(detect);
      }
    };

    isRunningRef.current = true;
    detect();
  };

  // ========== FUNGSI TOGGLE KAMERA ==========
  const handleToggleCamera = async () => {
    try {
      const cameraService = cameraServiceRef.current;
      const detectionService = detectionServiceRef.current;

      if (!cameraService) {
        actions.setError('Layanan kamera belum siap');
        return;
      }

      if (!detectionService || !detectionService.isLoaded()) {
        actions.setError('Model deteksi belum siap');
        return;
      }

      if (isRunningRef.current) {
        // ========== STOP KAMERA ==========
        console.log('🛑 Stopping camera...');
        
        isRunningRef.current = false;
        if (detectionLoopRef.current) {
          cancelAnimationFrame(detectionLoopRef.current);
          detectionLoopRef.current = null;
        }

        cameraService.stopCamera();
        actions.setRunning(false);
        actions.setAppState('idle');
        actions.resetResults();
        lastDetectedLabelRef.current = null;
        
        console.log('✅ Camera stopped');

      } else {
        // ========== START KAMERA ==========
        console.log('📷 Starting camera...');
        actions.setAppState('idle');
        actions.setError(null);
        actions.resetResults();
        lastDetectedLabelRef.current = null;

        await cameraService.startCamera();
        actions.setRunning(true);

        startDetectionLoop();
        
        console.log('✅ Camera started and detection loop active');
      }

    } catch (error) {
      console.error('❌ Camera toggle error:', error);
      actions.setError(error.message);
      
      if (isRunningRef.current) {
        isRunningRef.current = false;
        if (detectionLoopRef.current) {
          cancelAnimationFrame(detectionLoopRef.current);
          detectionLoopRef.current = null;
        }
      }
      actions.setRunning(false);
      actions.setAppState('idle');
    }
  };

  // ========== FUNGSI TONE CHANGE ==========
  const handleToneChange = (tone) => {
    setCurrentTone(tone);
    
    if (rootFactsServiceRef.current) {
      rootFactsServiceRef.current.setTone(tone);
      console.log(`🎵 Tone changed to: ${tone}`);
      
      // Jika sudah ada hasil deteksi, regenerate dengan tone baru
      if (state.detectionResult && state.appState === 'result') {
        const vegetableName = state.detectionResult.className;
        if (vegetableName) {
          actions.setAppState('analyzing');
          actions.setFunFactData(null);
          
          setTimeout(async () => {
            try {
              const fact = await rootFactsServiceRef.current.generateFacts(vegetableName);
              actions.setFunFactData(fact);
              actions.setAppState('result');
            } catch (error) {
              console.error('❌ Failed to regenerate fun fact:', error);
              actions.setFunFactData('error');
              actions.setAppState('result');
            }
          }, APP_CONFIG.factsGenerationDelay);
        }
      }
    }
  };

  // ========== FUNGSI COPY TO CLIPBOARD ==========
  const handleCopyFact = async () => {
    const factText = state.funFactData;
    
    if (!factText || factText === 'error' || factText === null) {
      console.warn('⚠️ No fun fact to copy');
      return;
    }

    try {
      const vegetableName = state.detectionResult?.className || 'Sayuran';
      const copyText = `🌱 Fakta Menarik tentang ${vegetableName}:\n\n${factText}`;
      
      await navigator.clipboard.writeText(copyText);
      setCopySuccess(true);
      console.log('📋 Fun fact copied to clipboard!');
      
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);

    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
      actions.setError('Gagal menyalin ke clipboard');
    }
  };

  // ========== RENDER ==========
  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />
      
      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />
        
        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}  // ← DITERUSKAN!
        />
      </main>
      
      <footer className="footer">
        <p>Powered by TensorFlow.js &amp; Transformers.js</p>
      </footer>
      
      {/* Toast Error */}
      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Toast Copy Success */}
      {copySuccess && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.75rem 1.25rem',
          background: '#10b981',
          color: 'white',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          ✅ Fakta berhasil disalin!
        </div>
      )}
    </div>
  );
}

export default App;