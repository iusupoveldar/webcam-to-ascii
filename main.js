import init, { process_frame } from './pkg/webcam_to_ascii.js';

// Global Variables
let currentImage = null;
const baseFontSize = 10;
let galleryData = [];
let animationId = null;

// Webcam Setup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Wasm
  await init();

  const video = document.getElementById('webcam');
  const processingCanvas = document.getElementById('canvas');
  const processingCtx = processingCanvas.getContext('2d', { willReadFrequently: true });
  const asciiCanvas = document.getElementById('ascii-canvas');
  const asciiCtx = asciiCanvas.getContext('2d', { alpha: false });

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
        processingCanvas.width = 320;
        processingCanvas.height = Math.round(320 * (video.videoHeight / video.videoWidth));
        processingCtx.filter = `blur(${parseFloat(document.getElementById('blur').value)}px)`;
        processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
        processingCtx.filter = 'none'; // Reset filter

        const imageData = processingCtx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);

        // Prepare options
        const options = {
          ascii_width: parseInt(document.getElementById('asciiWidth').value, 10),
          brightness: parseFloat(document.getElementById('brightness').value),
          contrast: parseFloat(document.getElementById('contrast').value),
          dithering: document.getElementById('dithering').checked,
          dither_algo: document.getElementById('ditherAlgorithm').value,
          invert: document.getElementById('invert').checked,
          ignore_white: document.getElementById('ignoreWhite').checked,
          charset: document.getElementById('charset').value,
          color_mode: document.getElementById('colorMode').value,
          edge_method: document.querySelector('input[name="edgeMethod"]:checked').value,
          edge_threshold: parseFloat(document.getElementById('edgeThreshold').value),
          zoom: parseInt(document.getElementById('zoom').value, 10) / 100,
          primary_color: getComputedStyle(document.body).getPropertyValue('--primary-color').trim(),
          manual_char: document.getElementById('manualCharInput').value || "0",
          is_manual: document.getElementById('charset').value === 'manual'
        };

        // Call Rust
        try {
          process_frame(asciiCtx, processingCanvas.width, processingCanvas.height, imageData.data, options);
        } catch (e) {
          console.error("Wasm Error:", e);
        }
      }
      animationId = requestAnimationFrame(processFrame);
    }
    animationId = requestAnimationFrame(processFrame);
  }
});

// Gallery Functions
function snapImage() {
  const canvas = document.getElementById('ascii-canvas');
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
  const stats = document.getElementById('memoryStats');
  grid.innerHTML = "";

  let totalBytes = 0;

  galleryData.forEach(snap => {
    // Calculate size (rough estimation for base64 string)
    const sizeBytes = snap.image.length;
    totalBytes += sizeBytes;
    const sizeKB = (sizeBytes / 1024).toFixed(1);

    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${snap.image}" style="width: 100%; border: 1px solid #0f0;">
      <div style="font-size: 0.8em; margin-bottom: 5px;">${snap.timestamp}</div>
      <div style="font-size: 0.7em; color: #888; margin-bottom: 5px;">SIZE: ${sizeKB} KB</div>
      <div class="gallery-actions">
        <button onclick="downloadSnap(${snap.id})">SAVE</button>
        <button onclick="deleteSnap(${snap.id})">DEL</button>
      </div>
    `;
    grid.appendChild(div);
  });

  const totalKB = (totalBytes / 1024).toFixed(1);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  // LocalStorage limit 5MB (5120KB)
  const limitKB = 5120;
  const percent = Math.min(100, (totalBytes / (limitKB * 1024)) * 100).toFixed(1);

  stats.innerHTML = `USAGE: ${totalKB}KB / 5MB (${percent}%)`;
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
