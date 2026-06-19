use wasm_bindgen::prelude::*;

fn to_grayscale(r: u8, g: u8, b: u8) -> f64 {
    0.299 * r as f64 + 0.587 * g as f64 + 0.114 * b as f64
}

fn apply_sobel(gray: &[f64], width: u32, height: u32, threshold: u8) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let mut result = vec![0u8; w * h];

    let gx_kernel: [[f64; 3]; 3] = [
        [-1.0, 0.0, 1.0],
        [-2.0, 0.0, 2.0],
        [-1.0, 0.0, 1.0],
    ];
    let gy_kernel: [[f64; 3]; 3] = [
        [-1.0, -2.0, -1.0],
        [0.0, 0.0, 0.0],
        [1.0, 2.0, 1.0],
    ];

    let threshold_f = threshold as f64;

    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let mut gx = 0.0;
            let mut gy = 0.0;

            for ky in 0..3usize {
                for kx in 0..3usize {
                    let py = y + ky - 1;
                    let px = x + kx - 1;
                    let pixel = gray[py * w + px];
                    gx += gx_kernel[ky][kx] * pixel;
                    gy += gy_kernel[ky][kx] * pixel;
                }
            }

            let magnitude = (gx * gx + gy * gy).sqrt();
            result[y * w + x] = if magnitude >= threshold_f { 255 } else { 0 };
        }
    }

    result
}

#[wasm_bindgen]
pub fn detect_edges(image_data: &[u8], width: u32, height: u32, threshold: u8) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let pixel_count = w * h;

    let gray: Vec<f64> = (0..pixel_count)
        .map(|i| {
            let base = i * 4;
            to_grayscale(image_data[base], image_data[base + 1], image_data[base + 2])
        })
        .collect();

    apply_sobel(&gray, width, height, threshold)
}

#[wasm_bindgen]
pub fn detect_edges_to_rgba(image_data: &[u8], width: u32, height: u32, threshold: u8) -> Vec<u8> {
    let edge_map = detect_edges(image_data, width, height, threshold);
    let pixel_count = edge_map.len();
    let mut rgba = vec![0u8; pixel_count * 4];

    for (i, &edge) in edge_map.iter().enumerate() {
        let base = i * 4;
        if edge == 255 {
            rgba[base] = 0x00;
            rgba[base + 1] = 0xE5;
            rgba[base + 2] = 0xCC;
            rgba[base + 3] = 0xFF;
        } else {
            rgba[base] = 0x00;
            rgba[base + 1] = 0x00;
            rgba[base + 2] = 0x00;
            rgba[base + 3] = 0x00;
        }
    }

    rgba
}
