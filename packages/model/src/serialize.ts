import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";

// Global in browsers, workers, and Node 16+; declared here so this package
// can keep a DOM-free lib config.
declare function btoa(data: string): string;
declare function atob(data: string): string;

/**
 * Paint sublayer data is stored in JSON as zlib-compressed u16 samples, base64-encoded.
 * u16 quantization (0..1 → 0..65535) is far below paper tolerance (~0.25mm).
 */

export function encodeField(data: Float32Array): string {
  const u16 = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = Math.min(1, Math.max(0, data[i]!));
    u16[i] = Math.round(v * 65535);
  }
  const compressed = zlibSync(new Uint8Array(u16.buffer));
  return btoa(strFromU8(compressed, true));
}

export function decodeField(encoded: string, length: number): Float32Array {
  const compressed = strToU8(atob(encoded), true);
  const bytes = unzlibSync(compressed);
  const u16 = new Uint16Array(bytes.buffer, bytes.byteOffset, length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = u16[i]! / 65535;
  return out;
}
