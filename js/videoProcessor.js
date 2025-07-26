class VideoProcessor {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.currentZoomState = null;
    }

    processFrame() {
        if (!this.video || this.video.readyState < 2) {
            console.log('Video not ready, readyState:', this.video ? this.video.readyState : 'no video');
            return;
        }

        // Check if video has valid dimensions
        if (!this.video.videoWidth || !this.video.videoHeight) {
            console.log('Video dimensions not available:', this.video.videoWidth, this.video.videoHeight);
            return;
        }

        try {
            const currentTime = this.video.currentTime;
            const zoomState = this.getZoomState(currentTime);
            
            // Debug logging
            if (window.app.zoomEvents && window.app.zoomEvents.length > 0) {
                console.log('DEBUG - Current time:', currentTime, 'Zoom events:', window.app.zoomEvents.length, 'Zooming:', zoomState.isZooming);
                if (zoomState.isZooming) {
                    console.log('DEBUG - Zoom state:', zoomState);
                }
            }
            
            if (zoomState.isZooming) {
                this.renderZoomedFrame(zoomState, currentTime);
            } else {
                this.renderNormalFrame();
            }
        } catch (error) {
            console.error('Error processing frame:', error);
            // Fallback to normal rendering
            this.renderNormalFrame();
        }
    }

    getZoomState(currentTime) {
        if (!window.app.zoomEvents || window.app.zoomEvents.length === 0) {
            return { isZooming: false };
        }

        const events = window.app.zoomEvents.sort((a, b) => a.startTime - b.startTime);
        
        // Find all active zoom events (multiple simultaneous zooms)
        const activeEvents = events.filter(event => {
            const startTime = event.startTime;
            const endTime = event.startTime + event.duration;
            const isActive = currentTime >= startTime && currentTime <= endTime;
            if (isActive) {
                console.log('DEBUG - Active zoom event found:', event.id, 'at time', currentTime, 'start:', startTime, 'end:', endTime);
            }
            return isActive;
        });

        if (activeEvents.length > 0) {
            // If multiple events are active, combine them
            if (activeEvents.length === 1) {
                return {
                    isZooming: true,
                    event: activeEvents[0],
                    progress: (currentTime - activeEvents[0].startTime) / activeEvents[0].duration,
                    isTransition: false,
                    isMultiple: false
                };
            } else {
                return {
                    isZooming: true,
                    events: activeEvents,
                    isTransition: false,
                    isMultiple: true
                };
            }
        }

        // Check for transitions between adjacent events
        for (let i = 0; i < events.length - 1; i++) {
            const currentEvent = events[i];
            const nextEvent = events[i + 1];
            const currentEnd = currentEvent.startTime + currentEvent.duration;
            const gap = nextEvent.startTime - currentEnd;

            // If there's a small gap (less than 0.5 seconds) or boxes are touching, create a transition
            if (gap <= 0.5 && currentTime >= currentEnd && currentTime <= nextEvent.startTime) {
                const transitionProgress = gap === 0 ? 0.5 : (currentTime - currentEnd) / gap;
                return {
                    isZooming: true,
                    fromEvent: currentEvent,
                    toEvent: nextEvent,
                    progress: transitionProgress,
                    isTransition: true
                };
            }
        }

        return { isZooming: false };
    }

    renderNormalFrame() {
        try {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Ensure video is ready for drawing
            if (this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.videoHeight > 0) {
                this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            } else {
                // Draw a placeholder if video isn't ready
                this.ctx.fillStyle = '#1a1a1a';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.ctx.fillStyle = '#666';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('Loading video...', this.canvas.width / 2, this.canvas.height / 2);
            }
        } catch (error) {
            console.error('Error in renderNormalFrame:', error);
            // Draw error state
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Video render error', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    renderZoomedFrame(zoomState, currentTime) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (zoomState.isMultiple) {
            // Handle multiple simultaneous zoom regions
            this.renderMultipleZoomFrame(zoomState, currentTime);
            return;
        }
        
        let currentZoomLevel = 1;
        let region = null;
        let easeProgress = 0;
        
        if (zoomState.isTransition) {
            // Transition between two zoom events with smooth panning
            const fromEvent = zoomState.fromEvent;
            const toEvent = zoomState.toEvent;
            const transitionProgress = this.easeInOutCubic(zoomState.progress);
            
            // Interpolate zoom level
            currentZoomLevel = fromEvent.level + (toEvent.level - fromEvent.level) * transitionProgress;
            
            // Interpolate region for smooth panning
            region = {
                x: fromEvent.region.x + (toEvent.region.x - fromEvent.region.x) * transitionProgress,
                y: fromEvent.region.y + (toEvent.region.y - fromEvent.region.y) * transitionProgress,
                width: fromEvent.region.width + (toEvent.region.width - fromEvent.region.width) * transitionProgress,
                height: fromEvent.region.height + (toEvent.region.height - fromEvent.region.height) * transitionProgress
            };
            easeProgress = 1;
        } else {
            // Single zoom event
            const zoomEvent = zoomState.event;
            const progress = zoomState.progress;
            region = zoomEvent.region;
            const targetZoomLevel = zoomEvent.level;
            
            // Calculate zoom-in and zoom-out phases
            const easingFunction = this.getEasingFunction(zoomEvent.animation || 'smooth');
            
            if (progress <= 0.1) {
                // Zoom-in phase (first 10% of duration)
                easeProgress = progress / 0.1;
                const smoothProgress = easingFunction(easeProgress);
                currentZoomLevel = 1 + (targetZoomLevel - 1) * smoothProgress;
            } else if (progress >= 0.9) {
                // Check if there's a close next zoom event
                const nextZoom = this.getNextZoomEvent(zoomEvent);
                const zoomEnd = zoomEvent.startTime + zoomEvent.duration;
                const hasCloseNextZoom = nextZoom && (nextZoom.startTime - zoomEnd) <= 0.5;
                
                if (!hasCloseNextZoom) {
                    // Zoom-out phase (last 10% of duration) - only if not followed by another zoom
                    easeProgress = (1 - progress) / 0.1;
                    const smoothProgress = easingFunction(easeProgress);
                    currentZoomLevel = 1 + (targetZoomLevel - 1) * smoothProgress;
                } else {
                    // Maintain zoom if next zoom is close - prepare for smooth transition
                    currentZoomLevel = targetZoomLevel;
                    easeProgress = 1;
                }
            } else {
                // Maintain zoom phase (middle 80% of duration)
                currentZoomLevel = targetZoomLevel;
                easeProgress = 1;
            }
        }
        
        // Apply tracking if enabled
        if (!zoomState.isTransition && zoomState.event && zoomState.event.tracking && zoomState.event.tracking.enabled) {
            region = this.updateTrackedRegion(zoomState.event, currentTime);
        }
        
        // Render the zoom region
        this.renderZoomRegion(region, currentZoomLevel);
        
        // Draw text overlay if enabled
        if (!zoomState.isTransition && zoomState.event && zoomState.event.textOverlay && zoomState.event.textOverlay.enabled && zoomState.event.textOverlay.text) {
            this.drawTextOverlay(zoomState.event.textOverlay, easeProgress);
        }
        
        // Draw zoom indicator overlay
        this.drawZoomIndicator(currentZoomLevel, easeProgress);
    }

    calculateZoomProgress(zoomEvent, currentTime) {
        const elapsed = currentTime - zoomEvent.startTime;
        const progress = Math.max(0, Math.min(1, elapsed / zoomEvent.duration));
        return progress;
    }

    getNextZoomEvent(currentEvent) {
        if (!window.app.zoomEvents) return null;
        
        const events = window.app.zoomEvents.sort((a, b) => a.startTime - b.startTime);
        const currentIndex = events.findIndex(e => e.id === currentEvent.id);
        
        return currentIndex >= 0 && currentIndex < events.length - 1 ? events[currentIndex + 1] : null;
    }

    getEasingFunction(animationType) {
        switch (animationType) {
            case 'snap':
                return this.easeSnap;
            case 'bounce':
                return this.easeBounce;
            case 'elastic':
                return this.easeElastic;
            case 'smooth':
            default:
                return this.easeInOutCubic;
        }
    }

    easeInOutCubic(t) {
        // Smooth ease-in-out for better zoom transitions
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    easeSnap(t) {
        // Instant snap to target
        return t >= 0.5 ? 1 : 0;
    }

    easeBounce(t) {
        // Bounce effect
        if (t < (1 / 2.75)) {
            return 7.5625 * t * t;
        } else if (t < (2 / 2.75)) {
            return 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75;
        } else if (t < (2.5 / 2.75)) {
            return 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375;
        } else {
            return 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375;
        }
    }

    easeElastic(t) {
        // Elastic effect
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : 
            t < 0.5 
                ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c4)) / 2
                : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c4)) / 2 + 1;
    }

    renderMultipleZoomFrame(zoomState, currentTime) {
        // For multiple simultaneous zoom regions, create a composite view
        const events = zoomState.events;
        
        // Find the dominant zoom (highest zoom level or most recent)
        let dominantEvent = events.reduce((dominant, event) => {
            const eventProgress = (currentTime - event.startTime) / event.duration;
            const dominantProgress = (currentTime - dominant.startTime) / dominant.duration;
            
            // Prefer events with higher zoom levels, or more recent if same level
            if (event.level > dominant.level) return event;
            if (event.level === dominant.level && event.startTime > dominant.startTime) return event;
            return dominant;
        });
        
        // Calculate zoom for dominant event
        const progress = (currentTime - dominantEvent.startTime) / dominantEvent.duration;
        const region = dominantEvent.region;
        const targetZoomLevel = dominantEvent.level;
        
        let currentZoomLevel = 1;
        let easeProgress = 0;
        
        // Calculate zoom phases for dominant event
        const easingFunction = this.getEasingFunction(dominantEvent.animation || 'smooth');
        
        if (progress <= 0.1) {
            easeProgress = progress / 0.1;
            const smoothProgress = easingFunction(easeProgress);
            currentZoomLevel = 1 + (targetZoomLevel - 1) * smoothProgress;
        } else if (progress >= 0.9) {
            const nextZoom = this.getNextZoomEvent(dominantEvent);
            const zoomEnd = dominantEvent.startTime + dominantEvent.duration;
            const hasCloseNextZoom = nextZoom && (nextZoom.startTime - zoomEnd) <= 0.5;
            
            if (!hasCloseNextZoom) {
                easeProgress = (1 - progress) / 0.1;
                const smoothProgress = easingFunction(easeProgress);
                currentZoomLevel = 1 + (targetZoomLevel - 1) * smoothProgress;
            } else {
                currentZoomLevel = targetZoomLevel;
                easeProgress = 1;
            }
        } else {
            currentZoomLevel = targetZoomLevel;
            easeProgress = 1;
        }
        
        // Render the dominant zoom region
        this.renderZoomRegion(region, currentZoomLevel);
        
        // Add subtle overlays for other active regions
        this.drawMultipleZoomIndicators(events, currentTime, dominantEvent);
    }

    renderZoomRegion(region, zoomLevel) {
        try {
            // Validate inputs
            if (!region || !zoomLevel || zoomLevel <= 0) {
                console.error('Invalid zoom parameters:', region, zoomLevel);
                this.renderNormalFrame();
                return;
            }

            // Calculate the center of the selected region in video coordinates
            const regionCenterX = (region.x + region.width / 2) * this.video.videoWidth;
            const regionCenterY = (region.y + region.height / 2) * this.video.videoHeight;
            
            // Calculate the zoom viewport size based on the zoom level
            // The viewport represents how much of the original video we show
            const baseViewportWidth = this.video.videoWidth / zoomLevel;
            const baseViewportHeight = this.video.videoHeight / zoomLevel;
            
            // Ensure viewport dimensions are valid
            if (baseViewportWidth <= 0 || baseViewportHeight <= 0) {
                console.error('Invalid viewport dimensions:', baseViewportWidth, baseViewportHeight);
                this.renderNormalFrame();
                return;
            }
            
            // Center the viewport on the selected region's center
            let viewportX = regionCenterX - baseViewportWidth / 2;
            let viewportY = regionCenterY - baseViewportHeight / 2;
            
            // Clamp viewport to stay within video bounds
            viewportX = Math.max(0, Math.min(viewportX, this.video.videoWidth - baseViewportWidth));
            viewportY = Math.max(0, Math.min(viewportY, this.video.videoHeight - baseViewportHeight));
            
            // Validate final drawing parameters
            if (viewportX < 0 || viewportY < 0 || 
                viewportX + baseViewportWidth > this.video.videoWidth ||
                viewportY + baseViewportHeight > this.video.videoHeight) {
                console.error('Invalid drawing bounds');
                this.renderNormalFrame();
                return;
            }
            
            // Draw the zoomed portion to fill the entire canvas
            // This centers the zoom on the selected region and maintains the zoom level
            this.ctx.drawImage(
                this.video,
                viewportX, viewportY, baseViewportWidth, baseViewportHeight,
                0, 0, this.canvas.width, this.canvas.height
            );
        } catch (error) {
            console.error('Error in renderZoomRegion:', error);
            this.renderNormalFrame();
        }
    }

    drawMultipleZoomIndicators(events, currentTime, dominantEvent) {
        this.ctx.save();
        
        // Draw indicators for all active zoom regions
        events.forEach((event, index) => {
            const progress = (currentTime - event.startTime) / event.duration;
            const alpha = event === dominantEvent ? 0.8 : 0.4;
            const color = event === dominantEvent ? '0, 168, 255' : '255, 170, 0';
            
            // Draw zoom level indicator
            this.ctx.fillStyle = `rgba(${color}, ${alpha * progress})`;
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'top';
            
            const zoomText = `${event.level.toFixed(1)}x`;
            const yOffset = 20 + (index * 25);
            this.ctx.fillText(zoomText, this.canvas.width - 20, yOffset);
        });
        
        this.ctx.restore();
    }

    updateTrackedRegion(zoomEvent, currentTime) {
        const tracking = zoomEvent.tracking;
        const progress = (currentTime - zoomEvent.startTime) / zoomEvent.duration;
        
        // Simple drift simulation - in a real implementation, this would use computer vision
        const driftAmount = tracking.sensitivity * 0.1; // Max 10% drift
        const timeOffset = progress * Math.PI * 2; // One full cycle over duration
        
        // Simulate object movement with sine waves
        const driftX = Math.sin(timeOffset) * driftAmount;
        const driftY = Math.cos(timeOffset * 0.7) * driftAmount * 0.5;
        
        // Apply drift to the initial region
        const trackedRegion = {
            x: Math.max(0, Math.min(1 - tracking.initialRegion.width, tracking.initialRegion.x + driftX)),
            y: Math.max(0, Math.min(1 - tracking.initialRegion.height, tracking.initialRegion.y + driftY)),
            width: tracking.initialRegion.width,
            height: tracking.initialRegion.height
        };
        
        return trackedRegion;
    }

    drawTextOverlay(textOverlay, progress) {
        this.ctx.save();
        
        // Set up text style
        const fontSize = Math.max(16, Math.min(48, this.canvas.width / 20));
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * progress})`;
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.7 * progress})`;
        this.ctx.lineWidth = 2;
        
        // Calculate text position
        const text = textOverlay.text;
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        let x, y;
        
        switch (textOverlay.position) {
            case 'center':
                x = (this.canvas.width - textWidth) / 2;
                y = (this.canvas.height + textHeight) / 2;
                break;
            case 'top':
                x = (this.canvas.width - textWidth) / 2;
                y = textHeight + 20;
                break;
            case 'bottom':
                x = (this.canvas.width - textWidth) / 2;
                y = this.canvas.height - 20;
                break;
            case 'top-left':
                x = 20;
                y = textHeight + 20;
                break;
            case 'top-right':
                x = this.canvas.width - textWidth - 20;
                y = textHeight + 20;
                break;
            case 'bottom-left':
                x = 20;
                y = this.canvas.height - 20;
                break;
            case 'bottom-right':
                x = this.canvas.width - textWidth - 20;
                y = this.canvas.height - 20;
                break;
            default:
                x = (this.canvas.width - textWidth) / 2;
                y = (this.canvas.height + textHeight) / 2;
        }
        
        // Draw text with outline
        this.ctx.strokeText(text, x, y);
        this.ctx.fillText(text, x, y);
        
        this.ctx.restore();
    }

    drawZoomIndicator(zoomLevel, progress) {
        // Draw a subtle zoom level indicator
        this.ctx.save();
        
        // Set up text style
        this.ctx.fillStyle = `rgba(0, 168, 255, ${0.8 * progress})`;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        
        // Draw zoom level text
        const zoomText = `${zoomLevel.toFixed(1)}x`;
        this.ctx.fillText(zoomText, this.canvas.width - 20, 20);
        
        this.ctx.restore();
    }

    async exportWithZoomEffects(zoomEvents) {
        return new Promise((resolve, reject) => {
            try {
                // Create video and audio streams
                const videoStream = this.canvas.captureStream(30);
                
                // Get audio from original video if available
                let combinedStream = videoStream;
                if (this.video.captureStream) {
                    try {
                        const audioStream = this.video.captureStream();
                        const audioTracks = audioStream.getAudioTracks();
                        
                        if (audioTracks.length > 0) {
                            // Combine video and audio streams
                            combinedStream = new MediaStream([
                                ...videoStream.getVideoTracks(),
                                ...audioTracks
                            ]);
                        }
                    } catch (audioError) {
                        console.warn('Could not capture audio, proceeding with video only:', audioError);
                    }
                }
                
                // Use more compatible codec options
                let mimeType = 'video/webm;codecs=h264';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/webm;codecs=vp8';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'video/webm';
                    }
                }
                
                const mediaRecorder = new MediaRecorder(combinedStream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
                });
                
                const chunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    resolve(blob);
                };
                
                mediaRecorder.onerror = (event) => {
                    reject(new Error('MediaRecorder error: ' + event.error));
                };
                
                // Start recording with proper timing
                mediaRecorder.start(100); // Request data every 100ms for smoother recording
                
                // Play through the video and record
                this.recordVideoPlayback(mediaRecorder);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async recordVideoPlayback(mediaRecorder) {
        return new Promise((resolve) => {
            const originalTime = this.video.currentTime;
            const originalPaused = this.video.paused;
            
            // Pause the video for controlled playback
            this.video.pause();
            this.video.currentTime = 0;
            
            // Set up proper playback for recording
            let recordingStartTime = null;
            const startRecording = () => {
                recordingStartTime = performance.now();
                this.video.play();
                
                // Monitor recording progress
                const checkProgress = () => {
                    const currentTime = this.video.currentTime;
                    const progress = (currentTime / this.video.duration) * 100;
                    
                    // Update export button to show progress
                    const exportBtn = document.getElementById('exportBtn');
                    if (exportBtn) {
                        exportBtn.textContent = `Exporting... ${Math.round(progress)}%`;
                    }
                    
                    // Process current frame with zoom effects
                    this.processFrame();
                    
                    if (currentTime >= this.video.duration || this.video.ended) {
                        // Recording complete
                        mediaRecorder.stop();
                        this.video.pause();
                        this.video.currentTime = originalTime;
                        if (!originalPaused) {
                            this.video.play();
                        }
                        resolve();
                    } else {
                        // Continue monitoring
                        requestAnimationFrame(checkProgress);
                    }
                };
                
                // Start monitoring once video begins playing
                this.video.addEventListener('playing', () => {
                    requestAnimationFrame(checkProgress);
                }, { once: true });
            };
            
            // Wait for video to be ready at position 0
            if (this.video.readyState >= 2) {
                startRecording();
            } else {
                this.video.addEventListener('canplay', startRecording, { once: true });
            }
        });
    }

    // Alternative export method using FFmpeg.js (would require including the library)
    async exportWithFFmpeg(zoomEvents) {
        // This would require FFmpeg.js to be loaded
        // For now, we'll use the MediaRecorder approach above
        throw new Error('FFmpeg export not implemented in this version');
    }

    // Utility method to convert WebM to MP4 (requires additional libraries)
    async convertToMP4(webmBlob) {
        // This would require a conversion library or server-side processing
        // For now, return the WebM blob directly
        return webmBlob;
    }

    // Get frame at specific time for thumbnail generation
    async getFrameAtTime(time) {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = this.video.videoWidth;
            tempCanvas.height = this.video.videoHeight;
            
            const originalTime = this.video.currentTime;
            this.video.currentTime = time;
            
            const onSeeked = () => {
                tempCtx.drawImage(this.video, 0, 0);
                this.video.currentTime = originalTime;
                this.video.removeEventListener('seeked', onSeeked);
                
                tempCanvas.toBlob(resolve, 'image/png');
            };
            
            this.video.addEventListener('seeked', onSeeked);
        });
    }
}