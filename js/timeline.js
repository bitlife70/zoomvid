class Timeline {
    constructor(canvas, app) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.app = app;
        this.cursor = document.getElementById('timelineCursor');
        this.cursorHandle = this.cursor.querySelector('.timeline-cursor-handle');
        this.isDragging = false;
        this.isDraggingCursor = false;
        this.editingZoom = null;
        this.editMode = null; // 'move', 'resize-start', 'resize-end'
        this.dragStart = null;
        
        this.setupEventListeners();
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        
        // Cursor handle drag events
        this.cursorHandle.addEventListener('mousedown', (e) => this.handleCursorDragStart(e));
        document.addEventListener('mousemove', (e) => this.handleCursorDrag(e));
        document.addEventListener('mouseup', () => this.handleCursorDragEnd());
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on a zoom event
        const zoomHit = this.getZoomEventAtPosition(x, y);
        
        if (zoomHit) {
            this.editingZoom = zoomHit.index;
            this.editMode = zoomHit.mode;
            this.dragStart = { x, originalEvent: { ...this.app.zoomEvents[zoomHit.index] } };
            this.canvas.style.cursor = this.getCursorForMode(zoomHit.mode);
            
            // Select the zoom event for editing
            this.app.zoomController.selectZoomEvent(zoomHit.index);
        } else {
            // Always allow timeline scrubbing, but prioritize zoom editing
            this.isDragging = true;
            this.updateTimeFromMouse(e);
            
            // Deselect zoom events when clicking in empty space (not on zoom bars)
            this.app.zoomController.selectZoomEvent(null);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.editingZoom !== null && this.dragStart) {
            this.updateZoomEvent(x);
        } else if (this.isDragging) {
            this.updateTimeFromMouse(e);
        } else {
            // Update cursor based on hover
            const zoomHit = this.getZoomEventAtPosition(x, y);
            this.canvas.style.cursor = zoomHit ? this.getCursorForMode(zoomHit.mode) : 'pointer';
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.editingZoom = null;
        this.editMode = null;
        this.dragStart = null;
        this.canvas.style.cursor = 'pointer';
        
        if (this.editingZoom !== null) {
            this.app.zoomController.updateZoomEventsList();
        }
    }

    handleCursorDragStart(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingCursor = true;
        this.cursor.classList.add('dragging');
    }

    handleCursorDrag(e) {
        if (!this.isDraggingCursor) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const time = percentage * this.app.duration;
        
        this.app.seekTo(time);
    }

    handleCursorDragEnd() {
        if (this.isDraggingCursor) {
            this.isDraggingCursor = false;
            this.cursor.classList.remove('dragging');
        }
    }

    updateTimeFromMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * this.app.duration;
        
        this.app.seekTo(time);
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.draw();
    }

    initialize() {
        this.resize();
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw time markers
        this.drawTimeMarkers();
        
        // Draw zoom event markers
        this.drawZoomMarkers();
        
        // Draw waveform placeholder
        this.drawWaveformPlaceholder();
    }

    drawTimeMarkers() {
        if (!this.app.duration) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const duration = this.app.duration;
        
        // Calculate appropriate interval for time markers
        const intervals = [0.5, 1, 2, 5, 10, 30, 60];
        const targetMarkers = 10;
        const idealInterval = duration / targetMarkers;
        const interval = intervals.find(i => i >= idealInterval) || intervals[intervals.length - 1];
        
        ctx.strokeStyle = '#555';
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        for (let time = 0; time <= duration; time += interval) {
            const x = (time / duration) * width;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(x, height - 20);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Draw time label
            const timeText = this.formatTimeForTimeline(time);
            ctx.fillText(timeText, x, height - 25);
        }
    }

    drawZoomMarkers() {
        if (!this.app.zoomEvents.length || !this.app.duration) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const duration = this.app.duration;
        
        // First, draw connection indicators for adjacent zoom events
        this.drawZoomConnections(ctx, width, height, duration);
        
        this.app.zoomEvents.forEach((zoomEvent, index) => {
            const startX = (zoomEvent.startTime / duration) * width;
            const endX = ((zoomEvent.startTime + zoomEvent.duration) / duration) * width;
            const barHeight = height - 30;
            const isSelected = this.selectedZoomIndex === index;
            
            // Draw zoom event rectangle with selection highlighting
            ctx.fillStyle = isSelected ? 'rgba(0, 168, 255, 0.6)' : 'rgba(0, 168, 255, 0.3)';
            ctx.fillRect(startX, 10, endX - startX, barHeight);
            
            // Draw zoom event border with selection highlighting
            ctx.strokeStyle = isSelected ? '#ffaa00' : '#00a8ff';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.strokeRect(startX, 10, endX - startX, barHeight);
            
            // Draw resize handles
            const handleSize = 8;
            const handleHeight = barHeight;
            
            // Left handle
            ctx.fillStyle = '#00a8ff';
            ctx.fillRect(startX - handleSize/2, 10, handleSize, handleHeight);
            
            // Right handle  
            ctx.fillRect(endX - handleSize/2, 10, handleSize, handleHeight);
            
            // Draw zoom level indicator
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            const zoomText = `${zoomEvent.level}x`;
            ctx.fillText(zoomText, startX + 4, 25);
            
            // Draw duration indicator
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            const durationText = `${zoomEvent.duration.toFixed(1)}s`;
            const centerX = (startX + endX) / 2;
            ctx.fillText(durationText, centerX, height - 32);
        });
    }

    drawZoomConnections(ctx, width, height, duration) {
        const sortedEvents = [...this.app.zoomEvents].sort((a, b) => a.startTime - b.startTime);
        
        for (let i = 0; i < sortedEvents.length - 1; i++) {
            const currentEvent = sortedEvents[i];
            const nextEvent = sortedEvents[i + 1];
            
            const currentEndX = ((currentEvent.startTime + currentEvent.duration) / duration) * width;
            const nextStartX = (nextEvent.startTime / duration) * width;
            const gap = nextStartX - currentEndX;
            
            // Check if events are connected (gap <= 0.1 seconds worth of pixels)
            const connectionThreshold = (0.1 / duration) * width; // 0.1 seconds in pixels
            
            if (gap <= connectionThreshold) {
                // Draw connection indicator
                ctx.save();
                
                // Draw a thick line connecting the two events
                ctx.strokeStyle = '#27ae60'; // Green color for connections
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                
                const connectionY = height - 15; // Bottom of the timeline
                
                ctx.beginPath();
                ctx.moveTo(currentEndX, connectionY);
                ctx.lineTo(nextStartX, connectionY);
                ctx.stroke();
                
                // Draw small indicators at the connection points
                ctx.fillStyle = '#27ae60';
                
                // Connection indicator at end of first event
                ctx.beginPath();
                ctx.arc(currentEndX, connectionY, 3, 0, 2 * Math.PI);
                ctx.fill();
                
                // Connection indicator at start of second event
                ctx.beginPath();
                ctx.arc(nextStartX, connectionY, 3, 0, 2 * Math.PI);
                ctx.fill();
                
                // Draw connection label if there's space
                const connectionCenterX = (currentEndX + nextStartX) / 2;
                if (gap > 20) { // Only show label if there's enough space
                    ctx.fillStyle = '#27ae60';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('연결', connectionCenterX, connectionY - 8);
                }
                
                ctx.restore();
            }
        }
    }

    drawWaveformPlaceholder() {
        if (!this.app.duration) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Draw simplified waveform representation
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const centerY = height / 2;
        const segments = Math.floor(width / 4);
        
        for (let i = 0; i < segments; i++) {
            const x = (i / segments) * width;
            const amplitude = Math.random() * 15 + 5;
            const y1 = centerY - amplitude;
            const y2 = centerY + amplitude;
            
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
        }
        
        ctx.stroke();
    }

    updateCursor() {
        if (!this.app.duration) return;
        
        const percentage = this.app.currentTime / this.app.duration;
        const containerWidth = this.canvas.parentElement.clientWidth;
        const cursorX = percentage * containerWidth;
        
        this.cursor.style.left = cursorX + 'px';
    }

    updateZoomMarkers() {
        this.draw();
    }

    getZoomEventAtPosition(x, y) {
        if (!this.app.zoomEvents.length || !this.app.duration) return null;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const duration = this.app.duration;
        const handleSize = 8;
        
        for (let i = 0; i < this.app.zoomEvents.length; i++) {
            const zoomEvent = this.app.zoomEvents[i];
            const startX = (zoomEvent.startTime / duration) * width;
            const endX = ((zoomEvent.startTime + zoomEvent.duration) / duration) * width;
            
            // Check if in zoom event area (y between 10 and height-30)
            if (y >= 10 && y <= height - 30) {
                // Check for resize handles (first/last 8px)
                if (x >= startX - handleSize/2 && x <= startX + handleSize/2) {
                    return { index: i, mode: 'resize-start' };
                }
                if (x >= endX - handleSize/2 && x <= endX + handleSize/2) {
                    return { index: i, mode: 'resize-end' };
                }
                // Check for move (middle area)
                if (x >= startX && x <= endX) {
                    return { index: i, mode: 'move' };
                }
            }
        }
        return null;
    }

    getCursorForMode(mode) {
        switch (mode) {
            case 'resize-start':
            case 'resize-end':
                return 'ew-resize';
            case 'move':
                return 'move';
            default:
                return 'pointer';
        }
    }

    updateZoomEvent(x) {
        if (this.editingZoom === null || !this.dragStart) return;
        
        const duration = this.app.duration;
        const width = this.canvas.width;
        const deltaX = x - this.dragStart.x;
        const deltaTime = (deltaX / width) * duration;
        
        const zoomEvent = this.app.zoomEvents[this.editingZoom];
        const originalEvent = this.dragStart.originalEvent;
        
        switch (this.editMode) {
            case 'move':
                // Move entire event
                const newStartTime = Math.max(0, Math.min(
                    originalEvent.startTime + deltaTime,
                    duration - originalEvent.duration
                ));
                zoomEvent.startTime = newStartTime;
                break;
                
            case 'resize-start':
                // Resize from start
                const newStart = Math.max(0, Math.min(
                    originalEvent.startTime + deltaTime,
                    originalEvent.startTime + originalEvent.duration - 0.5
                ));
                const newDuration = originalEvent.startTime + originalEvent.duration - newStart;
                zoomEvent.startTime = newStart;
                zoomEvent.duration = Math.max(0.5, newDuration);
                break;
                
            case 'resize-end':
                // Resize from end
                const maxDuration = duration - originalEvent.startTime;
                const newDur = Math.max(0.5, Math.min(
                    originalEvent.duration + deltaTime,
                    maxDuration
                ));
                zoomEvent.duration = newDur;
                break;
        }
        
        // Check for overlaps and prevent them
        this.preventEditingOverlaps(this.editingZoom);
        
        // Re-sort events by start time
        this.app.zoomEvents.sort((a, b) => a.startTime - b.startTime);
        this.draw();
    }

    preventEditingOverlaps(editingIndex) {
        const events = this.app.zoomEvents;
        const editingEvent = events[editingIndex];
        
        // Check for overlaps with other events
        for (let i = 0; i < events.length; i++) {
            if (i === editingIndex) continue;
            
            const otherEvent = events[i];
            const editStart = editingEvent.startTime;
            const editEnd = editingEvent.startTime + editingEvent.duration;
            const otherStart = otherEvent.startTime;
            const otherEnd = otherEvent.startTime + otherEvent.duration;
            
            // Check if they overlap (with small gap tolerance for smooth transitions)
            const gap = 0.05; // 50ms tolerance for seamless transitions
            
            if (editStart < otherEnd - gap && editEnd > otherStart + gap) {
                // Resolve overlap by moving the editing event, not resizing it
                if (editStart < otherStart) {
                    // Editing event starts before other, move it to end just before the other event
                    const newStartTime = otherStart - editingEvent.duration - gap;
                    if (newStartTime >= 0) {
                        editingEvent.startTime = newStartTime;
                    } else {
                        // If it can't fit before, move it after
                        editingEvent.startTime = otherEnd + gap;
                        if (editingEvent.startTime + editingEvent.duration > this.app.duration) {
                            editingEvent.startTime = this.app.duration - editingEvent.duration;
                        }
                    }
                } else {
                    // Editing event starts after other, move it after the other event
                    editingEvent.startTime = otherEnd + gap;
                    if (editingEvent.startTime + editingEvent.duration > this.app.duration) {
                        // If it doesn't fit after, try to place it before
                        const newStartTime = otherStart - editingEvent.duration - gap;
                        if (newStartTime >= 0) {
                            editingEvent.startTime = newStartTime;
                        } else {
                            // If nowhere to fit, keep at end but within bounds
                            editingEvent.startTime = Math.max(0, this.app.duration - editingEvent.duration);
                        }
                    }
                }
            }
        }
    }

    formatTimeForTimeline(seconds) {
        if (seconds < 60) {
            return seconds.toFixed(1) + 's';
        } else {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }
}