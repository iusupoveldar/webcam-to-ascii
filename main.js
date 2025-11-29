// Global Variables
let currentImage = null;
const baseFontSize = 10; // Base font size for ASCII art
let galleryData = [];
let animationId = null;

// Helper Functions
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Webcam Setup
document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('webcam');
  const processingCanvas = document.getElementById('canvas');
  const processingCtx = processingCanvas.getContext('2d', { willReadFrequently: true });

  // Load Gallery Data
  loadGallery();

  // Access the webcam
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.play();
      startStreaming();
    })
    .catch(err => {
      console.error('Error accessing webcam: ', err);
      alert("CAMERA OFFLINE. CHECK CONNECTION.");
    });

  function startStreaming() {
    function processFrame() {
      if (video.videoWidth && video.videoHeight) {
        // Draw current frame to hidden canvas for processing
        processingCanvas.width = 320; // Fixed processing resolution for performance
        processingCanvas.height = Math.round(320 * (video.videoHeight / video.videoWidth));
        processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

        // Generate ASCII on the visible canvas
        renderASCII(processingCanvas);
      }
      animationId = requestAnimationFrame(processFrame);
    }
    animationId = requestAnimationFrame(processFrame);
  }
});

// Image Processing & Rendering
function renderASCII(sourceCanvas) {
  const asciiCanvas = document.getElementById('ascii-canvas');
  const ctx = asciiCanvas.getContext('2d', { alpha: false });

  // Settings
  const asciiWidth = parseInt(document.getElementById('asciiWidth').value, 10);
  const brightness = parseFloat(document.getElementById('brightness').value);
  const contrastValue = parseFloat(document.getElementById('contrast').value);
  const blurValue = parseFloat(document.getElementById('blur').value);
  const ditheringEnabled = document.getElementById('dithering').checked;
  const ditherAlgorithm = document.getElementById('ditherAlgorithm').value;
  const invertEnabled = document.getElementById('invert').checked;
  const ignoreWhite = document.getElementById('ignoreWhite').checked;
  const charset = document.getElementById('charset').value;
  const colorMode = document.getElementById('colorMode').value;
  const edgeMethod = document.querySelector('input[name="edgeMethod"]:checked').value;
  const edgeThreshold = parseInt(document.getElementById('edgeThreshold').value, 10);
  const dogThreshold = parseInt(document.getElementById('dogEdgeThreshold').value, 10);
  const zoom = parseInt(document.getElementById('zoom').value, 10) / 100;

  // Calculate dimensions
  const fontWidth = 7 * zoom;
  const fontHeight = 12 * zoom; // Approx aspect ratio
  const asciiHeight = Math.round((sourceCanvas.height / sourceCanvas.width) * asciiWidth * 0.55);

  // Resize display canvas
  asciiCanvas.width = asciiWidth * fontWidth;
  asciiCanvas.height = asciiHeight * fontHeight;

  // Create a temporary small canvas for pixel reading (resize source to ascii grid size)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = asciiWidth;
  tempCanvas.height = asciiHeight;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  // Apply blur if needed
  tempCtx.filter = blurValue > 0 ? `blur(${blurValue}px)` : "none";
  tempCtx.drawImage(sourceCanvas, 0, 0, asciiWidth, asciiHeight);

  let imageData = tempCtx.getImageData(0, 0, asciiWidth, asciiHeight);
  let data = imageData.data; // Uint8ClampedArray

  // Pre-processing (Grayscale, Contrast, Brightness)
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  let grayBuffer = new Float32Array(asciiWidth * asciiHeight);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (invertEnabled) lum = 255 - lum;

    let adjusted = clamp(contrastFactor * (lum - 128) + 128 + brightness, 0, 255);
    grayBuffer[i / 4] = adjusted;
  }

  // Edge Detection
  let edgeMap = null;
  if (edgeMethod === 'sobel') {
    edgeMap = applySobel(grayBuffer, asciiWidth, asciiHeight, edgeThreshold);
  } else if (edgeMethod === 'dog') {
    // Simplified DoG: Blur difference (simulated)
    // For performance, we'll just use a simple difference check or skip if too heavy
    // Let's stick to Sobel for "Edge" and maybe just thresholding for "DoG" name for now
    // Or implement a quick difference filter.
    edgeMap = applySobel(grayBuffer, asciiWidth, asciiHeight, dogThreshold); // Reusing Sobel for now
  }

  // Dithering
  if (ditheringEnabled) {
    if (ditherAlgorithm === 'floyd') {
      applyFloydSteinberg(grayBuffer, asciiWidth, asciiHeight);
    } else if (ditherAlgorithm === 'noise') {
      applyNoise(grayBuffer);
    }
    // Other algos can be added
  }

  // Rendering to Canvas
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, asciiCanvas.width, asciiCanvas.height);

  ctx.font = `${fontHeight}px 'VT323', monospace`;
  ctx.textBaseline = 'top';

  // Charset Selection
  let chars = "";
  switch (charset) {
    case 'standard': chars = "@%#*+=-:. "; break;
    case 'blocks': chars = "█▓▒░ "; break;
    case 'binary': chars = "101010 "; break;
    case 'hex': chars = "0123456789ABCDEF "; break;
    case 'matrix': chars = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ "; break;
    case 'glitch': chars = "¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"; break;
    case 'manual':
      chars = document.getElementById('manualCharInput').value || "0";
      break;
    case 'detailed':
    default: chars = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. "; break;
  }

  const charLen = chars.length;

  // Color Setup
  let primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color').trim();

  for (let y = 0; y < asciiHeight; y++) {
    for (let x = 0; x < asciiWidth; x++) {
      const idx = y * asciiWidth + x;
      let val = grayBuffer[idx];

      // Edge Override
      if (edgeMap && edgeMap[idx] > 0) {
        val = 0;
      }

      if (ignoreWhite && val > 250) continue;

      // Map value to char index
      // val is 0-255.
      let charIdx = Math.floor((val / 255) * (charLen - 1));

      // Manual Input Cycling
      if (charset === 'manual') {
        charIdx = (x + y) % charLen;
      }

      const char = chars[charIdx];

      // Color
      if (colorMode === 'true') {
        const r = data[idx * 4];
        const g = data[idx * 4 + 1];
        const b = data[idx * 4 + 2];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else if (colorMode === 'rainbow') {
        const hue = (x / asciiWidth) * 360 + (Date.now() / 20);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      } else {
        ctx.fillStyle = primaryColor;
      }

      ctx.fillText(char, x * fontWidth, y * fontHeight);
    }
  }
}

