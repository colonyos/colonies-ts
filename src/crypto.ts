/**
 * ColonyOS Crypto implementation
 * Ported from pycolonies/crypto.py
 * Based on eth-utils and eth-keys (MIT-licensed)
 */

import { sha3_256 } from '@noble/hashes/sha3';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';

// ============== secp256k1 Curve Parameters ==============

const A = 0n;
const N = 115792089237316195423570985008687907852837564279074904382605163141518161494337n;
const Gx = 55066263022277343669578718895168534326250603453777594175500187360389116729240n;
const Gy = 32670510020758816978083085130507043184471273380659243275938904335757337482424n;
const G: [bigint, bigint] = [Gx, Gy];
const P = 2n ** 256n - 2n ** 32n - 977n;

type Point = [bigint, bigint];
type JacobianPoint = [bigint, bigint, bigint];

// ============== Utility Functions ==============

function pad32(value: Uint8Array): Uint8Array {
  if (value.length >= 32) return value.slice(0, 32);
  const padded = new Uint8Array(32);
  padded.set(value, 32 - value.length);
  return padded;
}

function intToBigEndian(value: bigint): Uint8Array {
  if (value === 0n) return new Uint8Array([0]);
  const hex = value.toString(16);
  const paddedHex = hex.length % 2 ? '0' + hex : hex;
  return hexToBytes(paddedHex);
}

function bigEndianToInt(value: Uint8Array): bigint {
  if (value.length === 0) return 0n;
  return BigInt('0x' + bytesToHex(value));
}

// ============== Elliptic Curve Math ==============

function inv(a: bigint, n: bigint): bigint {
  if (a === 0n) return 0n;
  let lm = 1n, hm = 0n;
  let low = ((a % n) + n) % n, high = n;
  while (low > 1n) {
    const r = high / low;
    const nm = hm - lm * r;
    const newVal = high - low * r;
    hm = lm;
    high = low;
    lm = nm;
    low = newVal;
  }
  return ((lm % n) + n) % n;
}

function toJacobian(p: Point): JacobianPoint {
  return [p[0], p[1], 1n];
}

function fromJacobian(p: JacobianPoint): Point {
  const z = inv(p[2], P);
  const z2 = (z * z) % P;
  const z3 = (z2 * z) % P;
  return [((p[0] * z2) % P + P) % P, ((p[1] * z3) % P + P) % P];
}

function jacobianDouble(p: JacobianPoint): JacobianPoint {
  if (p[1] === 0n) return [0n, 0n, 0n];
  const ysq = (p[1] ** 2n) % P;
  const S = (4n * p[0] * ysq) % P;
  const M = (3n * p[0] ** 2n + A * p[2] ** 4n) % P;
  const nx = ((M ** 2n - 2n * S) % P + P) % P;
  const ny = ((M * (S - nx) - 8n * ysq ** 2n) % P + P) % P;
  const nz = (2n * p[1] * p[2]) % P;
  return [nx, ny, nz];
}

function jacobianAdd(p: JacobianPoint, q: JacobianPoint): JacobianPoint {
  if (p[1] === 0n) return q;
  if (q[1] === 0n) return p;

  const U1 = (p[0] * q[2] ** 2n) % P;
  const U2 = (q[0] * p[2] ** 2n) % P;
  const S1 = (p[1] * q[2] ** 3n) % P;
  const S2 = (q[1] * p[2] ** 3n) % P;

  if (U1 === U2) {
    if (S1 !== S2) return [0n, 0n, 1n];
    return jacobianDouble(p);
  }

  const H = ((U2 - U1) % P + P) % P;
  const R = ((S2 - S1) % P + P) % P;
  const H2 = (H * H) % P;
  const H3 = (H * H2) % P;
  const U1H2 = (U1 * H2) % P;
  const nx = ((R ** 2n - H3 - 2n * U1H2) % P + P) % P;
  const ny = ((R * (U1H2 - nx) - S1 * H3) % P + P) % P;
  const nz = (H * p[2] * q[2]) % P;

  return [nx, ny, nz];
}

function jacobianMultiply(a: JacobianPoint, n: bigint): JacobianPoint {
  if (a[1] === 0n || n === 0n) return [0n, 0n, 1n];
  if (n === 1n) return a;
  if (n < 0n || n >= N) return jacobianMultiply(a, ((n % N) + N) % N);
  if (n % 2n === 0n) {
    return jacobianDouble(jacobianMultiply(a, n / 2n));
  } else {
    return jacobianAdd(jacobianDouble(jacobianMultiply(a, n / 2n)), a);
  }
}

function fastMultiply(a: Point, n: bigint): Point {
  return fromJacobian(jacobianMultiply(toJacobian(a), n));
}

function encodeRawPublicKey(rawPublicKey: Point): Uint8Array {
  const left = pad32(intToBigEndian(rawPublicKey[0]));
  const right = pad32(intToBigEndian(rawPublicKey[1]));
  const result = new Uint8Array(64);
  result.set(left, 0);
  result.set(right, 32);
  return result;
}

