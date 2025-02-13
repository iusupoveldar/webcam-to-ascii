// ---------------- Global Variables ----------------
let currentImage = null;
const baseFontSize = 7; // Base font size for ASCII art

// ---------------- Helper Functions ----------------

// Clamp a value between min and max.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ---------------- Webcam Setup ----------------
document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Access the webcam
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.play();
      startStreaming();
    })
    .catch(err => {
      console.error('Error accessing webcam: ', err);
    });

  // Continuously process the webcam video
  function startStreaming() {
    function processFrame() {
      if (video.videoWidth && video.videoHeight) {
        // Draw the current frame into the canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Create an image from the canvas data
        currentImage = new Image();
        currentImage.src = canvas.toDataURL();
        currentImage.onload = () => {
          generateASCII(currentImage);
        };
      }
      requestAnimationFrame(processFrame);
    }
    requestAnimationFrame(processFrame);
  }
});

// ---------------- ASCII Art Generation Functions ----------------

function generateASCII(img) {
  const edgeMethod = document.querySelector('input[name="edgeMethod"]:checked').value;
  if (edgeMethod === 'dog') {
    generateContourASCII(img);
    return;
  }
  
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const asciiWidth = parseInt(document.getElementById('asciiWidth').value, 10);
  const brightness = parseFloat(document.getElementById('brightness').value);
  const contrastValue = parseFloat(document.getElementById('contrast').value);
  const blurValue = parseFloat(document.getElementById('blur').value);
  const ditheringEnabled = document.getElementById('dithering').checked;
  const ditherAlgorithm = document.getElementById('ditherAlgorithm').value;
  const invertEnabled = document.getElementById('invert').checked;
  const ignoreWhite = document.getElementById('ignoreWhite').checked;
  const charset = document.getElementById('charset').value;

  let gradient;
  switch (charset) {
    case 'standard': gradient = "@%#*+=-:."; break;
    case 'blocks': gradient = "█▓▒░ "; break;
    case 'binary': gradient = "01"; break;
    case 'manual':
      const manualChar = document.getElementById('manualCharInput').value || "0";
      gradient = manualChar + " ";
      break;
    case 'hex': gradient = "0123456789ABCDEF"; break;
    case 'detailed':
    default: gradient = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'.";
      break;
  }
  
  const nLevels = gradient.length;
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const fontAspectRatio = 0.55;
  const asciiHeight = Math.round((img.height / img.width) * asciiWidth * fontAspectRatio);

  // Resize the image to the ASCII dimensions
  canvas.width = asciiWidth;
  canvas.height = asciiHeight;
  ctx.filter = blurValue > 0 ? `blur(${blurValue}px)` : "none";
  ctx.drawImage(img, 0, 0, asciiWidth, asciiHeight);

  const imageData = ctx.getImageData(0, 0, asciiWidth, asciiHeight);
  const data = imageData.data;
  let gray = [], grayOriginal = [];
  for (let i = 0; i < data.length; i += 4) {
    let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (invertEnabled) lum = 255 - lum;
    let adjusted = clamp(contrastFactor * (lum - 128) + 128 + brightness, 0, 255);
    gray.push(adjusted);
    grayOriginal.push(adjusted);
  }

  let ascii = "";
  // For simplicity, we're using simple mapping (no dithering/edge)
  for (let y = 0; y < asciiHeight; y++) {
    let line = "";
    for (let x = 0; x < asciiWidth; x++) {
      const idx = y * asciiWidth + x;
      if (ignoreWhite && grayOriginal[idx] === 255) {
        line += " ";
        continue;
      }
      const computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
      line += gradient.charAt(computedLevel);
    }
    ascii += line + "\n";
  }
  document.getElementById('ascii-art').textContent = ascii;
}

// Placeholder for contour-based ASCII (if needed)
function generateContourASCII(img) {
  // You can implement the DoG and Sobel-based method here.
  // For now, we simply call generateASCII.
  generateASCII(img);
}

// ---------------- File Upload (if used) ----------------

document.getElementById('upload').removeEventListener('change', handleFileUpload);
document.getElementById('upload').addEventListener('change', handleFileUpload);

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      currentImage = img;
      generateASCII(img);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// ---------------- Update and Reset Functions ----------------

