# Webcam to ASCII (Rust + WebAssembly)

A high-performance, retro-styled webcam to ASCII art converter built with Rust and WebAssembly.

![Build Status](https://img.shields.io/github/actions/workflow/status/iusupoveldar/webcam-to-ascii/deploy.yml)

## Features

*   **High Performance**: Core image processing logic written in **Rust** and compiled to **WebAssembly** for near-native speed.
*   **Retro Aesthetics**: 90s hacker terminal style with CRT scanlines, phosphor glow, and glitch effects.
*   **Multiple Modes**:
    *   **Character Sets**: Matrix, Glitch, Runes, Arrows, Circuitry, and more.
    *   **Color Modes**: Monochrome (Phosphor), True Color, and Rainbow.
*   **Advanced Algorithms**:
    *   **Edge Detection**: Sobel Operator and Difference of Gaussians (DoG).
    *   **Dithering**: Floyd-Steinberg, Atkinson, and Noise Injection.
*   **Memory Bank**: Snap and save your favorite ASCII frames to a local gallery.

## Tech Stack

*   **Core Logic**: Rust
*   **Compilation**: [WebAssembly (Wasm)](https://webassembly.org/) via `wasm-pack`
*   **Frontend**: HTML, CSS, JavaScript
*   **Build Tooling**: Cargo, wasm-bindgen

## CI/CD Pipeline

This project uses **GitHub Actions** for continuous integration and deployment.

### Workflow: `.github/workflows/deploy.yml`

Every time code is pushed to the `main` branch, the pipeline triggers:

1.  **Environment Setup**: Installs the Rust toolchain and `wasm-pack`.
2.  **Build**: Compiles the Rust code to WebAssembly using `wasm-pack build --target web`.
3.  **Prepare**: Copies the generated Wasm artifacts (`pkg/`), HTML, CSS, and JS to a distribution folder.
4.  **Deploy**: Automatically deploys the build to the `gh-pages` branch, making the site live on GitHub Pages.

## How to Run Locally

### Prerequisites
*   Rust and Cargo installed.
*   `wasm-pack` installed (`cargo install wasm-pack`).
*   Python (for simple local server).

### Quick Start
1.  Clone the repository.
2.  Run the build script:
    ```bash
    ./run.bat
    ```
    *This script builds the Wasm module and starts a local server at `http://localhost:8000`.*

### Manual Build
```bash
wasm-pack build --target web
python -m http.server 8000
```

## License

MIT License