function privateKeyToPublicKey(privateKeyBytes: Uint8Array): Uint8Array {
  const privateKeyAsNum = bigEndianToInt(privateKeyBytes);
  if (privateKeyAsNum >= N) {
    throw new Error('Invalid private key');
  }
  const rawPublicKey = fastMultiply(G, privateKeyAsNum);
  return encodeRawPublicKey(rawPublicKey);
}

// ============== ECDSA Signing ==============

function deterministicGenerateK(msgHash: Uint8Array, privateKeyBytes: Uint8Array): bigint {
  const v0 = new Uint8Array(32).fill(0x01);
  const k0 = new Uint8Array(32).fill(0x00);

  // k1 = HMAC(k0, v0 || 0x00 || priv || hash)
  const data1 = new Uint8Array(v0.length + 1 + privateKeyBytes.length + msgHash.length);
  data1.set(v0, 0);
  data1[v0.length] = 0x00;
  data1.set(privateKeyBytes, v0.length + 1);
  data1.set(msgHash, v0.length + 1 + privateKeyBytes.length);
  const k1 = hmac(sha256, k0, data1);

  // v1 = HMAC(k1, v0)
  const v1 = hmac(sha256, k1, v0);

  // k2 = HMAC(k1, v1 || 0x01 || priv || hash)
  const data2 = new Uint8Array(v1.length + 1 + privateKeyBytes.length + msgHash.length);
  data2.set(v1, 0);
  data2[v1.length] = 0x01;
  data2.set(privateKeyBytes, v1.length + 1);
  data2.set(msgHash, v1.length + 1 + privateKeyBytes.length);
  const k2 = hmac(sha256, k1, data2);

  // v2 = HMAC(k2, v1)
  const v2 = hmac(sha256, k2, v1);

  // kb = HMAC(k2, v2)
  const kb = hmac(sha256, k2, v2);
  return bigEndianToInt(kb);
}

function ecdsaRawSign(msgHash: Uint8Array, privateKeyBytes: Uint8Array): [number, bigint, bigint] {
  const z = bigEndianToInt(msgHash);
  const k = deterministicGenerateK(msgHash, privateKeyBytes);

  const [r, y] = fastMultiply(G, k);
  const privKeyNum = bigEndianToInt(privateKeyBytes);
  const sRaw = (inv(k, N) * (z + r * privKeyNum)) % N;

  const v = 27 + Number((y % 2n) ^ (sRaw * 2n < N ? 0n : 1n));
  const s = sRaw * 2n < N ? sRaw : N - sRaw;

  return [v - 27, r, s];
}

// ============== Exported Functions ==============

/**
 * Generate a new random private key
 * @returns Hex-encoded private key (64 characters)
 */
export function generatePrivateKey(): string {
  const randomData = randomBytes(32);
  const hash = sha3_256(randomData);
  return bytesToHex(hash);
}

/**
 * Derive the public ID from a private key
 * Uses SHA3-256 hash of "04" + hex(publicKey)
 * @param privateKey - Hex-encoded private key
 * @returns Hex-encoded ID (64 characters)
 */
export function deriveId(privateKey: string): string {
  const privateKeyBytes = hexToBytes(privateKey);
  const publicKey = privateKeyToPublicKey(privateKeyBytes);
  const publicKeyHex = '04' + bytesToHex(publicKey);

  // Hash the string representation, not the bytes
  const encoder = new TextEncoder();
  const hash = sha3_256(encoder.encode(publicKeyHex));

  return bytesToHex(hash);
}

/**
 * Sign a message with a private key
 * @param message - Message to sign
 * @param privateKey - Hex-encoded private key
 * @returns Hex-encoded signature (130 characters: r + s + v)
 */
export function sign(message: string, privateKey: string): string {
  const privateKeyBytes = hexToBytes(privateKey);

  // Hash message with SHA3-256
  const encoder = new TextEncoder();
  const msgHash = sha3_256(encoder.encode(message));

  const [v, r, s] = ecdsaRawSign(msgHash, privateKeyBytes);

  // Format: r (32 bytes) + s (32 bytes) + v (1 byte)
  const vBytes = new Uint8Array([v]);
  const rBytes = pad32(intToBigEndian(r));
  const sBytes = pad32(intToBigEndian(s));

  const signature = new Uint8Array(65);
  signature.set(rBytes, 0);
  signature.set(sBytes, 32);
  signature.set(vBytes, 64);

  return bytesToHex(signature);
}

/**
 * Crypto utility class for convenience
 */
export class Crypto {
  generatePrivateKey(): string {
    return generatePrivateKey();
  }

  id(privateKey: string): string {
    return deriveId(privateKey);
  }

  sign(message: string, privateKey: string): string {
    return sign(message, privateKey);
  }
}

// Export internal functions for testing
export const _internal = {
  jacobianAdd,
  jacobianDouble,
  fastMultiply,
  pad32,
  intToBigEndian,
  bigEndianToInt,
};