document.getElementById('asciiWidth').addEventListener('input', updateSettings);
document.getElementById('brightness').addEventListener('input', updateSettings);
document.getElementById('contrast').addEventListener('input', updateSettings);
document.getElementById('blur').addEventListener('input', updateSettings);
document.getElementById('dithering').addEventListener('change', updateSettings);
document.getElementById('ditherAlgorithm').addEventListener('change', updateSettings);
document.getElementById('invert').addEventListener('change', updateSettings);
document.getElementById('ignoreWhite').addEventListener('change', updateSettings);
document.getElementById('theme').addEventListener('change', updateSettings);
document.getElementById('charset').addEventListener('change', function () {
  const manualControl = document.getElementById('manualCharControl');
  manualControl.style.display = (this.value === 'manual') ? 'flex' : 'none';
  updateSettings();
});
document.getElementById('zoom').addEventListener('input', updateSettings);
document.querySelectorAll('input[name="edgeMethod"]').forEach(function (radio) {
  radio.addEventListener('change', function () {
    const method = document.querySelector('input[name="edgeMethod"]:checked').value;
    document.getElementById('sobelThresholdControl').style.display = (method === 'sobel') ? 'flex' : 'none';
    document.getElementById('dogThresholdControl').style.display = (method === 'dog') ? 'flex' : 'none';
    updateSettings();
  });
});
document.getElementById('edgeThreshold').addEventListener('input', updateSettings);
document.getElementById('dogEdgeThreshold').addEventListener('input', updateSettings);
document.getElementById('reset').addEventListener('click', resetSettings);
document.getElementById('copyBtn').addEventListener('click', function () {
  const asciiText = document.getElementById('ascii-art').textContent;
  navigator.clipboard.writeText(asciiText).then(() => {
    alert('ASCII Art copied to clipboard!');
  }, () => {
    alert('Copy failed!');
  });
});
document.getElementById('downloadBtn').addEventListener('click', downloadPNG);

function updateSettings() {
  document.getElementById('asciiWidthVal').textContent = document.getElementById('asciiWidth').value;
  document.getElementById('brightnessVal').textContent = document.getElementById('brightness').value;
  document.getElementById('contrastVal').textContent = document.getElementById('contrast').value;
  document.getElementById('blurVal').textContent = document.getElementById('blur').value;
  document.getElementById('zoomVal').textContent = document.getElementById('zoom').value;
  document.getElementById('edgeThresholdVal').textContent = document.getElementById('edgeThreshold').value;
  document.getElementById('dogEdgeThresholdVal').textContent = document.getElementById('dogEdgeThreshold').value;

  const theme = document.getElementById('theme').value;
  document.body.classList.toggle('light-mode', theme === 'light');

  const zoomPercent = parseInt(document.getElementById('zoom').value, 10);
  const newFontSize = (baseFontSize * zoomPercent) / 100;
  const asciiArt = document.getElementById('ascii-art');
  asciiArt.style.fontSize = newFontSize + "px";
  asciiArt.style.lineHeight = newFontSize + "px";
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
  document.querySelector('input[name="edgeMethod"][value="none"]').checked = true;
  document.getElementById('edgeThreshold').value = 100;
  document.getElementById('dogEdgeThreshold').value = 100;
  document.getElementById('sobelThresholdControl').style.display = 'none';
  document.getElementById('dogThresholdControl').style.display = 'none';
  updateSettings();
}

function downloadPNG() {
  const preElement = document.getElementById('ascii-art');
  const asciiText = preElement.textContent;
  if (!asciiText.trim()) {
    alert("No ASCII art to download.");
    return;
  }
  const lines = asciiText.split("\n");
  const scaleFactor = 2;
  const borderMargin = 20 * scaleFactor;
  const computedStyle = window.getComputedStyle(preElement);
  const baseFontSize = parseInt(computedStyle.fontSize, 10);
  const fontSize = baseFontSize * scaleFactor;
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;
  let maxLineWidth = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineWidth = tempCtx.measureText(lines[i]).width;
    if (lineWidth > maxLineWidth) {
      maxLineWidth = lineWidth;
    }
  }
  const lineHeight = fontSize;
  const textWidth = Math.ceil(maxLineWidth);
  const textHeight = Math.ceil(lines.length * lineHeight);
  const canvasWidth = textWidth + 2 * borderMargin;
  const canvasHeight = textHeight + 2 * borderMargin;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = canvasWidth;
  offCanvas.height = canvasHeight;
  const offCtx = offCanvas.getContext('2d');
  const bgColor = document.body.classList.contains('light-mode') ? "#fff" : "#000";
  offCtx.fillStyle = bgColor;
  offCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  offCtx.font = `${fontSize}px Consolas, Monaco, "Liberation Mono", monospace`;
  offCtx.textBaseline = 'top';
  offCtx.fillStyle = document.body.classList.contains('light-mode') ? "#000" : "#eee";
  for (let i = 0; i < lines.length; i++) {
    offCtx.fillText(lines[i], borderMargin, borderMargin + i * lineHeight);
  }
  offCanvas.toBlob(function (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ascii_art.png';
    a.click();
  });
}
