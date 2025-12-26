// ../../node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

// ../../node_modules/@noble/hashes/esm/crypto.js
var crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

// ../../node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash should be wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
var Hash = class {
};
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto && typeof crypto.randomBytes === "function") {
    return Uint8Array.from(crypto.randomBytes(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// ../../node_modules/@noble/hashes/esm/sha3.js
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var Keccak = class _Keccak extends Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    this.enableXOF = false;
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen);
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
var sha3_256 = /* @__PURE__ */ (() => gen(6, 136, 256 / 8))();

// ../../node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE2) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE2);
  const _32n2 = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n2 & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE2 ? 4 : 0;
  const l = isLE2 ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE2);
  view.setUint32(byteOffset + l, wl, isLE2);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE2) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor());
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// ../../node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA256 = class extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A: A2, B, C, D, E, F, G: G2, H } = this;
    return [A2, B, C, D, E, F, G2, H];
  }
  // prettier-ignore
  set(A2, B, C, D, E, F, G2, H) {
    this.A = A2 | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G2 | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A: A2, B, C, D, E, F, G: G2, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G2) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A2, 2) ^ rotr(A2, 13) ^ rotr(A2, 22);
      const T2 = sigma0 + Maj(A2, B, C) | 0;
      H = G2;
      G2 = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A2;
      A2 = T1 + T2 | 0;
    }
    A2 = A2 + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G2 = G2 + this.G | 0;
    H = H + this.H | 0;
    this.set(A2, B, C, D, E, F, G2, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());

// ../../node_modules/@noble/hashes/esm/sha256.js
var sha2562 = sha256;

