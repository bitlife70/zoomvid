# ZoomVid - Video Zoom Editor

A web-based video editing application that allows users to upload video clips and apply dynamic zoom effects to selected areas at specific timelines.

## Features

- **Video Upload**: Support for MP4, MOV, AVI, WebM formats (up to 100MB)
- **Timeline Editor**: Visual timeline with frame-accurate navigation
- **Zoom Region Selection**: Click and drag to select rectangular zoom areas on video
- **Dynamic Zoom Effects**: Smooth zoom transitions with customizable intensity (1.1x to 5.0x)
- **Real-time Preview**: Live preview of zoom effects during editing
- **Export & Download**: Export edited videos with zoom effects applied

## Getting Started

### Prerequisites

- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)
- Node.js (for development server)

### Installation

1. Clone or download the project files
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

1. Start the development server:
   ```bash
   npm start
   ```
2. Open your browser and go to `http://localhost:3000`

## Usage

1. **Upload Video**: Click "Upload Video" or drag and drop a video file
2. **Navigate Timeline**: Use the timeline scrubber to navigate through your video
3. **Add Zoom Effect**:
   - Click "Add Zoom Effect"
   - Select the area you want to zoom into by clicking and dragging
   - Adjust zoom level (1.1x to 5.0x) and duration
4. **Preview**: Play the video to see zoom effects in real-time
5. **Export**: Click "Export Video" to download the edited video

## Project Structure

```
zoomvid/
├── index.html          # Main HTML structure
├── styles.css          # Application styles
├── js/
│   ├── app.js           # Main application logic
│   ├── timeline.js      # Timeline component
│   ├── zoomController.js # Zoom region selection
│   └── videoProcessor.js # Video processing and export
├── package.json         # Project configuration
├── PRD.md              # Product Requirements Document
└── README.md           # This file
```

## Technical Details

### Core Technologies
- **HTML5 Canvas**: For video rendering and zoom effects
- **MediaRecorder API**: For video export functionality
- **File API**: For video upload handling
- **Vanilla JavaScript**: No framework dependencies

### Browser Compatibility
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

### File Size Limitations
- Maximum video size: 100MB
- Maximum duration: 5 minutes
- Supported resolutions: Up to 1080p

## Features Overview

### Video Processing
- Real-time canvas-based video processing
- Smooth zoom transitions with easing functions
- Frame-accurate timeline navigation

### User Interface
- Responsive design for desktop and mobile
- Intuitive drag-and-drop video upload
- Visual timeline with zoom event markers
- Real-time zoom region selection overlay

### Export Options
- WebM format output (native browser support)
- Maintains original video quality during zoom
- Progress indication during export

## Future Enhancements

- Multiple zoom regions simultaneously
- Zoom tracking for moving objects
- Audio ducking during zoom events
- Batch processing multiple videos
- Additional export formats (MP4 with server processing)
- Cloud storage integration

## Contributing

This is a demonstration project. For production use, consider:
- Adding server-side video processing for better export formats
- Implementing user authentication and cloud storage
- Adding more advanced video editing features
- Optimizing for larger file sizes and longer videos

## License

MIT License - See PRD.md for full project requirements and specifications.