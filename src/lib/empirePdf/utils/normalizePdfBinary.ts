function isNodeBuffer(input: Buffer | Uint8Array | ArrayBuffer): input is Buffer {
  return typeof Buffer !== "undefined" && Buffer.isBuffer(input);
}

export function getPdfBinaryType(input: Buffer | Uint8Array | ArrayBuffer): "Buffer" | "Uint8Array" | "ArrayBuffer" {
  if (isNodeBuffer(input)) {
    return "Buffer";
  }

  if (input instanceof Uint8Array) {
    return "Uint8Array";
  }

  return "ArrayBuffer";
}

export function normalizePdfBinary(input: Buffer | Uint8Array | ArrayBuffer): Uint8Array {
  if (isNodeBuffer(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  return new Uint8Array(input);
}
