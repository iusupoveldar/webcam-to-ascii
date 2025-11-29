use wasm_bindgen::prelude::*;
use wasm_bindgen::{Clamped, JsCast};
use web_sys::{CanvasRenderingContext2d};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn process_frame(
    ctx: &CanvasRenderingContext2d,
    width: u32,
    height: u32,
    image_data: Clamped<Vec<u8>>,
    options: &JsValue,
) -> Result<(), JsValue> {
    let opts: Options = serde_wasm_bindgen::from_value(options.clone())?;
    
    // Calculate dimensions
    let font_width = (7.0 * opts.zoom).round();
    let font_height = (12.0 * opts.zoom).round();
    
    // Ensure minimum readable size or handle scaling differently
    // If font is too small (< 4px), browser might not render it well.
    // But if user asked for "min zoom", respect it.
    
    let ascii_width = opts.ascii_width;
    let ascii_height = ((height as f64 / width as f64) * ascii_width as f64 * 0.55).round() as u32;

    let canvas_width = ascii_width as f64 * font_width;
    let canvas_height = ascii_height as f64 * font_height;
    
    // Resize canvas to match calculated dimensions
    let canvas: web_sys::HtmlCanvasElement = ctx.canvas().unwrap().dyn_into().unwrap();
    canvas.set_width(canvas_width as u32);
    canvas.set_height(canvas_height as u32);

    ctx.set_fill_style(&JsValue::from_str("#000"));
    ctx.fill_rect(0.0, 0.0, canvas_width, canvas_height);
    
    let font = format!("{}px 'VT323', monospace", font_height);
    ctx.set_font(&font);
    ctx.set_text_baseline("top");

    // Pre-process image data (resize and read)
    // Since receives the raw full-res image data, need to sample it.
    // A simple nearest-neighbor or bilinear sample loop.
    
    let mut gray_buffer = vec![0.0; (ascii_width * ascii_height) as usize];
    let mut color_buffer = vec![(0,0,0); (ascii_width * ascii_height) as usize];
    
    let contrast_factor = (259.0 * (opts.contrast + 255.0)) / (255.0 * (259.0 - opts.contrast));

    for y in 0..ascii_height {
        for x in 0..ascii_width {
            // Map ascii coord to image coord
            let src_x = (x as f64 / ascii_width as f64 * width as f64) as u32;
            let src_y = (y as f64 / ascii_height as f64 * height as f64) as u32;
            let idx = ((src_y * width + src_x) * 4) as usize;
            
            if idx >= image_data.len() { continue; }

            let r = image_data[idx];
            let g = image_data[idx + 1];
            let b = image_data[idx + 2];
            
            let mut lum = 0.299 * r as f64 + 0.587 * g as f64 + 0.114 * b as f64;
            if opts.invert { lum = 255.0 - lum; }
            
            let adjusted = clamp(contrast_factor * (lum - 128.0) + 128.0 + opts.brightness, 0.0, 255.0);
            
            let buf_idx = (y * ascii_width + x) as usize;
            gray_buffer[buf_idx] = adjusted;
            color_buffer[buf_idx] = (r, g, b);
        }
    }

    // Edge Detection
    let mut edge_map = vec![0u8; (ascii_width * ascii_height) as usize];
    if opts.edge_method == "sobel" {
        apply_sobel(&gray_buffer, ascii_width, ascii_height, opts.edge_threshold, &mut edge_map);
    }

    // Dithering
    if opts.dithering {
        if opts.dither_algo == "floyd" {
            apply_floyd_steinberg(&mut gray_buffer, ascii_width, ascii_height);
        } else if opts.dither_algo == "noise" {
            apply_noise(&mut gray_buffer);
        }
    }

    // Rendering
    // Define Charsets
    let chars_str = match opts.charset.as_str() {
        "matrix" => "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ",
        "glitch" => "¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ",
        "runes" => "ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽᚾᚿᛀᛁᛂᛃᛄᛅᛆᛇᛈᛉᛊᛋᛌᛍᛎᛏᛐᛑᛒᛓᛔᛕᛖᛗᛘᛙᛚᛛᛜᛝᛞᛟᛠᛡᛢᛣᛤᛥᛦᛧᛨᛩᛪ᛫᛬᛭ᛮᛯᛰ",
        "arrows" => "←↑→↓↔↕↖↗↘↙↚↛↜↝↞↟↠↡↢↣↤↥↦↧↨↩↪↫↬↭↮↯↰↱↲↳↴↵↶↷↸↹↺↻↼↽↾↿⇀⇁⇂⇃⇄⇅⇆⇇⇈⇉⇊⇋⇌⇍⇎⇏⇐⇑⇒⇓⇔⇕⇖⇗⇘⇙⇚⇛",
        "circuit" => "─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬",
        "blocks" => "█▓▒░ ",
        "binary" => "101010 ",
        "hex" => "0123456789ABCDEF ",
        "manual" => &opts.manual_char,
        _ => "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    };
    
    let chars: Vec<char> = chars_str.chars().collect();
    let char_len = chars.len();
    
    // Determine if we use density mapping or pattern mapping
    let is_pattern_mode = matches!(opts.charset.as_str(), "matrix" | "glitch" | "runes" | "arrows" | "circuit" | "manual");

    for y in 0..ascii_height {
        for x in 0..ascii_width {
            let idx = (y * ascii_width + x) as usize;
            let mut val = gray_buffer[idx];
            
            if edge_map[idx] > 0 {
                val = 0.0; // Force dark/specific char
            }
            
            if opts.ignore_white && val > 250.0 { continue; }
            
            let mut char_idx;
            let mut alpha = 1.0;

            if is_pattern_mode {
                // Pattern Mode: Cycle through chars based on position
                char_idx = ((x + y) as usize) % char_len;
                // Use brightness for Alpha/Opacity to make it visible
                // Invert val because usually 0 is black (transparent) and 255 is white (opaque)
                // But in the gray_buffer, 0 is black.
                // If background is black, want bright pixels to be opaque chars.
                alpha = val / 255.0;
                
                // Threshold to avoid drawing very dark pixels at all
                if alpha < 0.1 { continue; }
            } else {
                // Density Mode: Map brightness to char index
                char_idx = ((val / 255.0) * (char_len - 1) as f64).floor() as usize;
            }

            if char_idx >= char_len { char_idx = char_len - 1; }
            
            let char_str = chars[char_idx].to_string();
            
            // Color
            let fill_style = if opts.color_mode == "true" {
                let (r, g, b) = color_buffer[idx];
                format!("rgba({},{},{},{})", r, g, b, alpha)
            } else if opts.color_mode == "rainbow" {
                let hue = (x as f64 / ascii_width as f64) * 360.0 + (js_sys::Date::now() / 20.0);
                format!("hsla({}, 100%, 50%, {})", hue, alpha)
            } else {
                ctx.set_global_alpha(alpha);
                opts.primary_color.clone()
            };
            
            if opts.color_mode != "mono" {
                // Reset alpha if we used rgba/hsla strings
                ctx.set_global_alpha(1.0); 
            }
            
            ctx.set_fill_style(&JsValue::from_str(&fill_style));
            ctx.fill_text(&char_str, x as f64 * font_width, y as f64 * font_height)?;
            
            // Reset global alpha for next iteration
            ctx.set_global_alpha(1.0);
        }
    }

    Ok(())
}

fn clamp(val: f64, min: f64, max: f64) -> f64 {
    if val < min { min } else if val > max { max } else { val }
}

fn apply_sobel(buffer: &[f64], width: u32, height: u32, threshold: f64, edge_map: &mut [u8]) {
    let kx = [[-1.0, 0.0, 1.0], [-2.0, 0.0, 2.0], [-1.0, 0.0, 1.0]];
    let ky = [[-1.0, -2.0, -1.0], [0.0, 0.0, 0.0], [1.0, 2.0, 1.0]];
    
    for y in 1..height-1 {
        for x in 1..width-1 {
            let mut gx = 0.0;
            let mut gy = 0.0;
            
            for j in 0..3 {
                for i in 0..3 {
                    let idx = ((y + j as u32 - 1) * width + (x + i as u32 - 1)) as usize;
                    let val = buffer[idx];
                    gx += val * kx[j][i];
                    gy += val * ky[j][i];
                }
            }
            
            let mag = (gx*gx + gy*gy).sqrt();
            if mag > threshold {
                edge_map[(y * width + x) as usize] = 255;
            }
        }
    }
}

fn apply_floyd_steinberg(buffer: &mut [f64], width: u32, height: u32) {
    let steps = 8.0;
    for y in 0..height-1 {
        for x in 1..width-1 {
            let idx = (y * width + x) as usize;
            let old_val = buffer[idx];
            let new_val = (old_val / 255.0 * steps).round() * (255.0 / steps);
            buffer[idx] = new_val;
            let err = old_val - new_val;
            
            buffer[idx + 1] += err * 7.0 / 16.0;
            buffer[((y + 1) * width + x - 1) as usize] += err * 3.0 / 16.0;
            buffer[((y + 1) * width + x) as usize] += err * 5.0 / 16.0;
            buffer[((y + 1) * width + x + 1) as usize] += err * 1.0 / 16.0;
        }
    }
}

fn apply_noise(buffer: &mut [f64]) {
    for val in buffer.iter_mut() {
        *val = clamp(*val + (js_sys::Math::random() - 0.5) * 50.0, 0.0, 255.0);
    }
}

#[derive(serde::Deserialize)]
struct Options {
    ascii_width: u32,
    brightness: f64,
    contrast: f64,
    dithering: bool,
    dither_algo: String,
    invert: bool,
    ignore_white: bool,
    charset: String,
    color_mode: String,
    edge_method: String,
    edge_threshold: f64,
    zoom: f64,
    primary_color: String,
    manual_char: String,
    is_manual: bool,
}
