export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = {
      width: 640,
      height: 480,
      fps: 30,
      facingMode: 'environment',
    };
    this.isCameraActive = false;
    this.selectedDeviceId = null;
    this.availableCameras = [];
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  // ========== LOAD CAMERAS ==========
  async loadCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('Browser tidak mendukung mediaDevices API');
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`📷 Found ${this.availableCameras.length} camera(s):`);
      this.availableCameras.forEach((camera, index) => {
        console.log(`  ${index + 1}. ${camera.label || 'Unnamed Camera'} (ID: ${camera.deviceId})`);
      });

      return this.availableCameras;

    } catch (error) {
      console.error('❌ Failed to load cameras:', error);
      throw new Error(`Gagal memuat daftar kamera: ${error.message}`);
    }
  }

  // ========== GET CONSTRAINTS ==========
  getCameraConstraints(selectedDeviceId = null) {
    const constraints = {
      video: {
        width: { ideal: this.config.width },
        height: { ideal: this.config.height },
        frameRate: { ideal: this.config.fps },
        facingMode: this.config.facingMode,
      },
      audio: false,
    };

    if (selectedDeviceId) {
      constraints.video.deviceId = { exact: selectedDeviceId };
    }

    return constraints;
  }

  // ========== START CAMERA ==========
  async startCamera(selectedCameraId = null) {
    try {
      this.stopCamera();

      if (!this.video) {
        throw new Error('Video element belum diset. Panggil setVideoElement() terlebih dahulu.');
      }

      const permissions = await navigator.permissions.query({ name: 'camera' });
      if (permissions.state === 'denied') {
        throw new Error('Izin kamera ditolak oleh pengguna');
      }

      const constraints = this.getCameraConstraints(selectedCameraId);
      console.log('📷 Starting camera...');
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        this.selectedDeviceId = settings.deviceId || null;
        console.log(`📷 Camera started: ${videoTrack.label}`);
        console.log(`📐 Resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
      }

      this.video.srcObject = this.stream;
      await this.video.play();

      this.isCameraActive = true;
      console.log('✅ Camera started successfully!');

      return true;

    } catch (error) {
      console.error('❌ Failed to start camera:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Izin kamera ditolak. Harap izinkan akses kamera di browser.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('Tidak ditemukan kamera. Pastikan kamera terhubung.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Kamera sedang digunakan oleh aplikasi lain.');
      } else {
        throw new Error(`Gagal memulai kamera: ${error.message}`);
      }
    }
  }

  // ========== STOP CAMERA ==========
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Track stopped: ${track.label}`);
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    this.isCameraActive = false;
    this.selectedDeviceId = null;
    console.log('🛑 Camera stopped');
  }

  // ========== SET FPS ==========
  setFPS(fps) {
    if (fps && fps > 0) {
      this.config.fps = fps;
      console.log(`⚡ FPS set to: ${fps}`);
      
      if (this.isCameraActive && this.stream) {
        console.log('🔄 Restarting camera with new FPS...');
        const currentDeviceId = this.selectedDeviceId;
        this.stopCamera();
        this.startCamera(currentDeviceId);
      }
    } else {
      console.warn('⚠️ Invalid FPS value:', fps);
    }
  }

  // ========== CHECKERS ==========
  isActive() {
    return this.isCameraActive && this.stream !== null && this.stream.active;
  }

  isReady() {
    return this.video !== null && 
           this.video.readyState >= 2 &&
           this.video.videoWidth > 0 && 
           this.video.videoHeight > 0;
  }

  // ========== GETTERS ==========
  getAvailableCameras() {
    return this.availableCameras;
  }

  getSelectedDeviceId() {
    return this.selectedDeviceId;
  }

  getStream() {
    return this.stream;
  }

  getVideoElement() {
    return this.video;
  }

  getConfig() {
    return { ...this.config };
  }

  // ========== SETTERS ==========
  setConfig(config) {
    this.config = { ...this.config, ...config };
    console.log('⚙️ Config updated:', this.config);
  }

  setFacingMode(mode) {
    if (mode === 'environment' || mode === 'user') {
      this.config.facingMode = mode;
      console.log(`📷 Facing mode set to: ${mode}`);
    }
  }

  // ========== TOGGLE ==========
  async toggleCamera(selectedCameraId = null) {
    if (this.isActive()) {
      this.stopCamera();
      return false;
    } else {
      await this.startCamera(selectedCameraId);
      return true;
    }
  }

  // ========== TAKE PHOTO ==========
  takePhoto() {
    if (!this.isReady()) {
      console.warn('⚠️ Camera not ready');
      return null;
    }

    if (!this.canvas) {
      console.warn('⚠️ Canvas element not set');
      return null;
    }

    const context = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    context.drawImage(this.video, 0, 0);
    
    return this.canvas;
  }

  // ========== CLEANUP ==========
  dispose() {
    this.stopCamera();
    this.video = null;
    this.canvas = null;
    this.availableCameras = [];
    this.selectedDeviceId = null;
    console.log('🧹 CameraService disposed');
  }
}