// ../../node_modules/@noble/hashes/esm/hmac.js
var HMAC = class extends Hash {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

// ../../dist/index.mjs
var A = 0n;
var N = 115792089237316195423570985008687907852837564279074904382605163141518161494337n;
var Gx = 55066263022277343669578718895168534326250603453777594175500187360389116729240n;
var Gy = 32670510020758816978083085130507043184471273380659243275938904335757337482424n;
var G = [Gx, Gy];
var P = 2n ** 256n - 2n ** 32n - 977n;
function pad32(value) {
  if (value.length >= 32)
    return value.slice(0, 32);
  const padded = new Uint8Array(32);
  padded.set(value, 32 - value.length);
  return padded;
}
function intToBigEndian(value) {
  if (value === 0n)
    return new Uint8Array([0]);
  const hex = value.toString(16);
  const paddedHex = hex.length % 2 ? "0" + hex : hex;
  return hexToBytes(paddedHex);
}
function bigEndianToInt(value) {
  if (value.length === 0)
    return 0n;
  return BigInt("0x" + bytesToHex(value));
}
function inv(a, n) {
  if (a === 0n)
    return 0n;
  let lm = 1n, hm = 0n;
  let low = (a % n + n) % n, high = n;
  while (low > 1n) {
    const r = high / low;
    const nm = hm - lm * r;
    const newVal = high - low * r;
    hm = lm;
    high = low;
    lm = nm;
    low = newVal;
  }
  return (lm % n + n) % n;
}
function toJacobian(p) {
  return [p[0], p[1], 1n];
}
function fromJacobian(p) {
  const z = inv(p[2], P);
  const z2 = z * z % P;
  const z3 = z2 * z % P;
  return [(p[0] * z2 % P + P) % P, (p[1] * z3 % P + P) % P];
}
function jacobianDouble(p) {
  if (p[1] === 0n)
    return [0n, 0n, 0n];
  const ysq = p[1] ** 2n % P;
  const S = 4n * p[0] * ysq % P;
  const M = (3n * p[0] ** 2n + A * p[2] ** 4n) % P;
  const nx = ((M ** 2n - 2n * S) % P + P) % P;
  const ny = ((M * (S - nx) - 8n * ysq ** 2n) % P + P) % P;
  const nz = 2n * p[1] * p[2] % P;
  return [nx, ny, nz];
}
function jacobianAdd(p, q) {
  if (p[1] === 0n)
    return q;
  if (q[1] === 0n)
    return p;
  const U1 = p[0] * q[2] ** 2n % P;
  const U2 = q[0] * p[2] ** 2n % P;
  const S1 = p[1] * q[2] ** 3n % P;
  const S2 = q[1] * p[2] ** 3n % P;
  if (U1 === U2) {
    if (S1 !== S2)
      return [0n, 0n, 1n];
    return jacobianDouble(p);
  }
  const H = ((U2 - U1) % P + P) % P;
  const R = ((S2 - S1) % P + P) % P;
  const H2 = H * H % P;
  const H3 = H * H2 % P;
  const U1H2 = U1 * H2 % P;
  const nx = ((R ** 2n - H3 - 2n * U1H2) % P + P) % P;
  const ny = ((R * (U1H2 - nx) - S1 * H3) % P + P) % P;
  const nz = H * p[2] * q[2] % P;
  return [nx, ny, nz];
}
function jacobianMultiply(a, n) {
  if (a[1] === 0n || n === 0n)
    return [0n, 0n, 1n];
  if (n === 1n)
    return a;
  if (n < 0n || n >= N)
    return jacobianMultiply(a, (n % N + N) % N);
  if (n % 2n === 0n) {
    return jacobianDouble(jacobianMultiply(a, n / 2n));
  } else {
    return jacobianAdd(jacobianDouble(jacobianMultiply(a, n / 2n)), a);
  }
}
function fastMultiply(a, n) {
  return fromJacobian(jacobianMultiply(toJacobian(a), n));
}
function encodeRawPublicKey(rawPublicKey) {
  const left = pad32(intToBigEndian(rawPublicKey[0]));
  const right = pad32(intToBigEndian(rawPublicKey[1]));
  const result = new Uint8Array(64);
  result.set(left, 0);
  result.set(right, 32);
  return result;
}
function privateKeyToPublicKey(privateKeyBytes) {
  const privateKeyAsNum = bigEndianToInt(privateKeyBytes);
  if (privateKeyAsNum >= N) {
    throw new Error("Invalid private key");
  }
  const rawPublicKey = fastMultiply(G, privateKeyAsNum);
  return encodeRawPublicKey(rawPublicKey);
}
function deterministicGenerateK(msgHash, privateKeyBytes) {
  const v0 = new Uint8Array(32).fill(1);
  const k0 = new Uint8Array(32).fill(0);
  const data1 = new Uint8Array(v0.length + 1 + privateKeyBytes.length + msgHash.length);
  data1.set(v0, 0);
  data1[v0.length] = 0;
  data1.set(privateKeyBytes, v0.length + 1);
  data1.set(msgHash, v0.length + 1 + privateKeyBytes.length);
  const k1 = hmac(sha2562, k0, data1);
  const v1 = hmac(sha2562, k1, v0);
  const data2 = new Uint8Array(v1.length + 1 + privateKeyBytes.length + msgHash.length);
  data2.set(v1, 0);
  data2[v1.length] = 1;
  data2.set(privateKeyBytes, v1.length + 1);
  data2.set(msgHash, v1.length + 1 + privateKeyBytes.length);
  const k2 = hmac(sha2562, k1, data2);
  const v2 = hmac(sha2562, k2, v1);
  const kb = hmac(sha2562, k2, v2);
  return bigEndianToInt(kb);
}
function ecdsaRawSign(msgHash, privateKeyBytes) {
  const z = bigEndianToInt(msgHash);
  const k = deterministicGenerateK(msgHash, privateKeyBytes);
  const [r, y] = fastMultiply(G, k);
  const privKeyNum = bigEndianToInt(privateKeyBytes);
  const sRaw = inv(k, N) * (z + r * privKeyNum) % N;
  const v = 27 + Number(y % 2n ^ (sRaw * 2n < N ? 0n : 1n));
  const s = sRaw * 2n < N ? sRaw : N - sRaw;
  return [v - 27, r, s];
}
function generatePrivateKey() {
  const randomData = randomBytes(32);
  const hash = sha3_256(randomData);
  return bytesToHex(hash);
}
function deriveId(privateKey) {
  const privateKeyBytes = hexToBytes(privateKey);
  const publicKey = privateKeyToPublicKey(privateKeyBytes);
  const publicKeyHex = "04" + bytesToHex(publicKey);
  const encoder = new TextEncoder();
  const hash = sha3_256(encoder.encode(publicKeyHex));
  return bytesToHex(hash);
}
function sign(message, privateKey) {
  const privateKeyBytes = hexToBytes(privateKey);
  const encoder = new TextEncoder();
  const msgHash = sha3_256(encoder.encode(message));
  const [v, r, s] = ecdsaRawSign(msgHash, privateKeyBytes);
  const vBytes = new Uint8Array([v]);
  const rBytes = pad32(intToBigEndian(r));
  const sBytes = pad32(intToBigEndian(s));
  const signature = new Uint8Array(65);
  signature.set(rBytes, 0);
  signature.set(sBytes, 32);
  signature.set(vBytes, 64);
  return bytesToHex(signature);
}
var Crypto = class {
  generatePrivateKey() {
    return generatePrivateKey();
  }
  id(privateKey) {
    return deriveId(privateKey);
  }
  sign(message, privateKey) {
    return sign(message, privateKey);
  }
};
function decodeBase64Utf8(base64) {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}
function encodeBase64Utf8(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryStr = String.fromCharCode(...utf8Bytes);
  return btoa(binaryStr);
}
var ColoniesClient = class {
  constructor(config) {
    this.privateKey = null;
    this.host = config.host;
    this.port = config.port;
    this.tls = config.tls ?? false;
    this.crypto = new Crypto();
  }
  setPrivateKey(privateKey) {
    this.privateKey = privateKey;
  }
  getBaseUrl() {
    const protocol = this.tls ? "https" : "http";
    return `${protocol}://${this.host}:${this.port}/api`;
  }
  createRPCMsg(msg) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Call setPrivateKey() first.");
    }
    const payload = encodeBase64Utf8(JSON.stringify(msg));
    const signature = this.crypto.sign(payload, this.privateKey);
    return {
      payloadtype: msg.msgtype,
      payload,
      signature
    };
  }
  async sendRPC(rpcMessage) {
    const url = this.getBaseUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rpcMessage)
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }
      if (errorObj.payload) {
        try {
          const decodedPayload = decodeBase64Utf8(errorObj.payload);
          const decodedError = JSON.parse(decodedPayload);
          throw new Error(decodedError.message || JSON.stringify(decodedError));
        } catch (e) {
          if (e instanceof Error && e.message !== "Request failed") {
            throw e;
          }
        }
      }
      throw new Error(JSON.stringify(errorObj));
    }
    const responseText = await response.text();
    if (!responseText || responseText.trim() === "") {
      throw new Error("Server returned empty response");
    }
    const rpcReplyMsg = JSON.parse(responseText);
    const msg = JSON.parse(decodeBase64Utf8(rpcReplyMsg.payload));
    if (rpcReplyMsg.error === true) {
      const errorMessage = typeof msg === "object" && msg.message ? msg.message : JSON.stringify(msg);
      throw new Error(errorMessage);
    }
    return msg;
  }
  // ==================== Colony Methods ====================
  async getColonies() {
    const msg = { msgtype: "getcoloniesmsg" };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getStatistics() {
    const msg = { msgtype: "getstatisticsmsg" };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Add a new colony (requires server private key)
   * @param colony - Colony object with colonyid and name
   */
  async addColony(colony) {
    const msg = {
      msgtype: "addcolonymsg",
      colony
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Remove a colony (requires server private key)
   * @param colonyName - Name of the colony to remove
   */
  async removeColony(colonyName) {
    const msg = {
      msgtype: "removecolonymsg",
      colonyname: colonyName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Executor Methods ====================
  async getExecutors(colonyName) {
    const msg = {
      msgtype: "getexecutorsmsg",
      colonyname: colonyName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getExecutor(colonyName, executorName) {
    const msg = {
      msgtype: "getexecutormsg",
      colonyname: colonyName,
      executorname: executorName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async addExecutor(executor) {
    const msg = {
      msgtype: "addexecutormsg",
      executor
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async approveExecutor(colonyName, executorName) {
    const msg = {
      msgtype: "approveexecutormsg",
      colonyname: colonyName,
      executorname: executorName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeExecutor(colonyName, executorName) {
    const msg = {
      msgtype: "removeexecutormsg",
      colonyname: colonyName,
      executorname: executorName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Process Methods ====================
  async submitFunctionSpec(spec) {
    const msg = {
      msgtype: "submitfuncspecmsg",
      spec
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getProcess(processId) {
    const msg = {
      msgtype: "getprocessmsg",
      processid: processId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getProcesses(colonyName, count, state) {
    const msg = {
      msgtype: "getprocessesmsg",
      colonyname: colonyName,
      count,
      state
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeProcess(processId) {
    const msg = {
      msgtype: "removeprocessmsg",
      processid: processId,
      all: false
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeAllProcesses(colonyName, state = -1) {
    const msg = {
      msgtype: "removeallprocessesmsg",
      colonyname: colonyName,
      state
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async assign(colonyName, timeout, executorPrvKey) {
    const originalKey = this.privateKey;
    this.setPrivateKey(executorPrvKey);
    try {
      const msg = {
        msgtype: "assignprocessmsg",
        colonyname: colonyName,
        timeout
      };
      return this.sendRPC(this.createRPCMsg(msg));
    } finally {
      if (originalKey) {
        this.setPrivateKey(originalKey);
      }
    }
  }
  async closeProcess(processId, output) {
    const msg = {
      msgtype: "closesuccessfulmsg",
      processid: processId,
      out: output
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async failProcess(processId, errors) {
    const msg = {
      msgtype: "closefailedmsg",
      processid: processId,
      errors
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Workflow Methods ====================
  async submitWorkflowSpec(workflowSpec) {
    const msg = {
      msgtype: "submitworkflowspecmsg",
      spec: workflowSpec
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getProcessGraph(processGraphId) {
    const msg = {
      msgtype: "getprocessgraphmsg",
      processgraphid: processGraphId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getProcessGraphs(colonyName, count, state) {
    const msg = {
      msgtype: "getprocessgraphsmsg",
      colonyname: colonyName,
      count
    };
    if (state !== void 0) {
      msg.state = state;
    }
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeProcessGraph(processGraphId) {
    const msg = {
      msgtype: "removeprocessgraphmsg",
      processgraphid: processGraphId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeAllProcessGraphs(colonyName, state) {
    const msg = {
      msgtype: "removeallprocessgraphsmsg",
      colonyname: colonyName
    };
    if (state !== void 0) {
      msg.state = state;
    }
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Log Methods ====================
  async addLog(processId, message, executorPrvKey) {
    const originalKey = this.privateKey;
    this.setPrivateKey(executorPrvKey);
    try {
      const msg = {
        msgtype: "addlogmsg",
        processid: processId,
        message
      };
      return this.sendRPC(this.createRPCMsg(msg));
    } finally {
      if (originalKey) {
        this.setPrivateKey(originalKey);
      }
    }
  }
  async getLogs(colonyName, processId, executorName, count = 100, since = 0) {
    const msg = {
      msgtype: "getlogsmsg",
      colonyname: colonyName,
      processid: processId,
      executorname: executorName,
      count,
      since
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Function Methods ====================
  async getFunctions(executorName, colonyName) {
    const msg = {
      msgtype: "getfunctionsmsg",
      executorname: executorName,
      colonyname: colonyName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Cron Methods ====================
  async getCrons(colonyName, count = 100) {
    const msg = {
      msgtype: "getcronsmsg",
      colonyname: colonyName,
      count
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getCron(cronId) {
    const msg = {
      msgtype: "getcronmsg",
      cronid: cronId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async addCron(cronSpec) {
    const msg = {
      msgtype: "addcronmsg",
      cron: cronSpec
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeCron(cronId) {
    const msg = {
      msgtype: "removecronmsg",
      cronid: cronId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Generator Methods ====================
  async getGenerators(colonyName, count = 100) {
    const msg = {
      msgtype: "getgeneratorsmsg",
      colonyname: colonyName,
      count
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getGenerator(generatorId) {
    const msg = {
      msgtype: "getgeneratormsg",
      generatorid: generatorId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async addGenerator(generatorSpec) {
    const msg = {
      msgtype: "addgeneratormsg",
      generator: generatorSpec
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== User Methods ====================
  async getUsers(colonyName) {
    const msg = {
      msgtype: "getusersmsg",
      colonyname: colonyName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async addUser(user) {
    const msg = {
      msgtype: "addusermsg",
      user
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async removeUser(colonyName, name) {
    const msg = {
      msgtype: "removeusermsg",
      colonyname: colonyName,
      name
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== File Methods ====================
  async getFileLabels(colonyName, name = "", exact = false) {
    const msg = {
      msgtype: "getfilelabelsmsg",
      colonyname: colonyName,
      name,
      exact
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getFiles(colonyName, label) {
    const msg = {
      msgtype: "getfilesmsg",
      colonyname: colonyName,
      label
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Attribute Methods ====================
  async addAttribute(attribute) {
    const msg = {
      msgtype: "addattributemsg",
      attribute
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  async getAttribute(attributeId) {
    const msg = {
      msgtype: "getattributemsg",
      attributeid: attributeId
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Channel Methods ====================
  /**
   * Append a message to a process channel
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param sequence - Client-assigned sequence number
   * @param inReplyTo - Sequence number this message is replying to (0 if not a reply)
   * @param payload - Message content (string or Uint8Array)
   */
  async channelAppend(processId, channelName, sequence, inReplyTo, payload) {
    let payloadBytes;
    if (typeof payload === "string") {
      const encoder = new TextEncoder();
      payloadBytes = Array.from(encoder.encode(payload));
    } else {
      payloadBytes = Array.from(payload);
    }
    const msg = {
      msgtype: "channelappendmsg",
      processid: processId,
      name: channelName,
      sequence,
      inreplyto: inReplyTo,
      payload: payloadBytes
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Read messages from a process channel
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param afterSeq - Read messages after this sequence number (use 0 for all)
   * @param limit - Maximum number of messages to return (0 for no limit)
   */
  async channelRead(processId, channelName, afterSeq, limit) {
    const msg = {
      msgtype: "channelreadmsg",
      processid: processId,
      name: channelName,
      afterseq: afterSeq,
      limit
    };
    const response = await this.sendRPC(this.createRPCMsg(msg));
    if (Array.isArray(response)) {
      return response.map((entry) => ({
        ...entry,
        payload: typeof entry.payload === "string" ? (() => {
          try {
            const binaryStr = atob(entry.payload);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            return new TextDecoder("utf-8").decode(bytes);
          } catch {
            return entry.payload;
          }
        })() : Array.isArray(entry.payload) ? new TextDecoder("utf-8").decode(new Uint8Array(entry.payload)) : entry.payload
      }));
    }
    return response || [];
  }
  /**
   * Subscribe to a channel using WebSocket for real-time updates
   * @param processId - ID of the process
   * @param channelName - Name of the channel
   * @param afterSeq - Start reading after this sequence number
   * @param timeout - Timeout in seconds for the subscription
   * @param onMessage - Callback for new messages
   * @param onError - Callback for errors
   * @param onClose - Callback when connection closes
   * @returns WebSocket instance for cleanup
   */
  subscribeChannel(processId, channelName, afterSeq, timeout, onMessage, onError, onClose) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Call setPrivateKey() first.");
    }
    const wsProtocol = this.tls ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${this.host}:${this.port}/pubsub`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      const msg = {
        msgtype: "subscribechannelmsg",
        processid: processId,
        name: channelName,
        afterseq: afterSeq,
        timeout
      };
      const rpcMsg = this.createRPCMsg(msg);
      ws.send(JSON.stringify(rpcMsg));
    };
    ws.onmessage = (event) => {
      try {
        const rpcReply = JSON.parse(event.data);
        if (rpcReply.error) {
          const errorPayload = JSON.parse(decodeBase64Utf8(rpcReply.payload));
          onError(new Error(errorPayload.message || "WebSocket error"));
          return;
        }
        const data = JSON.parse(decodeBase64Utf8(rpcReply.payload));
        if (Array.isArray(data)) {
          const entries = data.map((entry) => ({
            ...entry,
            payload: typeof entry.payload === "string" ? (() => {
              try {
                const binaryStr = atob(entry.payload);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                return new TextDecoder("utf-8").decode(bytes);
              } catch {
                return entry.payload;
              }
            })() : Array.isArray(entry.payload) ? new TextDecoder("utf-8").decode(new Uint8Array(entry.payload)) : entry.payload
          }));
          const errorEntry = entries.find((e) => e.error);
          if (errorEntry) {
            onError(new Error(errorEntry.error));
            return;
          }
          onMessage(entries);
        }
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    ws.onerror = () => {
      onError(new Error("WebSocket connection error"));
    };
    ws.onclose = () => {
      onClose();
    };
    return ws;
  }
  // ==================== Blueprint Definition Methods ====================
  /**
   * Add a blueprint definition
   * @param definition - Blueprint definition object
   */
  async addBlueprintDefinition(definition) {
    const msg = {
      msgtype: "addblueprintdefinitionmsg",
      blueprintdefinition: definition
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Get a blueprint definition by name
   * @param colonyName - Name of the colony
   * @param name - Name of the blueprint definition
   */
  async getBlueprintDefinition(colonyName, name) {
    const msg = {
      msgtype: "getblueprintdefinitionmsg",
      colonyname: colonyName,
      name
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Get all blueprint definitions in a colony
   * @param colonyName - Name of the colony
   */
  async getBlueprintDefinitions(colonyName) {
    const msg = {
      msgtype: "getblueprintdefinitionsmsg",
      colonyname: colonyName
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Remove a blueprint definition
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint definition to remove
   */
  async removeBlueprintDefinition(colonyName, name) {
    const msg = {
      msgtype: "removeblueprintdefinitionmsg",
      namespace: colonyName,
      name
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }
  // ==================== Blueprint Methods ====================
  /**
   * Add a blueprint instance
   * @param blueprint - Blueprint object
   */
  async addBlueprint(blueprint) {
    const msg = {
      msgtype: "addblueprintmsg",
      blueprint
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Get a blueprint by name
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint
   */
  async getBlueprint(colonyName, name) {
    const msg = {
      msgtype: "getblueprintmsg",
      namespace: colonyName,
      name
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Get blueprints in a colony, optionally filtered by kind and location
   * @param colonyName - Name of the colony (namespace)
   * @param kind - Optional kind filter
   * @param location - Optional location filter
   */
  async getBlueprints(colonyName, kind, location) {
    const msg = {
      msgtype: "getblueprintsmsg",
      namespace: colonyName
    };
    if (kind)
      msg.kind = kind;
    if (location)
      msg.locationname = location;
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Update an existing blueprint
   * @param blueprint - Updated blueprint object
   * @param forceGeneration - Force generation bump even if spec unchanged
   */
  async updateBlueprint(blueprint, forceGeneration = false) {
    const msg = {
      msgtype: "updateblueprintmsg",
      blueprint,
      forcegeneration: forceGeneration
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Remove a blueprint
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint to remove
   */
  async removeBlueprint(colonyName, name) {
    const msg = {
      msgtype: "removeblueprintmsg",
      namespace: colonyName,
      name
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Update blueprint status (current state)
   * @param colonyName - Name of the colony
   * @param name - Name of the blueprint
   * @param status - Status object representing current state
   */
  async updateBlueprintStatus(colonyName, name, status) {
    const msg = {
      msgtype: "updateblueprintstatusmsg",
      colonyname: colonyName,
      blueprintname: name,
      status
    };
    await this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Trigger reconciliation for a blueprint
   * @param colonyName - Name of the colony (namespace)
   * @param name - Name of the blueprint
   * @param force - Force reconciliation even if no changes detected
   */
  async reconcileBlueprint(colonyName, name, force = false) {
    const msg = {
      msgtype: "reconcileblueprintmsg",
      namespace: colonyName,
      name,
      force
    };
    return this.sendRPC(this.createRPCMsg(msg));
  }
  /**
   * Subscribe to process state changes using WebSocket
   * Use this to wait for a process to be assigned (RUNNING state) before subscribing to channels
   * @param colonyName - Name of the colony
   * @param processId - ID of the process to watch
   * @param state - Target state to wait for (0=WAITING, 1=RUNNING, 2=SUCCESS, 3=FAILED)
   * @param timeout - Timeout in seconds for the subscription
   * @param onProcess - Callback when process reaches the target state
   * @param onError - Callback for errors
   * @param onClose - Callback when connection closes
   * @returns WebSocket instance for cleanup
   */
  subscribeProcess(colonyName, processId, state, timeout, onProcess, onError, onClose) {
    if (!this.privateKey) {
      throw new Error("Private key not set. Call setPrivateKey() first.");
    }
    const wsProtocol = this.tls ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${this.host}:${this.port}/pubsub`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      const msg = {
        msgtype: "subscribeprocessmsg",
        colonyname: colonyName,
        processid: processId,
        executortype: "",
        state,
        timeout
      };
      const rpcMsg = this.createRPCMsg(msg);
      ws.send(JSON.stringify(rpcMsg));
    };
    ws.onmessage = (event) => {
      try {
        const rpcReply = JSON.parse(event.data);
        if (rpcReply.error) {
          const errorPayload = JSON.parse(decodeBase64Utf8(rpcReply.payload));
          onError(new Error(errorPayload.message || "WebSocket error"));
          return;
        }
        const process = JSON.parse(decodeBase64Utf8(rpcReply.payload));
        onProcess(process);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    ws.onerror = () => {
      onError(new Error("WebSocket connection error"));
    };
    ws.onclose = () => {
      onClose();
    };
    return ws;
  }
};
export {
  ColoniesClient,
  Crypto
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
