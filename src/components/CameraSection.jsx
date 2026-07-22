import { useState, useRef, useEffect } from 'react';
import { Camera, Mic, ScanLine } from 'lucide-react';
import { TONE_CONFIG } from '../utils/config';
import './CameraSection.css';

function CameraSection({
  isRunning,
  onToggleCamera,
  onToneChange,
  services,
  modelStatus,
  error,
  currentTone
}) {
  // ========== STATE ==========
  const [fps, setFps] = useState(30);
  const [cameraType, setCameraType] = useState('default');
  const [detectedLabel, setDetectedLabel] = useState(null);
  const [detectedConfidence, setDetectedConfidence] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [backendInfo, setBackendInfo] = useState('');
  
  // ========== REFS ==========
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // ========== SETUP SERVICES ==========
  useEffect(() => {
    if (services.camera) {
      if (videoRef.current && !services.camera.video) {
        services.camera.setVideoElement(videoRef.current);
      }
      if (canvasRef.current && !services.camera.canvas) {
        services.camera.setCanvasElement(canvasRef.current);
      }
    }
  }, [services.camera]);

  // ========== FPS ==========
  useEffect(() => {
    if (services.camera) {
      services.camera.setFPS(fps);
    }
  }, [fps, services.camera]);

  // ========== LOAD MODEL ==========
  useEffect(() => {
    if (services.detection) {
      const loadModel = async () => {
        try {
          console.log('🔄 Loading detection model...');
          await services.detection.loadModel('/model/model.json'); // ← TUNGGAL: model
          setIsModelReady(true);
          setBackendInfo(services.detection.getBackend());
          console.log('✅ Detection model ready!');
        } catch (err) {
          console.error('❌ Failed to load model:', err);
        }
      };
      
      loadModel();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [services.detection]);

  // ========== DETECTION LOOP ==========
  const startDetectionLoop = () => {
    if (!videoRef.current || !services.detection) return;

    const detect = async () => {
      try {
        if (!videoRef.current || 
            videoRef.current.readyState < 2 || 
            !isRunning) {
          animationRef.current = requestAnimationFrame(detect);
          return;
        }

        const result = await services.detection.predict(videoRef.current);
        
        if (result) {
          setDetectedLabel(result.label);
          setDetectedConfidence(result.confidence);
          console.log(`🥬 Detected: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`);
        }

      } catch (error) {
        console.warn('⚠️ Detection error:', error);
      }

      if (isRunning) {
        animationRef.current = requestAnimationFrame(detect);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    detect();
  };

  // ========== RUN DETECTION ==========
  useEffect(() => {
    if (isRunning && isModelReady) {
      startDetectionLoop();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (!isRunning) {
        setDetectedLabel(null);
        setDetectedConfidence(0);
      }
    }
  }, [isRunning, isModelReady]);

  // ========== HANDLERS ==========
  const handleCameraChange = (newCameraType) => {
    setCameraType(newCameraType);
    if (services.camera && services.camera.isActive()) {
      services.camera.startCamera();
    }
  };

  const handleFpsChange = (newFps) => {
    setFps(Number(newFps));
  };

  const handleToneChange = (e) => {
    const newTone = e.target.value;
    if (onToneChange) {
      onToneChange(newTone);
    }
  };

  // ========== RENDER ==========
  const isModelReadyForUI = modelStatus === 'Model AI Siap' || isModelReady;
  const buttonDisabled = !isModelReadyForUI;
  const buttonText = isRunning ? 'Stop Scan' : 'Mulai Scan';

  return (
    <section className="camera-section" aria-label="Camera Feed and Controls">
      <div className="camera-container">
        <div className="camera-wrapper">
          <video
            ref={videoRef}
            id="media-video"
            autoPlay
            muted
            playsInline
            className={isRunning ? '' : 'hidden'}
          />
          
          <canvas
            ref={canvasRef}
            id="media-canvas"
            className="hidden"
          />

          {/* Loading Model */}
          {!isModelReady && services.detection && (
            <div className="loading-overlay">
              <div className="loading-content">
                <div className="loading-spinner"></div>
                <p>Memuat Model AI...</p>
                <div className="loading-progress-bar">
                  <div 
                    className="loading-progress-fill" 
                    style={{ 
                      width: `${services.detection.getLoadingProgress?.() || 0}%` 
                    }}
                  />
                </div>
                <span className="loading-percentage">
                  {services.detection.getLoadingProgress?.() || 0}%
                </span>
                {backendInfo && (
                  <span className="backend-info">⚡ {backendInfo.toUpperCase()}</span>
                )}
              </div>
            </div>
          )}

          {/* Overlay */}
          <div className={`camera-overlay ${isRunning ? 'active' : ''}`}>
            <div className="overlay-frame"></div>
          </div>

          {/* Hasil Deteksi */}
          {isRunning && detectedLabel && (
            <div className="detection-result">
              <div className="detection-label">
                <span className="detection-icon">🥬</span>
                <span className="detection-name">{detectedLabel}</span>
              </div>
              <div className="detection-confidence">
                <span className="confidence-bar">
                  <span 
                    className="confidence-fill" 
                    style={{ width: `${(detectedConfidence * 100).toFixed(0)}%` }}
                  />
                </span>
                <span className="confidence-text">
                  {(detectedConfidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Placeholder */}
          {!isRunning && (
            <div className="camera-placeholder">
              <Camera size={48} />
              <p>Kamera tidak aktif</p>
              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="camera-controls">
          <button
            id="btn-toggle"
            className={`capture-btn ${isRunning ? 'scanning' : ''}`}
            onClick={onToggleCamera}
            disabled={buttonDisabled}
            aria-label={buttonText}
            style={{ opacity: buttonDisabled ? 0.6 : 1 }}
          >
            <ScanLine size={24} />
          </button>
        </div>

        {/* Settings */}
        <div className="settings-bar">
          <div className="setting-item">
            <Camera size={16} />
            <select
              id="camera-select"
              value={cameraType}
              onChange={(e) => handleCameraChange(e.target.value)}
              disabled={isRunning}
            >
              <option value="default">Belakang</option>
              <option value="front">Depan</option>
            </select>
          </div>

          <div className="setting-item fps-setting">
            <span id="fps-label">{fps} FPS</span>
            <input
              id="fps-slider"
              type="range"
              min="15"
              max="60"
              step="15"
              value={fps}
              onChange={(e) => handleFpsChange(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="setting-item tone-setting">
            <Mic size={16} />
            <select
              id="tone-select"
              value={currentTone || 'normal'}
              onChange={handleToneChange}
              disabled={isRunning}
            >
              {TONE_CONFIG.availableTones.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CameraSection;