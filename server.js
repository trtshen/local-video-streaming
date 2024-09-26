const express = require('express');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Route to handle video streaming
function startStreaming(res) {
  const videoPath = path.join(__dirname, 'videos', 'sample.mp4');

  // Check if the video file exists
  if (!fs.existsSync(videoPath)) {
    console.error('Video file not found:', videoPath);
    if (!res.headersSent) {
      res.status(404).send('Video file not found');
    }
    return;
  }

  // ffmpeg command to extract frames from the video with explicit pixel format
  const ffmpeg = child_process.spawn('ffmpeg', [
    '-i', videoPath,
    '-vf', 'fps=1,format=yuvj420p', // Extract 1 frame per second and set pixel format
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-'
  ]);

  ffmpeg.stdout.on('data', (data) => {
    res.write(`--frame\r\n`);
    res.write(`Content-Type: image/jpeg\r\n`);
    res.write(`Content-Length: ${data.length}\r\n`);
    res.write(`\r\n`);
    res.write(data);
    res.write(`\r\n`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`ffmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`ffmpeg process exited with code ${code}`);
    // Do not restart streaming here to avoid header issues
    setTimeout(() => {
      startStreaming(res);
    }, 1000);
  });

  ffmpeg.on('error', (err) => {
    console.error(`Failed to start ffmpeg: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).send('Failed to start ffmpeg');
    }
  });

  // Clean up the process if the client closes the connection
  res.on('close', () => {
    console.log('client closed connection, killing ffmpeg');
    ffmpeg.kill();
  });
}

// Route to handle video streaming
app.get('/video', (req, res) => {
  res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
  startStreaming(res);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  res.sendFile(indexPath);
});