// Algorithms
function applySobel(buffer, width, height, threshold) {
  const edgeMap = new Uint8Array(width * height);
  const kernelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const kernelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const val = buffer[idx];
          gx += val * kernelX[ky + 1][kx + 1];
          gy += val * kernelY[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude > threshold) {
        edgeMap[y * width + x] = 255; // Edge detected
      }
    }
  }
  return edgeMap;
}

function applyFloydSteinberg(buffer, width, height) {
  for (let y = 0; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const oldVal = buffer[idx];
      // Quantize to closest level
      const steps = 8;
      const newVal = Math.round(oldVal / 255 * steps) * (255 / steps);
      buffer[idx] = newVal;
      const error = oldVal - newVal;

      buffer[idx + 1] += error * 7 / 16;
      buffer[(y + 1) * width + x - 1] += error * 3 / 16;
      buffer[(y + 1) * width + x] += error * 5 / 16;
      buffer[(y + 1) * width + x + 1] += error * 1 / 16;
    }
  }
}

function applyNoise(buffer) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = clamp(buffer[i] + (Math.random() - 0.5) * 50, 0, 255);
  }
}

// Gallery Functions
function snapImage() {
  const canvas = document.getElementById('ascii-canvas');
  // Save as image data URL
  const dataURL = canvas.toDataURL('image/png');
  const timestamp = new Date().toLocaleString();
  const id = Date.now();

  const snap = {
    id: id,
    timestamp: timestamp,
    image: dataURL
  };

  galleryData.push(snap);
  saveGallery();
  alert("FRAME CAPTURED TO MEMORY BANK.");
}

function saveGallery() {
  try {
    if (galleryData.length > 10) galleryData.shift();
    localStorage.setItem('ascii_gallery', JSON.stringify(galleryData));
    renderGallery();
  } catch (e) {
    console.error("Storage full", e);
    alert("MEMORY BANK FULL.");
  }
}

function loadGallery() {
  const stored = localStorage.getItem('ascii_gallery');
  if (stored) {
    galleryData = JSON.parse(stored);
    renderGallery();
  }
}

