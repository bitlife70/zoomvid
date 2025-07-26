class ZoomController {
    constructor(app) {
        this.app = app;
        this.zoomLevel = document.getElementById('zoomLevel');
        this.zoomValue = document.getElementById('zoomValue');
        this.zoomDuration = document.getElementById('zoomDuration');
        this.zoomAnimation = document.getElementById('zoomAnimation');
        this.enableTracking = document.getElementById('enableTracking');
        this.trackingSensitivity = document.getElementById('trackingSensitivity');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.enableAudioDucking = document.getElementById('enableAudioDucking');
        this.duckingAmount = document.getElementById('duckingAmount');
        this.duckingValue = document.getElementById('duckingValue');
        this.enableTextOverlay = document.getElementById('enableTextOverlay');
        this.overlayText = document.getElementById('overlayText');
        this.textPosition = document.getElementById('textPosition');
        this.addZoomBtn = document.getElementById('addZoomBtn');
        this.zoomEventsList = document.getElementById('zoomEvents');
        
        this.currentZoomRegion = null;
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectedZoomIndex = null;
        this.centerPoint = null;
        this.isDraggingCenter = false;
        this.centerDragStart = null;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Zoom level slider
        this.zoomLevel.addEventListener('input', (e) => {
            this.zoomValue.textContent = e.target.value + 'x';
            
            // Update selected zoom event if any
            if (this.selectedZoomIndex !== null) {
                this.app.zoomEvents[this.selectedZoomIndex].level = parseFloat(e.target.value);
                this.app.timeline.draw();
                this.updateZoomEventsList();
                
                // Update center point label
                if (this.centerPoint) {
                    const label = this.centerPoint.querySelector('.zoom-center-label');
                    if (label) {
                        label.textContent = e.target.value + 'x';
                    }
                }
                
                // Force real-time preview if we're in the zoom time range
                this.updateRealTimePreview();
            }
        });

        // Animation style change
        this.zoomAnimation.addEventListener('change', (e) => {
            // Update selected zoom event if any
            if (this.selectedZoomIndex !== null) {
                this.app.zoomEvents[this.selectedZoomIndex].animation = e.target.value;
            }
        });

        // Tracking controls
        this.enableTracking.addEventListener('change', (e) => {
            const trackingControls = document.getElementById('trackingControls');
            trackingControls.style.display = e.target.checked ? 'block' : 'none';
        });

        this.trackingSensitivity.addEventListener('input', (e) => {
            this.sensitivityValue.textContent = e.target.value;
        });

        // Audio ducking controls
        this.enableAudioDucking.addEventListener('change', (e) => {
            const duckingControls = document.getElementById('duckingControls');
            duckingControls.style.display = e.target.checked ? 'block' : 'none';
        });

        this.duckingAmount.addEventListener('input', (e) => {
            this.duckingValue.textContent = e.target.value;
        });

        // Text overlay controls
        this.enableTextOverlay.addEventListener('change', (e) => {
            const textOverlayControls = document.getElementById('textOverlayControls');
            textOverlayControls.style.display = e.target.checked ? 'block' : 'none';
        });

        // Add zoom button
        this.addZoomBtn.addEventListener('click', () => {
            this.showZoomRegionSelection();
        });

        // Canvas interaction for zoom region selection
        this.app.canvasElement.addEventListener('mousedown', (e) => {
            if (this.isSelecting) {
                this.startRegionSelection(e);
            }
        });

        this.app.canvasElement.addEventListener('mousemove', (e) => {
            if (this.isSelecting && this.selectionStart) {
                this.updateRegionSelection(e);
            }
        });

        this.app.canvasElement.addEventListener('mouseup', (e) => {
            if (this.isSelecting && this.selectionStart) {
                this.finishRegionSelection(e);
            }
        });

        // Center point drag events
        document.addEventListener('mousemove', (e) => this.handleCenterDrag(e));
        document.addEventListener('mouseup', () => this.handleCenterDragEnd());
    }

    showZoomRegionSelection() {
        this.isSelecting = true;
        this.addZoomBtn.textContent = 'Select Zoom Area';
        this.addZoomBtn.disabled = true;
        
        // Add visual indicator
        this.app.canvasElement.style.cursor = 'crosshair';
        this.showSelectionInstructions();
    }

    showSelectionInstructions() {
        const instructions = document.createElement('div');
        instructions.id = 'selectionInstructions';
        instructions.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: rgba(0,0,0,0.8); padding: 1rem; border-radius: 8px; color: white; text-align: center; z-index: 1000;">
                <p>Click and drag to select the area you want to zoom into</p>
                <button onclick="this.parentElement.parentElement.remove(); window.app.zoomController.cancelRegionSelection();">Cancel</button>
            </div>
        `;
        this.app.canvasElement.parentElement.appendChild(instructions);
    }

    startRegionSelection(e) {
        const rect = this.app.canvasElement.getBoundingClientRect();
        const scaleX = this.app.canvasElement.width / rect.width;
        const scaleY = this.app.canvasElement.height / rect.height;
        
        this.selectionStart = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };

        // Remove instructions
        const instructions = document.getElementById('selectionInstructions');
        if (instructions) instructions.remove();

        // Create selection overlay
        this.createSelectionOverlay();
    }

    updateRegionSelection(e) {
        if (!this.selectionStart || !this.currentZoomRegion) return;

        const rect = this.app.canvasElement.getBoundingClientRect();
        const scaleX = this.app.canvasElement.width / rect.width;
        const scaleY = this.app.canvasElement.height / rect.height;
        
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;

        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);
        const left = Math.min(currentX, this.selectionStart.x);
        const top = Math.min(currentY, this.selectionStart.y);

        // Update overlay position and size
        const overlay = this.currentZoomRegion;
        const canvasRect = this.app.canvasElement.getBoundingClientRect();
        const displayScaleX = canvasRect.width / this.app.canvasElement.width;
        const displayScaleY = canvasRect.height / this.app.canvasElement.height;

        overlay.style.left = (left * displayScaleX) + 'px';
        overlay.style.top = (top * displayScaleY) + 'px';
        overlay.style.width = (width * displayScaleX) + 'px';
        overlay.style.height = (height * displayScaleY) + 'px';
    }

    createSelectionOverlay() {
        this.currentZoomRegion = document.createElement('div');
        this.currentZoomRegion.className = 'zoom-region-overlay';
        this.currentZoomRegion.style.position = 'absolute';
        this.currentZoomRegion.style.border = '2px solid #00a8ff';
        this.currentZoomRegion.style.background = 'rgba(0, 168, 255, 0.1)';
        this.currentZoomRegion.style.pointerEvents = 'none';
        
        this.app.canvasElement.parentElement.appendChild(this.currentZoomRegion);
    }

    finishRegionSelection(e) {
        if (!this.selectionStart || !this.currentZoomRegion) return;

        const rect = this.app.canvasElement.getBoundingClientRect();
        const scaleX = this.app.canvasElement.width / rect.width;
        const scaleY = this.app.canvasElement.height / rect.height;
        
        const endX = (e.clientX - rect.left) * scaleX;
        const endY = (e.clientY - rect.top) * scaleY;

        const region = {
            x: Math.min(this.selectionStart.x, endX) / this.app.canvasElement.width,
            y: Math.min(this.selectionStart.y, endY) / this.app.canvasElement.height,
            width: Math.abs(endX - this.selectionStart.x) / this.app.canvasElement.width,
            height: Math.abs(endY - this.selectionStart.y) / this.app.canvasElement.height
        };

        // Allow any size selection - no minimum limit

        this.createZoomEvent(region);
        this.resetSelection();
    }

    createZoomEvent(region) {
        // Auto-calculate zoom level based on region size
        const autoZoomLevel = this.calculateAutoZoomLevel(region);
        
        // Update the slider to show the calculated zoom level
        this.zoomLevel.value = autoZoomLevel;
        this.zoomValue.textContent = autoZoomLevel + 'x';
        
        const zoomEvent = {
            id: Date.now(),
            startTime: this.app.currentTime,
            duration: parseFloat(this.zoomDuration.value),
            level: autoZoomLevel,
            region: region,
            animation: this.zoomAnimation.value,
            tracking: {
                enabled: this.enableTracking.checked,
                sensitivity: parseFloat(this.trackingSensitivity.value),
                initialRegion: { ...region },
                trackingPoints: []
            },
            textOverlay: {
                enabled: this.enableTextOverlay.checked,
                text: this.overlayText.value || '',
                position: this.textPosition.value
            }
        };

        // Allow overlapping for multiple simultaneous zoom regions
        this.app.addZoomEvent(zoomEvent);
        console.log('Zoom event created:', zoomEvent);
        console.log('Total zoom events now:', this.app.zoomEvents.length);
        console.log('Current video time:', this.app.currentTime);
    }

    cancelRegionSelection() {
        this.resetSelection();
    }

    resetSelection() {
        this.isSelecting = false;
        this.selectionStart = null;
        
        // Clean up any zoom region overlays
        if (this.currentZoomRegion) {
            try {
                this.currentZoomRegion.remove();
            } catch (e) {
                console.warn('Error removing zoom region:', e);
            }
            this.currentZoomRegion = null;
        }

        // Clean up any remaining zoom overlays
        const existingOverlays = document.querySelectorAll('.zoom-region-overlay');
        existingOverlays.forEach(overlay => {
            try {
                overlay.remove();
            } catch (e) {
                console.warn('Error removing overlay:', e);
            }
        });

        const instructions = document.getElementById('selectionInstructions');
        if (instructions) instructions.remove();

        this.app.canvasElement.style.cursor = 'default';
        this.addZoomBtn.textContent = 'Add Zoom Effect';
        this.addZoomBtn.disabled = false;
    }

    updateZoomEventsList() {
        this.zoomEventsList.innerHTML = '';
        
        this.app.zoomEvents.forEach((event, index) => {
            const eventElement = document.createElement('div');
            eventElement.className = `zoom-event ${this.selectedZoomIndex === index ? 'selected' : ''}`;
            eventElement.innerHTML = `
                <div class="zoom-event-header">
                    <span class="zoom-event-time">${this.formatTime(event.startTime)}</span>
                    <button class="zoom-event-delete" onclick="event.stopPropagation(); window.app.removeZoomEvent(${index})">×</button>
                </div>
                <div class="zoom-event-details">
                    ${event.level}x zoom
                </div>
            `;
            
            // Make the event clickable for selection
            eventElement.addEventListener('click', () => {
                this.selectZoomEvent(index);
            });
            
            this.zoomEventsList.appendChild(eventElement);
        });
    }

    selectZoomEvent(index) {
        this.selectedZoomIndex = index;
        
        if (index !== null && this.app.zoomEvents[index]) {
            const zoomEvent = this.app.zoomEvents[index];
            // Update controls to show selected zoom event values
            this.zoomLevel.value = zoomEvent.level;
            this.zoomValue.textContent = zoomEvent.level + 'x';
            this.zoomDuration.value = zoomEvent.duration;
            this.zoomAnimation.value = zoomEvent.animation || 'smooth';
            
            // Show center point for selected zoom event
            this.showCenterPoint(zoomEvent);
            
            // Update UI to show which event is selected
            this.updateZoomEventsList();
            this.app.timeline.selectedZoomIndex = index;
            this.app.timeline.draw();
        } else {
            // Deselect
            this.hideCenterPoint();
            this.app.timeline.selectedZoomIndex = null;
            this.app.timeline.draw();
        }
    }

    calculateAutoZoomLevel(region) {
        // Calculate zoom level based on region size
        // Smaller regions need higher zoom levels
        const regionSize = region.width * region.height;
        
        if (regionSize < 0.01) return 5.0;      // Very small region = max zoom
        if (regionSize < 0.05) return 4.0;      // Small region = high zoom  
        if (regionSize < 0.15) return 3.0;      // Medium region = medium zoom
        if (regionSize < 0.3) return 2.0;       // Large region = low zoom
        return 1.5;                             // Very large region = minimal zoom
    }

    preventOverlap(newEvent) {
        const events = this.app.zoomEvents;
        const newStart = newEvent.startTime;
        const newEnd = newEvent.startTime + newEvent.duration;
        
        // Find overlapping events
        const overlapping = events.filter(event => {
            const eventStart = event.startTime;
            const eventEnd = event.startTime + event.duration;
            
            return (newStart < eventEnd && newEnd > eventStart);
        });
        
        if (overlapping.length === 0) {
            return newEvent; // No overlap
        }
        
        // Find a suitable gap to place the new event
        const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
        
        // Try to place after the last overlapping event
        const lastOverlapping = overlapping.reduce((latest, event) => 
            (event.startTime + event.duration) > (latest.startTime + latest.duration) ? event : latest
        );
        
        const suggestedStart = lastOverlapping.startTime + lastOverlapping.duration + 0.1;
        
        // Make sure it fits within video duration
        if (suggestedStart + newEvent.duration <= this.app.duration) {
            newEvent.startTime = suggestedStart;
        } else {
            // Try to place before the first overlapping event
            const firstOverlapping = overlapping.reduce((earliest, event) => 
                event.startTime < earliest.startTime ? event : earliest
            );
            
            const suggestedStartBefore = firstOverlapping.startTime - newEvent.duration - 0.1;
            
            if (suggestedStartBefore >= 0) {
                newEvent.startTime = suggestedStartBefore;
            } else {
                // Shorten duration to fit
                newEvent.duration = Math.max(0.5, firstOverlapping.startTime - newEvent.startTime - 0.1);
            }
        }
        
        return newEvent;
    }

    showCenterPoint(zoomEvent) {
        this.hideCenterPoint(); // Remove any existing center point
        
        const canvasRect = this.app.canvasElement.getBoundingClientRect();
        const region = zoomEvent.region;
        
        // Calculate center point position on canvas
        const centerX = (region.x + region.width / 2) * canvasRect.width;
        const centerY = (region.y + region.height / 2) * canvasRect.height;
        
        // Create center point element
        this.centerPoint = document.createElement('div');
        this.centerPoint.className = 'zoom-center-point';
        this.centerPoint.style.left = centerX + 'px';
        this.centerPoint.style.top = centerY + 'px';
        
        // Add label
        const label = document.createElement('div');
        label.className = 'zoom-center-label';
        label.textContent = `${zoomEvent.level}x`;
        this.centerPoint.appendChild(label);
        
        // Add drag event listeners
        this.centerPoint.addEventListener('mousedown', (e) => this.handleCenterDragStart(e));
        
        // Append to canvas container
        this.app.canvasElement.parentElement.appendChild(this.centerPoint);
    }
    
    hideCenterPoint() {
        if (this.centerPoint) {
            this.centerPoint.remove();
            this.centerPoint = null;
        }
        this.isDraggingCenter = false;
        this.centerDragStart = null;
    }
    
    handleCenterDragStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.isDraggingCenter = true;
        this.centerPoint.classList.add('dragging');
        
        const rect = this.app.canvasElement.getBoundingClientRect();
        this.centerDragStart = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            pointLeft: parseFloat(this.centerPoint.style.left),
            pointTop: parseFloat(this.centerPoint.style.top),
            canvasRect: rect
        };
    }
    
    handleCenterDrag(e) {
        if (!this.isDraggingCenter || !this.centerDragStart) return;
        
        const deltaX = e.clientX - this.centerDragStart.mouseX;
        const deltaY = e.clientY - this.centerDragStart.mouseY;
        
        const newLeft = this.centerDragStart.pointLeft + deltaX;
        const newTop = this.centerDragStart.pointTop + deltaY;
        
        const canvasRect = this.centerDragStart.canvasRect;
        
        // Clamp to canvas bounds
        const clampedLeft = Math.max(0, Math.min(newLeft, canvasRect.width));
        const clampedTop = Math.max(0, Math.min(newTop, canvasRect.height));
        
        this.centerPoint.style.left = clampedLeft + 'px';
        this.centerPoint.style.top = clampedTop + 'px';
        
        // Update zoom region in real-time during drag
        if (this.selectedZoomIndex !== null && this.app.zoomEvents[this.selectedZoomIndex]) {
            const newCenterX = clampedLeft / canvasRect.width;
            const newCenterY = clampedTop / canvasRect.height;
            const currentRegion = this.app.zoomEvents[this.selectedZoomIndex].region;
            
            // Update region to center on new position while keeping the same size
            const region = {
                x: newCenterX - currentRegion.width / 2,
                y: newCenterY - currentRegion.height / 2,
                width: currentRegion.width,
                height: currentRegion.height
            };
            
            // Clamp region to stay within bounds
            region.x = Math.max(0, Math.min(region.x, 1 - region.width));
            region.y = Math.max(0, Math.min(region.y, 1 - region.height));
            
            // Update the zoom event
            this.app.zoomEvents[this.selectedZoomIndex].region = region;
            
            // Update real-time preview
            this.updateRealTimePreview();
        }
    }
    
    handleCenterDragEnd() {
        if (!this.isDraggingCenter) return;
        
        this.isDraggingCenter = false;
        this.centerPoint.classList.remove('dragging');
        
        // Update the zoom event center based on new position
        if (this.selectedZoomIndex !== null && this.app.zoomEvents[this.selectedZoomIndex]) {
            const canvasRect = this.app.canvasElement.getBoundingClientRect();
            const newLeft = parseFloat(this.centerPoint.style.left);
            const newTop = parseFloat(this.centerPoint.style.top);
            const currentRegion = this.app.zoomEvents[this.selectedZoomIndex].region;
            
            // Convert pixel positions back to relative coordinates for new center
            const newCenterX = newLeft / canvasRect.width;
            const newCenterY = newTop / canvasRect.height;
            
            // Update region to center on new position while keeping the same size
            const region = {
                x: newCenterX - currentRegion.width / 2,
                y: newCenterY - currentRegion.height / 2,
                width: currentRegion.width,
                height: currentRegion.height
            };
            
            // Clamp region to stay within bounds
            region.x = Math.max(0, Math.min(region.x, 1 - region.width));
            region.y = Math.max(0, Math.min(region.y, 1 - region.height));
            
            // Update the zoom event
            this.app.zoomEvents[this.selectedZoomIndex].region = region;
            
            // Update real-time preview
            this.updateRealTimePreview();
            
            console.log('Updated zoom center:', { newCenterX, newCenterY }, 'New region:', region);
        }
        
        this.centerDragStart = null;
    }

    updateRealTimePreview() {
        // Force video processor to update the frame to show changes immediately
        if (this.app.videoProcessor) {
            this.app.videoProcessor.processFrame();
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}