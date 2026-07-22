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
  currentTone,
  detectedLabel,        // ← Props dari App.jsx
  detectedConfidence,   // ← Props dari App.jsx
  isModelReady,         // ← Props dari App.jsx
  loadingProgress,      // ← Props dari App.jsx
  backendInfo           // ← Props dari App.jsx
}) {
  // ========== STATE LOCAL ==========
  const [fps, setFps] = useState(30);
  const [cameraType, setCameraType] = useState('default');
  
  // ========== REFS ==========
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ========== SETUP VIDEO ELEMENT ==========
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

  // ========== HANDLERS ==========
  const handleCameraChange = async (newCameraType) => {
    setCameraType(newCameraType);
    
    if (services.camera && services.camera.isActive()) {
      try {
        // Tentukan facingMode berdasarkan pilihan
        const facingMode = newCameraType === 'front' ? 'user' : 'environment';
        
        // Update config camera
        services.camera.setFacingMode(facingMode);
        
        // Restart camera dengan facingMode baru
        // Ambil device ID yang sedang digunakan
        const currentDeviceId = services.camera.getSelectedDeviceId();
        
        // Stop dulu
        services.camera.stopCamera();
        
        // Start ulang dengan facingMode baru
        // Tapi karena kita sudah set facingMode di config, 
        // startCamera akan menggunakan facingMode yang baru
        await services.camera.startCamera();
        
        console.log(`📷 Camera switched to: ${newCameraType} (${facingMode})`);
      } catch (error) {
        console.error('❌ Failed to switch camera:', error);
        // Jika gagal, coba start dengan default
        try {
          await services.camera.startCamera();
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }
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

          {/* Loading Model - HANYA TAMPILAN */}
          {!isModelReady && services.detection && (
            <div className="loading-overlay">
              <div className="loading-content">
                <div className="loading-spinner"></div>
                <p>Memuat Model AI...</p>
                <div className="loading-progress-bar">
                  <div 
                    className="loading-progress-fill" 
                    style={{ 
                      width: `${loadingProgress || 0}%` 
                    }}
                  />
                </div>
                <span className="loading-percentage">
                  {loadingProgress || 0}%
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

          {/* Hasil Deteksi - DARI PROPS */}
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