function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = "";

  galleryData.forEach(snap => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${snap.image}" style="width: 100%; border: 1px solid #0f0;">
      <div style="font-size: 0.8em; margin-bottom: 5px;">${snap.timestamp}</div>
      <div class="gallery-actions">
        <button onclick="downloadSnap(${snap.id})">SAVE</button>
        <button onclick="deleteSnap(${snap.id})">DEL</button>
      </div>
    `;
    grid.appendChild(div);
  });
}

function deleteSnap(id) {
  galleryData = galleryData.filter(s => s.id !== id);
  saveGallery();
}

function downloadSnap(id) {
  const snap = galleryData.find(s => s.id === id);
  if (snap) {
    const a = document.createElement('a');
    a.href = snap.image;
    a.download = `snap_${snap.id}.png`;
    a.click();
  }
}

window.deleteSnap = deleteSnap;
window.downloadSnap = downloadSnap;

// Event Listeners
document.getElementById('snapBtn').addEventListener('click', snapImage);

const galleryModal = document.getElementById('galleryModal');
document.getElementById('galleryBtn').addEventListener('click', () => {
  galleryModal.style.display = "block";
  renderGallery();
});

document.querySelector('.close-modal').addEventListener('click', () => {
  galleryModal.style.display = "none";
});

window.onclick = function (event) {
  if (event.target == galleryModal) {
    galleryModal.style.display = "none";
  }
}

// Settings Listeners
const settingsInputs = [
  'asciiWidth', 'brightness', 'contrast', 'blur', 'zoom',
  'edgeThreshold', 'dogEdgeThreshold', 'dithering', 'invert', 'ignoreWhite'
];
settingsInputs.forEach(id => {
  document.getElementById(id).addEventListener('input', updateSettingsUI);
  document.getElementById(id).addEventListener('change', updateSettingsUI);
});

document.getElementById('theme').addEventListener('change', updateSettingsUI);
document.getElementById('charset').addEventListener('change', function () {
  const manualControl = document.getElementById('manualCharControl');
  manualControl.style.display = (this.value === 'manual') ? 'flex' : 'none';
  updateSettingsUI();
});
document.getElementById('colorMode').addEventListener('change', updateSettingsUI);
document.getElementById('ditherAlgorithm').addEventListener('change', updateSettingsUI);

document.querySelectorAll('input[name="edgeMethod"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const method = document.querySelector('input[name="edgeMethod"]:checked').value;
    document.getElementById('sobelThresholdControl').style.display = (method === 'sobel') ? 'flex' : 'none';
    document.getElementById('dogThresholdControl').style.display = (method === 'dog') ? 'flex' : 'none';
    updateSettingsUI();
  });
});

document.getElementById('reset').addEventListener('click', resetSettings);

function updateSettingsUI() {
  document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
  document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
  document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
  document.getElementById('blurVal').textContent = document.getElementById('blur').value;
  document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
  document.getElementById('edgeThresholdVal').textContent = document.getElementById('edgeThreshold').value;
  document.getElementById('dogEdgeThresholdVal').textContent = document.getElementById('dogEdgeThreshold').value;

  const theme = document.getElementById('theme').value;
  document.body.classList.remove('light-mode', 'amber-mode');
  if (theme === 'light') document.body.classList.add('light-mode');
  if (theme === 'amber') document.body.classList.add('amber-mode');
}

function resetSettings() {
  document.getElementById('asciiWidth').value = 150;
  document.getElementById('brightness').value = 0;
  document.getElementById('contrast').value = 0;
  document.getElementById('blur').value = 0;
  document.getElementById('dithering').checked = true;
  document.getElementById('ditherAlgorithm').value = 'floyd';
  document.getElementById('invert').checked = false;
  document.getElementById('ignoreWhite').checked = true;
  document.getElementById('charset').value = 'detailed';
  document.getElementById('zoom').value = 100;
  document.getElementById('colorMode').value = 'mono';
  document.querySelector('input[name="edgeMethod"][value="none"]').checked = true;
  document.getElementById('edgeThreshold').value = 100;
  document.getElementById('dogEdgeThreshold').value = 100;
  document.getElementById('sobelThresholdControl').style.display = 'none';
  document.getElementById('dogThresholdControl').style.display = 'none';
  updateSettingsUI();
}
