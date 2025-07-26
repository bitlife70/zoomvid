class ZoomVidApp {
    constructor() {
        this.videoElement = document.getElementById('videoPlayer');
        this.canvasElement = document.getElementById('videoCanvas');
        this.ctx = this.canvasElement.getContext('2d');
        this.uploadArea = document.getElementById('uploadArea');
        this.currentVideo = null;
        this.zoomEvents = [];
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.batchQueue = [];
        this.currentTemplate = null;
        this.baseVolume = 1.0; // User-set volume level
        
        this.initializeEventListeners();
        this.videoProcessor = new VideoProcessor(this.videoElement, this.canvasElement);
        this.timeline = new Timeline(document.getElementById('timelineCanvas'), this);
        this.zoomController = new ZoomController(this);
    }

    initializeEventListeners() {
        const uploadBtn = document.getElementById('uploadBtn');
        const videoUpload = document.getElementById('videoUpload');
        const uploadArea = this.uploadArea;
        const exportBtn = document.getElementById('exportBtn');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const stopBtn = document.getElementById('stopBtn');
        const batchBtn = document.getElementById('batchBtn');
        const batchUpload = document.getElementById('batchUpload');
        const batchExportBtn = document.getElementById('batchExportBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');

        uploadBtn.addEventListener('click', () => videoUpload.click());
        
        uploadArea.addEventListener('click', () => videoUpload.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#00a8ff';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#666';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#666';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleVideoUpload(files[0]);
            }
        });

        videoUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleVideoUpload(e.target.files[0]);
            }
        });

        this.videoElement.addEventListener('loadedmetadata', () => {
            this.onVideoLoaded();
        });

        this.videoElement.addEventListener('timeupdate', () => {
            this.currentTime = this.videoElement.currentTime;
            this.updateTimeDisplay();
            this.timeline.updateCursor();
            this.videoProcessor.processFrame();
            this.updateAudioDucking();
        });

        this.videoElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();
        });

        this.videoElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        this.videoElement.addEventListener('seeked', () => {
            this.videoProcessor.processFrame();
        });

        playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        stopBtn.addEventListener('click', () => this.stop());
        
        exportBtn.addEventListener('click', () => this.exportVideo());

        // Batch processing events
        batchBtn.addEventListener('click', () => batchUpload.click());
        
        batchUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleBatchUpload(Array.from(e.target.files));
            }
        });

        batchExportBtn.addEventListener('click', () => this.processBatchQueue());

        // Volume control events
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value) / 100;
            this.setVolume(volume);
            volumeValue.textContent = e.target.value + '%';
        });
    }

    handleVideoUpload(file) {
        if (!this.validateVideoFile(file)) return;

        const url = URL.createObjectURL(file);
        this.videoElement.src = url;
        this.currentVideo = file;
        
        this.uploadArea.style.display = 'none';
        this.videoElement.style.display = 'block';
    }

    validateVideoFile(file) {
        const validTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
        const maxSize = 100 * 1024 * 1024; // 100MB

        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid video file (MP4, MOV, AVI, WebM)');
            return false;
        }

        if (file.size > maxSize) {
            alert('File size must be less than 100MB');
            return false;
        }

        return true;
    }

    onVideoLoaded() {
        this.duration = this.videoElement.duration;
        this.setupCanvas();
        this.enableControls();
        this.timeline.initialize();
        this.updateTimeDisplay();
        
        // Render the first frame to show the video
        this.videoProcessor.processFrame();
        
        // Set initial volume
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            const initialVolume = parseFloat(volumeSlider.value) / 100;
            this.setVolume(initialVolume);
        }
        
        console.log('Video loaded:', {
            duration: this.duration,
            width: this.videoElement.videoWidth,
            height: this.videoElement.videoHeight
        });
    }

    setupCanvas() {
        const video = this.videoElement;
        this.canvasElement.width = video.videoWidth;
        this.canvasElement.height = video.videoHeight;
        
        // Style canvas to fit container while maintaining aspect ratio
        const containerWidth = this.canvasElement.parentElement.clientWidth;
        const containerHeight = this.canvasElement.parentElement.clientHeight - 100;
        
        const videoAspect = video.videoWidth / video.videoHeight;
        const containerAspect = containerWidth / containerHeight;
        
        if (videoAspect > containerAspect) {
            this.canvasElement.style.width = containerWidth + 'px';
            this.canvasElement.style.height = (containerWidth / videoAspect) + 'px';
        } else {
            this.canvasElement.style.height = containerHeight + 'px';
            this.canvasElement.style.width = (containerHeight * videoAspect) + 'px';
        }
        
        this.canvasElement.style.display = 'block';
        // Keep video element available for canvas drawing but hide it visually
        this.videoElement.style.position = 'absolute';
        this.videoElement.style.left = '-9999px';
        this.videoElement.style.opacity = '0';
        this.videoElement.style.pointerEvents = 'none';
    }

    enableControls() {
        document.getElementById('playPauseBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('addZoomBtn').disabled = false;
        document.getElementById('exportBtn').disabled = false;
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.videoElement.play();
        this.isPlaying = true;
    }

    pause() {
        this.videoElement.pause();
        this.isPlaying = false;
    }

    stop() {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        this.isPlaying = false;
        this.currentTime = 0;
        this.updateTimeDisplay();
        this.updatePlayPauseButton();
    }

    updatePlayPauseButton() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }

    seekTo(time) {
        this.videoElement.currentTime = Math.max(0, Math.min(time, this.duration));
        this.currentTime = this.videoElement.currentTime;
        this.updateTimeDisplay();
        
        // Force immediate frame processing
        this.videoProcessor.processFrame();
        
        // Also use a small delay to ensure video has sought to the correct time
        setTimeout(() => {
            this.videoProcessor.processFrame();
        }, 50);
    }

    updateTimeDisplay() {
        document.getElementById('currentTime').textContent = this.formatTime(this.currentTime);
        document.getElementById('totalTime').textContent = this.formatTime(this.duration);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    addZoomEvent(zoomData) {
        this.zoomEvents.push(zoomData);
        this.zoomEvents.sort((a, b) => a.startTime - b.startTime);
        this.timeline.updateZoomMarkers();
        this.zoomController.updateZoomEventsList();
    }

    removeZoomEvent(index) {
        this.zoomEvents.splice(index, 1);
        this.timeline.updateZoomMarkers();
        this.zoomController.updateZoomEventsList();
    }

    async exportVideo() {
        if (!this.currentVideo) return;
        
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.textContent = 'Exporting...';
        exportBtn.disabled = true;
        
        try {
            const processedBlob = await this.videoProcessor.exportWithZoomEffects(this.zoomEvents);
            this.downloadVideo(processedBlob);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            exportBtn.textContent = 'Export Video';
            exportBtn.disabled = false;
        }
    }

    downloadVideo(blob, filename = null) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (filename) {
            a.download = filename;
        } else {
            // Use correct file extension based on blob type
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
            a.download = `zoomvid-edited-${timestamp}.${extension}`;
        }
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    handleBatchUpload(files) {
        // Save current zoom events as template
        if (this.zoomEvents.length > 0) {
            this.currentTemplate = JSON.parse(JSON.stringify(this.zoomEvents));
        }

        // Add files to batch queue
        files.forEach(file => {
            if (this.validateVideoFile(file)) {
                this.batchQueue.push({
                    file: file,
                    status: 'pending',
                    zoomEvents: this.currentTemplate ? JSON.parse(JSON.stringify(this.currentTemplate)) : []
                });
            }
        });

        this.updateBatchUI();
        document.querySelector('.batch-section').style.display = 'block';
        document.getElementById('batchExportBtn').disabled = false;
    }

    updateBatchUI() {
        const batchQueue = document.getElementById('batchQueue');
        batchQueue.innerHTML = '';

        this.batchQueue.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = `batch-item ${item.status}`;
            itemElement.innerHTML = `
                <div class="batch-item-name">${item.file.name}</div>
                <div class="batch-item-status">${item.status} - ${item.zoomEvents.length} zoom effects</div>
            `;
            batchQueue.appendChild(itemElement);
        });
    }

    async processBatchQueue() {
        if (this.batchQueue.length === 0) return;

        const batchExportBtn = document.getElementById('batchExportBtn');
        batchExportBtn.textContent = 'Processing...';
        batchExportBtn.disabled = true;

        for (let i = 0; i < this.batchQueue.length; i++) {
            const item = this.batchQueue[i];
            
            try {
                item.status = 'processing';
                this.updateBatchUI();

                // Load video
                await this.loadVideoForBatch(item.file);
                
                // Apply zoom events
                this.zoomEvents = item.zoomEvents.map(event => ({
                    ...event,
                    id: Date.now() + Math.random() // New ID for each event
                }));

                // Export video
                const processedBlob = await this.videoProcessor.exportWithZoomEffects(this.zoomEvents);
                const filename = `batch-${item.file.name.replace(/\.[^/.]+$/, '')}-edited.webm`;
                this.downloadVideo(processedBlob, filename);

                item.status = 'completed';
            } catch (error) {
                console.error('Batch processing error:', error);
                item.status = 'error';
            }
            
            this.updateBatchUI();
        }

        batchExportBtn.textContent = 'Export All';
        batchExportBtn.disabled = false;
    }

    loadVideoForBatch(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            this.videoElement.src = url;
            
            const onLoaded = () => {
                this.duration = this.videoElement.duration;
                this.setupCanvas();
                this.videoProcessor.processFrame();
                resolve();
            };

            const onError = () => {
                reject(new Error('Failed to load video'));
            };

            this.videoElement.addEventListener('loadedmetadata', onLoaded, { once: true });
            this.videoElement.addEventListener('error', onError, { once: true });
        });
    }

    updateAudioDucking() {
        // Check for audio ducking enabled zoom events
        const duckingEvents = this.zoomEvents.filter(event => {
            const enableAudioDucking = document.getElementById('enableAudioDucking');
            if (!enableAudioDucking || !enableAudioDucking.checked) return false;

            const startTime = event.startTime;
            const endTime = event.startTime + event.duration;
            return this.currentTime >= startTime && this.currentTime <= endTime;
        });

        if (duckingEvents.length > 0) {
            // Apply ducking based on user's base volume
            const duckingAmount = document.getElementById('duckingAmount');
            const duckingFactor = duckingAmount ? parseFloat(duckingAmount.value) : 0.3;
            const targetVolume = this.baseVolume * (1 - duckingFactor);
            
            // Smooth volume transition
            const currentVolume = this.videoElement.volume;
            const volumeDiff = targetVolume - currentVolume;
            const smoothFactor = 0.1; // Adjust for smoother/faster transitions
            
            this.videoElement.volume = Math.max(0, Math.min(1, currentVolume + (volumeDiff * smoothFactor)));
        } else {
            // Restore to base volume
            const currentVolume = this.videoElement.volume;
            const volumeDiff = this.baseVolume - currentVolume;
            const smoothFactor = 0.05; // Slower return to normal
            
            this.videoElement.volume = Math.max(0, Math.min(1, currentVolume + (volumeDiff * smoothFactor)));
        }
    }

    setVolume(volume) {
        // Clamp volume between 0 and 1
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.baseVolume = clampedVolume;
        this.videoElement.volume = clampedVolume;
        
        // Update volume icon based on volume level
        this.updateVolumeIcon(clampedVolume);
    }

    updateVolumeIcon(volume) {
        const volumeIcon = document.querySelector('.volume-icon');
        if (!volumeIcon) return;
        
        if (volume === 0) {
            volumeIcon.textContent = '🔇';
        } else if (volume < 0.3) {
            volumeIcon.textContent = '🔈';
        } else if (volume < 0.7) {
            volumeIcon.textContent = '🔉';
        } else {
            volumeIcon.textContent = '🔊';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ZoomVidApp();
});