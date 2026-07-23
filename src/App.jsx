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
  
  // ========== REFS UNTUK CAPTURE LOGIC ==========
  const lastDetectedLabelRef = useRef(null);
  const stableDetectionCountRef = useRef(0);
  const isCapturedRef = useRef(false);
  const capturedLabelRef = useRef(null);
  const capturedConfidenceRef = useRef(0);
  const captureTimerRef = useRef(null);
  const isGeneratingRef = useRef(false);
  
  // ========== STATE UNTUK PROPS KE CAMERASECTION ==========
  const [detectedLabel, setDetectedLabel] = useState(null);
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [backendInfo, setBackendInfo] = useState('');
  const [currentTone, setCurrentTone] = useState('normal');
  const [copySuccess, setCopySuccess] = useState(false);

  // ========== INISIALISASI SERVICES ==========
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('🚀 Initializing services...');
        actions.setModelStatus('Memuat Model AI...');

        const detectionService = new DetectionService();
        detectionServiceRef.current = detectionService;

        const cameraService = new CameraService();
        cameraServiceRef.current = cameraService;

        const rootFactsService = new RootFactsService();
        rootFactsServiceRef.current = rootFactsService;

        actions.setServices({
          detection: detectionService,
          camera: cameraService,
          generator: rootFactsService
        });

        actions.setModelStatus('Memuat Model Deteksi...');
        await detectionService.loadModel('/model/model.json');
        console.log('✅ Detection model loaded');
        
        setIsModelReady(true);
        setBackendInfo(detectionService.getBackend());
        setLoadingProgress(100);

        actions.setModelStatus('Memuat Model AI Generatif...');
        await rootFactsService.loadModel();
        console.log('✅ Generative AI model loaded');

        actions.setModelStatus('Memuat Daftar Kamera...');
        await cameraService.loadCameras();
        console.log('✅ Cameras loaded');

        actions.setModelStatus('Model AI Siap');
        console.log('✅ All services initialized successfully!');

      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        actions.setError(`Gagal memuat layanan: ${error.message}`);
        actions.setModelStatus('Gagal Memuat Model');
      }
    };

    initializeServices();

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
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
        captureTimerRef.current = null;
      }
      console.log('🧹 App cleaned up');
    };
  }, []);

  // ========== FUNGSI CAPTURE FRAME ==========
  const captureFrame = (videoElement) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0);
      console.log('📸 Frame captured');
      return canvas;
    } catch (error) {
      console.warn('⚠️ Failed to capture frame:', error);
      return null;
    }
  };

  // ========== FUNGSI STOP CAMERA DAN TAMPILKAN HASIL ==========
  const stopCameraAndShowResult = async (label, confidence) => {
    if (isGeneratingRef.current) {
      console.log('⏳ Already generating, skipping...');
      return;
    }

    try {
      isGeneratingRef.current = true;
      
      // ========== 1. STOP KAMERA ==========
      console.log(`🛑 Auto-stopping camera after capture: ${label}`);
      
      if (cameraServiceRef.current) {
        cameraServiceRef.current.stopCamera();
      }
      
      isRunningRef.current = false;
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
      
      // Update state running
      actions.setRunning(false);
      
      // ========== 2. CAPTURE FRAME ==========
      const videoElement = cameraServiceRef.current?.getVideoElement();
      if (videoElement) {
        captureFrame(videoElement);
      }
      
      // ========== 3. GENERATE FUN FACT ==========
      console.log(`🤖 Generating fun fact for: ${label} (${(confidence * 100).toFixed(1)}%)`);
      actions.setAppState('analyzing');
      
      rootFactsServiceRef.current.setTone(currentTone);
      const fact = await rootFactsServiceRef.current.generateFacts(label);
      
      // Validasi hasil
      const lowerFact = fact.toLowerCase();
      const lowerLabel = label.toLowerCase();
      
      if (!lowerFact.includes(lowerLabel) && fact !== 'error') {
        console.warn(`⚠️ Generated fact doesn't contain the vegetable name, using fallback`);
        const fallback = rootFactsServiceRef.current.getFallbackFact(label);
        actions.setFunFactData(fallback);
      } else if (fact === 'error' || !fact || fact.length < 10) {
        const fallback = rootFactsServiceRef.current.getFallbackFact(label);
        actions.setFunFactData(fallback);
      } else {
        actions.setFunFactData(fact);
      }
      
      actions.setAppState('result');
      console.log(`✅ Fun fact generated for: ${label}`);
      
      // ========== 4. RESET CAPTURE STATE ==========
      isCapturedRef.current = true;
      capturedLabelRef.current = label;
      capturedConfidenceRef.current = confidence;
      
      console.log(`📸 Capture complete! Camera stopped. Press "Mulai Scan" to scan again.`);
      
    } catch (error) {
      console.error('❌ Failed to process capture:', error);
      const fallback = rootFactsServiceRef.current.getFallbackFact(label);
      actions.setFunFactData(fallback);
      actions.setAppState('result');
      
      // Jika error, tetap stop camera
      if (cameraServiceRef.current) {
        cameraServiceRef.current.stopCamera();
      }
      isRunningRef.current = false;
      actions.setRunning(false);
      
    } finally {
      isGeneratingRef.current = false;
    }
  };

  // ========== FUNGSI DETEKSI LOOP ==========
  const startDetectionLoop = () => {
    const videoElement = cameraServiceRef.current?.getVideoElement();
    const detectionService = detectionServiceRef.current;
    
    if (!videoElement || !detectionService) {
      console.warn('⚠️ Cannot start detection: video or detection service not ready');
      return;
    }

    console.log('🔄 Starting detection loop (auto-stop on capture)...');

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
          // Update state UI
          setDetectedLabel(result.label);
          setDetectedConfidence(result.confidence);
          
          // Update state global
          actions.setDetectionResult({
            className: result.label,
            score: result.confidence,
            isValid: result.confidence >= (APP_CONFIG.detectionConfidenceThreshold / 100)
          });

          const currentLabel = result.label;
          const currentConfidence = result.confidence;
          const THRESHOLD = APP_CONFIG.detectionConfidenceThreshold / 100;

          // ============================================================
          // ========== CAPTURE LOGIC: Auto-stop camera ==========
          // ============================================================

          // Jika sudah pernah capture, skip
          if (isCapturedRef.current) {
            console.log(`⏭️ Already captured "${capturedLabelRef.current}". Skipping detection.`);
            return;
          }

          // CASE 1: Label BERUBAH
          if (lastDetectedLabelRef.current !== currentLabel) {
            console.log(`🔄 Label changed: "${lastDetectedLabelRef.current}" → "${currentLabel}"`);
            
            // Reset counter
            stableDetectionCountRef.current = 0;
            lastDetectedLabelRef.current = currentLabel;
            
            if (currentConfidence >= THRESHOLD) {
              stableDetectionCountRef.current = 1;
              console.log(`🔍 Stable detection #1: ${currentLabel} (${(currentConfidence * 100).toFixed(1)}%)`);
            }
          }
          // CASE 2: Label SAMA
          else {
            if (currentConfidence >= THRESHOLD) {
              stableDetectionCountRef.current += 1;
              console.log(`🔍 Stable detection #${stableDetectionCountRef.current}: ${currentLabel} (${(currentConfidence * 100).toFixed(1)}%)`);
              
              // Jika sudah 3 deteksi stabil → CAPTURE & STOP CAMERA
              if (stableDetectionCountRef.current >= 3 && !isCapturedRef.current) {
                console.log(`🎯 CAPTURE TRIGGERED! Stopping camera...`);
                
                // Hentikan loop
                isRunningRef.current = false;
                if (detectionLoopRef.current) {
                  cancelAnimationFrame(detectionLoopRef.current);
                  detectionLoopRef.current = null;
                }
                
                // Proses capture dan stop camera
                await stopCameraAndShowResult(currentLabel, currentConfidence);
              }
            } 
            else {
              // Confidence turun
              if (stableDetectionCountRef.current > 0) {
                console.log(`📉 Confidence dropped (${(currentConfidence * 100).toFixed(1)}%), resetting counter`);
                stableDetectionCountRef.current = 0;
              }
            }
          }

        } else {
          // Tidak ada deteksi
          if (stableDetectionCountRef.current > 0) {
            stableDetectionCountRef.current = Math.max(0, stableDetectionCountRef.current - 1);
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
        // ========== STOP MANUAL ==========
        console.log('🛑 Stopping camera (manual)...');
        
        isRunningRef.current = false;
        if (detectionLoopRef.current) {
          cancelAnimationFrame(detectionLoopRef.current);
          detectionLoopRef.current = null;
        }

        cameraService.stopCamera();
        actions.setRunning(false);
        actions.setAppState('idle');
        
        // Reset semua state (kecuali hasil capture tetap tampil)
        lastDetectedLabelRef.current = null;
        stableDetectionCountRef.current = 0;
        setDetectedLabel(null);
        setDetectedConfidence(0);
        
        console.log('✅ Camera stopped');

      } else {
        // ========== START ==========
        console.log('📷 Starting camera...');
        actions.setAppState('idle');
        actions.setError(null);
        
        // Reset semua state untuk scan baru
        lastDetectedLabelRef.current = null;
        stableDetectionCountRef.current = 0;
        isCapturedRef.current = false;
        capturedLabelRef.current = null;
        capturedConfidenceRef.current = 0;
        isGeneratingRef.current = false;
        setDetectedLabel(null);
        setDetectedConfidence(0);
        
        // Reset hasil sebelumnya di UI
        actions.resetResults();
        actions.setFunFactData(null);

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
      
      // Regenerate jika sudah ada hasil capture
      if (state.appState === 'result' && capturedLabelRef.current) {
        actions.setAppState('analyzing');
        actions.setFunFactData(null);
        
        setTimeout(async () => {
          try {
            const fact = await rootFactsServiceRef.current.generateFacts(capturedLabelRef.current);
            
            const lowerFact = fact.toLowerCase();
            const lowerLabel = capturedLabelRef.current.toLowerCase();
            
            if (!lowerFact.includes(lowerLabel) && fact !== 'error') {
              const fallback = rootFactsServiceRef.current.getFallbackFact(capturedLabelRef.current);
              actions.setFunFactData(fallback);
            } else if (fact === 'error' || !fact || fact.length < 10) {
              const fallback = rootFactsServiceRef.current.getFallbackFact(capturedLabelRef.current);
              actions.setFunFactData(fallback);
            } else {
              actions.setFunFactData(fact);
            }
            
            actions.setAppState('result');
          } catch (error) {
            console.error('❌ Failed to regenerate fun fact:', error);
            const fallback = rootFactsServiceRef.current.getFallbackFact(capturedLabelRef.current);
            actions.setFunFactData(fallback);
            actions.setAppState('result');
          }
        }, APP_CONFIG.factsGenerationDelay);
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
      const vegetableName = capturedLabelRef.current || state.detectionResult?.className || 'Sayuran';
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
          detectedLabel={detectedLabel}
          detectedConfidence={detectedConfidence}
          isModelReady={isModelReady}
          loadingProgress={loadingProgress}
          backendInfo={backendInfo}
        />
        
        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
        />
      </main>
      
      <footer className="footer">
        <p>Powered by TensorFlow.js &amp; Transformers.js</p>
      </footer>
      
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