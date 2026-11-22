var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/ieee754/index.js"(exports) {
    /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/vt-pbf/node_modules/pbf/index.js
var require_pbf = __commonJS({
  "node_modules/vt-pbf/node_modules/pbf/index.js"(exports, module) {
    "use strict";
    module.exports = Pbf2;
    var ieee754 = require_ieee754();
    function Pbf2(buf) {
      this.buf = ArrayBuffer.isView && ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf || 0);
      this.pos = 0;
      this.type = 0;
      this.length = this.buf.length;
    }
    Pbf2.Varint = 0;
    Pbf2.Fixed64 = 1;
    Pbf2.Bytes = 2;
    Pbf2.Fixed32 = 5;
    var SHIFT_LEFT_322 = (1 << 16) * (1 << 16);
    var SHIFT_RIGHT_322 = 1 / SHIFT_LEFT_322;
    var TEXT_DECODER_MIN_LENGTH3 = 12;
    var utf8TextDecoder3 = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
    Pbf2.prototype = {
      destroy: function() {
        this.buf = null;
      },
      // === READING =================================================================
      readFields: function(readField, result, end) {
        end = end || this.length;
        while (this.pos < end) {
          var val = this.readVarint(), tag = val >> 3, startPos = this.pos;
          this.type = val & 7;
          readField(tag, result, this);
          if (this.pos === startPos) this.skip(val);
        }
        return result;
      },
      readMessage: function(readField, result) {
        return this.readFields(readField, result, this.readVarint() + this.pos);
      },
      readFixed32: function() {
        var val = readUInt32(this.buf, this.pos);
        this.pos += 4;
        return val;
      },
      readSFixed32: function() {
        var val = readInt32(this.buf, this.pos);
        this.pos += 4;
        return val;
      },
      // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
      readFixed64: function() {
        var val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_322;
        this.pos += 8;
        return val;
      },
      readSFixed64: function() {
        var val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_322;
        this.pos += 8;
        return val;
      },
      readFloat: function() {
        var val = ieee754.read(this.buf, this.pos, true, 23, 4);
        this.pos += 4;
        return val;
      },
      readDouble: function() {
        var val = ieee754.read(this.buf, this.pos, true, 52, 8);
        this.pos += 8;
        return val;
      },
      readVarint: function(isSigned) {
        var buf = this.buf, val, b;
        b = buf[this.pos++];
        val = b & 127;
        if (b < 128) return val;
        b = buf[this.pos++];
        val |= (b & 127) << 7;
        if (b < 128) return val;
        b = buf[this.pos++];
        val |= (b & 127) << 14;
        if (b < 128) return val;
        b = buf[this.pos++];
        val |= (b & 127) << 21;
        if (b < 128) return val;
        b = buf[this.pos];
        val |= (b & 15) << 28;
        return readVarintRemainder2(val, isSigned, this);
      },
      readVarint64: function() {
        return this.readVarint(true);
      },
      readSVarint: function() {
        var num = this.readVarint();
        return num % 2 === 1 ? (num + 1) / -2 : num / 2;
      },
      readBoolean: function() {
        return Boolean(this.readVarint());
      },
      readString: function() {
        var end = this.readVarint() + this.pos;
        var pos = this.pos;
        this.pos = end;
        if (end - pos >= TEXT_DECODER_MIN_LENGTH3 && utf8TextDecoder3) {
          return readUtf8TextDecoder(this.buf, pos, end);
        }
        return readUtf83(this.buf, pos, end);
      },
      readBytes: function() {
        var end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
        this.pos = end;
        return buffer;
      },
      // verbose for performance reasons; doesn't affect gzipped size
      readPackedVarint: function(arr, isSigned) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readVarint(isSigned));
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readVarint(isSigned));
        return arr;
      },
      readPackedSVarint: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readSVarint());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSVarint());
        return arr;
      },
      readPackedBoolean: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readBoolean());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readBoolean());
        return arr;
      },
      readPackedFloat: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readFloat());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFloat());
        return arr;
      },
      readPackedDouble: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readDouble());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readDouble());
        return arr;
      },
      readPackedFixed32: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readFixed32());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFixed32());
        return arr;
      },
      readPackedSFixed32: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readSFixed32());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSFixed32());
        return arr;
      },
      readPackedFixed64: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readFixed64());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readFixed64());
        return arr;
      },
      readPackedSFixed64: function(arr) {
        if (this.type !== Pbf2.Bytes) return arr.push(this.readSFixed64());
        var end = readPackedEnd(this);
        arr = arr || [];
        while (this.pos < end) arr.push(this.readSFixed64());
        return arr;
      },
      skip: function(val) {
        var type = val & 7;
        if (type === Pbf2.Varint) while (this.buf[this.pos++] > 127) {
        }
        else if (type === Pbf2.Bytes) this.pos = this.readVarint() + this.pos;
        else if (type === Pbf2.Fixed32) this.pos += 4;
        else if (type === Pbf2.Fixed64) this.pos += 8;
        else throw new Error("Unimplemented type: " + type);
      },
      // === WRITING =================================================================
      writeTag: function(tag, type) {
        this.writeVarint(tag << 3 | type);
      },
      realloc: function(min) {
        var length = this.length || 16;
        while (length < this.pos + min) length *= 2;
        if (length !== this.length) {
          var buf = new Uint8Array(length);
          buf.set(this.buf);
          this.buf = buf;
          this.length = length;
        }
      },
      finish: function() {
        this.length = this.pos;
        this.pos = 0;
        return this.buf.subarray(0, this.length);
      },
      writeFixed32: function(val) {
        this.realloc(4);
        writeInt32(this.buf, val, this.pos);
        this.pos += 4;
      },
      writeSFixed32: function(val) {
        this.realloc(4);
        writeInt32(this.buf, val, this.pos);
        this.pos += 4;
      },
      writeFixed64: function(val) {
        this.realloc(8);
        writeInt32(this.buf, val & -1, this.pos);
        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_322), this.pos + 4);
        this.pos += 8;
      },
      writeSFixed64: function(val) {
        this.realloc(8);
        writeInt32(this.buf, val & -1, this.pos);
        writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_322), this.pos + 4);
        this.pos += 8;
      },
      writeVarint: function(val) {
        val = +val || 0;
        if (val > 268435455 || val < 0) {
          writeBigVarint2(val, this);
          return;
        }
        this.realloc(4);
        this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
        if (val <= 127) return;
        this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
        if (val <= 127) return;
        this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
        if (val <= 127) return;
        this.buf[this.pos++] = val >>> 7 & 127;
      },
      writeSVarint: function(val) {
        this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
      },
      writeBoolean: function(val) {
        this.writeVarint(Boolean(val));
      },
      writeString: function(str) {
        str = String(str);
        this.realloc(str.length * 4);
        this.pos++;
        var startPos = this.pos;
        this.pos = writeUtf82(this.buf, str, this.pos);
        var len = this.pos - startPos;
        if (len >= 128) makeRoomForExtraLength2(startPos, len, this);
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
      },
      writeFloat: function(val) {
        this.realloc(4);
        ieee754.write(this.buf, val, this.pos, true, 23, 4);
        this.pos += 4;
      },
      writeDouble: function(val) {
        this.realloc(8);
        ieee754.write(this.buf, val, this.pos, true, 52, 8);
        this.pos += 8;
      },
      writeBytes: function(buffer) {
        var len = buffer.length;
        this.writeVarint(len);
        this.realloc(len);
        for (var i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
      },
      writeRawMessage: function(fn, obj) {
        this.pos++;
        var startPos = this.pos;
        fn(obj, this);
        var len = this.pos - startPos;
        if (len >= 128) makeRoomForExtraLength2(startPos, len, this);
        this.pos = startPos - 1;
        this.writeVarint(len);
        this.pos += len;
      },
      writeMessage: function(tag, fn, obj) {
        this.writeTag(tag, Pbf2.Bytes);
        this.writeRawMessage(fn, obj);
      },
      writePackedVarint: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedVarint2, arr);
      },
      writePackedSVarint: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSVarint2, arr);
      },
      writePackedBoolean: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedBoolean2, arr);
      },
      writePackedFloat: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFloat2, arr);
      },
      writePackedDouble: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedDouble2, arr);
      },
      writePackedFixed32: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed322, arr);
      },
      writePackedSFixed32: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed322, arr);
      },
      writePackedFixed64: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedFixed642, arr);
      },
      writePackedSFixed64: function(tag, arr) {
        if (arr.length) this.writeMessage(tag, writePackedSFixed642, arr);
      },
      writeBytesField: function(tag, buffer) {
        this.writeTag(tag, Pbf2.Bytes);
        this.writeBytes(buffer);
      },
      writeFixed32Field: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed32);
        this.writeFixed32(val);
      },
      writeSFixed32Field: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed32);
        this.writeSFixed32(val);
      },
      writeFixed64Field: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed64);
        this.writeFixed64(val);
      },
      writeSFixed64Field: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed64);
        this.writeSFixed64(val);
      },
      writeVarintField: function(tag, val) {
        this.writeTag(tag, Pbf2.Varint);
        this.writeVarint(val);
      },
      writeSVarintField: function(tag, val) {
        this.writeTag(tag, Pbf2.Varint);
        this.writeSVarint(val);
      },
      writeStringField: function(tag, str) {
        this.writeTag(tag, Pbf2.Bytes);
        this.writeString(str);
      },
      writeFloatField: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed32);
        this.writeFloat(val);
      },
      writeDoubleField: function(tag, val) {
        this.writeTag(tag, Pbf2.Fixed64);
        this.writeDouble(val);
      },
      writeBooleanField: function(tag, val) {
        this.writeVarintField(tag, Boolean(val));
      }
    };
    function readVarintRemainder2(l, s, p) {
      var buf = p.buf, h, b;
      b = buf[p.pos++];
      h = (b & 112) >> 4;
      if (b < 128) return toNum2(l, h, s);
      b = buf[p.pos++];
      h |= (b & 127) << 3;
      if (b < 128) return toNum2(l, h, s);
      b = buf[p.pos++];
      h |= (b & 127) << 10;
      if (b < 128) return toNum2(l, h, s);
      b = buf[p.pos++];
      h |= (b & 127) << 17;
      if (b < 128) return toNum2(l, h, s);
      b = buf[p.pos++];
      h |= (b & 127) << 24;
      if (b < 128) return toNum2(l, h, s);
      b = buf[p.pos++];
      h |= (b & 1) << 31;
      if (b < 128) return toNum2(l, h, s);
      throw new Error("Expected varint not more than 10 bytes");
    }
    function readPackedEnd(pbf) {
      return pbf.type === Pbf2.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
    }
    function toNum2(low, high, isSigned) {
      if (isSigned) {
        return high * 4294967296 + (low >>> 0);
      }
      return (high >>> 0) * 4294967296 + (low >>> 0);
    }
    function writeBigVarint2(val, pbf) {
      var low, high;
      if (val >= 0) {
        low = val % 4294967296 | 0;
        high = val / 4294967296 | 0;
      } else {
        low = ~(-val % 4294967296);
        high = ~(-val / 4294967296);
        if (low ^ 4294967295) {
          low = low + 1 | 0;
        } else {
          low = 0;
          high = high + 1 | 0;
        }
      }
      if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
        throw new Error("Given varint doesn't fit into 10 bytes");
      }
      pbf.realloc(10);
      writeBigVarintLow2(low, high, pbf);
      writeBigVarintHigh2(high, pbf);
    }
    function writeBigVarintLow2(low, high, pbf) {
      pbf.buf[pbf.pos++] = low & 127 | 128;
      low >>>= 7;
      pbf.buf[pbf.pos++] = low & 127 | 128;
      low >>>= 7;
      pbf.buf[pbf.pos++] = low & 127 | 128;
      low >>>= 7;
      pbf.buf[pbf.pos++] = low & 127 | 128;
      low >>>= 7;
      pbf.buf[pbf.pos] = low & 127;
    }
    function writeBigVarintHigh2(high, pbf) {
      var lsb = (high & 7) << 4;
      pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
      if (!high) return;
      pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
      if (!high) return;
      pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
      if (!high) return;
      pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
      if (!high) return;
      pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
      if (!high) return;
      pbf.buf[pbf.pos++] = high & 127;
    }
    function makeRoomForExtraLength2(startPos, len, pbf) {
      var extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
      pbf.realloc(extraLen);
      for (var i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
    }
    function writePackedVarint2(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
    }
    function writePackedSVarint2(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
    }
    function writePackedFloat2(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
    }
    function writePackedDouble2(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
    }
    function writePackedBoolean2(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
    }
    function writePackedFixed322(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
    }
    function writePackedSFixed322(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
    }
    function writePackedFixed642(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
    }
    function writePackedSFixed642(arr, pbf) {
      for (var i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
    }
    function readUInt32(buf, pos) {
      return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + buf[pos + 3] * 16777216;
    }
    function writeInt32(buf, val, pos) {
      buf[pos] = val;
      buf[pos + 1] = val >>> 8;
      buf[pos + 2] = val >>> 16;
      buf[pos + 3] = val >>> 24;
    }
    function readInt32(buf, pos) {
      return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16) + (buf[pos + 3] << 24);
    }
    function readUtf83(buf, pos, end) {
      var str = "";
      var i = pos;
      while (i < end) {
        var b0 = buf[i];
        var c = null;
        var bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
        if (i + bytesPerSequence > end) break;
        var b1, b2, b3;
        if (bytesPerSequence === 1) {
          if (b0 < 128) {
            c = b0;
          }
        } else if (bytesPerSequence === 2) {
          b1 = buf[i + 1];
          if ((b1 & 192) === 128) {
            c = (b0 & 31) << 6 | b1 & 63;
            if (c <= 127) {
              c = null;
            }
          }
        } else if (bytesPerSequence === 3) {
          b1 = buf[i + 1];
          b2 = buf[i + 2];
          if ((b1 & 192) === 128 && (b2 & 192) === 128) {
            c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
            if (c <= 2047 || c >= 55296 && c <= 57343) {
              c = null;
            }
          }
        } else if (bytesPerSequence === 4) {
          b1 = buf[i + 1];
          b2 = buf[i + 2];
          b3 = buf[i + 3];
          if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
            c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
            if (c <= 65535 || c >= 1114112) {
              c = null;
            }
          }
        }
        if (c === null) {
          c = 65533;
          bytesPerSequence = 1;
        } else if (c > 65535) {
          c -= 65536;
          str += String.fromCharCode(c >>> 10 & 1023 | 55296);
          c = 56320 | c & 1023;
        }
        str += String.fromCharCode(c);
        i += bytesPerSequence;
      }
      return str;
    }
    function readUtf8TextDecoder(buf, pos, end) {
      return utf8TextDecoder3.decode(buf.subarray(pos, end));
    }
    function writeUtf82(buf, str, pos) {
      for (var i = 0, c, lead; i < str.length; i++) {
        c = str.charCodeAt(i);
        if (c > 55295 && c < 57344) {
          if (lead) {
            if (c < 56320) {
              buf[pos++] = 239;
              buf[pos++] = 191;
              buf[pos++] = 189;
              lead = c;
              continue;
            } else {
              c = lead - 55296 << 10 | c - 56320 | 65536;
              lead = null;
            }
          } else {
            if (c > 56319 || i + 1 === str.length) {
              buf[pos++] = 239;
              buf[pos++] = 191;
              buf[pos++] = 189;
            } else {
              lead = c;
            }
            continue;
          }
        } else if (lead) {
          buf[pos++] = 239;
          buf[pos++] = 191;
          buf[pos++] = 189;
          lead = null;
        }
        if (c < 128) {
          buf[pos++] = c;
        } else {
          if (c < 2048) {
            buf[pos++] = c >> 6 | 192;
          } else {
            if (c < 65536) {
              buf[pos++] = c >> 12 | 224;
            } else {
              buf[pos++] = c >> 18 | 240;
              buf[pos++] = c >> 12 & 63 | 128;
            }
            buf[pos++] = c >> 6 & 63 | 128;
          }
          buf[pos++] = c & 63 | 128;
        }
      }
      return pos;
    }
  }
});

// node_modules/vt-pbf/node_modules/@mapbox/point-geometry/index.js
var require_point_geometry = __commonJS({
  "node_modules/vt-pbf/node_modules/@mapbox/point-geometry/index.js"(exports, module) {
    "use strict";
    module.exports = Point2;
    function Point2(x, y) {
      this.x = x;
      this.y = y;
    }
    Point2.prototype = {
      /**
       * Clone this point, returning a new point that can be modified
       * without affecting the old one.
       * @return {Point} the clone
       */
      clone: function() {
        return new Point2(this.x, this.y);
      },
      /**
       * Add this point's x & y coordinates to another point,
       * yielding a new point.
       * @param {Point} p the other point
       * @return {Point} output point
       */
      add: function(p) {
        return this.clone()._add(p);
      },
      /**
       * Subtract this point's x & y coordinates to from point,
       * yielding a new point.
       * @param {Point} p the other point
       * @return {Point} output point
       */
      sub: function(p) {
        return this.clone()._sub(p);
      },
      /**
       * Multiply this point's x & y coordinates by point,
       * yielding a new point.
       * @param {Point} p the other point
       * @return {Point} output point
       */
      multByPoint: function(p) {
        return this.clone()._multByPoint(p);
      },
      /**
       * Divide this point's x & y coordinates by point,
       * yielding a new point.
       * @param {Point} p the other point
       * @return {Point} output point
       */
      divByPoint: function(p) {
        return this.clone()._divByPoint(p);
      },
      /**
       * Multiply this point's x & y coordinates by a factor,
       * yielding a new point.
       * @param {Point} k factor
       * @return {Point} output point
       */
      mult: function(k) {
        return this.clone()._mult(k);
      },
      /**
       * Divide this point's x & y coordinates by a factor,
       * yielding a new point.
       * @param {Point} k factor
       * @return {Point} output point
       */
      div: function(k) {
        return this.clone()._div(k);
      },
      /**
       * Rotate this point around the 0, 0 origin by an angle a,
       * given in radians
       * @param {Number} a angle to rotate around, in radians
       * @return {Point} output point
       */
      rotate: function(a) {
        return this.clone()._rotate(a);
      },
      /**
       * Rotate this point around p point by an angle a,
       * given in radians
       * @param {Number} a angle to rotate around, in radians
       * @param {Point} p Point to rotate around
       * @return {Point} output point
       */
      rotateAround: function(a, p) {
        return this.clone()._rotateAround(a, p);
      },
      /**
       * Multiply this point by a 4x1 transformation matrix
       * @param {Array<Number>} m transformation matrix
       * @return {Point} output point
       */
      matMult: function(m) {
        return this.clone()._matMult(m);
      },
      /**
       * Calculate this point but as a unit vector from 0, 0, meaning
       * that the distance from the resulting point to the 0, 0
       * coordinate will be equal to 1 and the angle from the resulting
       * point to the 0, 0 coordinate will be the same as before.
       * @return {Point} unit vector point
       */
      unit: function() {
        return this.clone()._unit();
      },
      /**
       * Compute a perpendicular point, where the new y coordinate
       * is the old x coordinate and the new x coordinate is the old y
       * coordinate multiplied by -1
       * @return {Point} perpendicular point
       */
      perp: function() {
        return this.clone()._perp();
      },
      /**
       * Return a version of this point with the x & y coordinates
       * rounded to integers.
       * @return {Point} rounded point
       */
      round: function() {
        return this.clone()._round();
      },
      /**
       * Return the magitude of this point: this is the Euclidean
       * distance from the 0, 0 coordinate to this point's x and y
       * coordinates.
       * @return {Number} magnitude
       */
      mag: function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
      },
      /**
       * Judge whether this point is equal to another point, returning
       * true or false.
       * @param {Point} other the other point
       * @return {boolean} whether the points are equal
       */
      equals: function(other) {
        return this.x === other.x && this.y === other.y;
      },
      /**
       * Calculate the distance from this point to another point
       * @param {Point} p the other point
       * @return {Number} distance
       */
      dist: function(p) {
        return Math.sqrt(this.distSqr(p));
      },
      /**
       * Calculate the distance from this point to another point,
       * without the square root step. Useful if you're comparing
       * relative distances.
       * @param {Point} p the other point
       * @return {Number} distance
       */
      distSqr: function(p) {
        var dx = p.x - this.x, dy = p.y - this.y;
        return dx * dx + dy * dy;
      },
      /**
       * Get the angle from the 0, 0 coordinate to this point, in radians
       * coordinates.
       * @return {Number} angle
       */
      angle: function() {
        return Math.atan2(this.y, this.x);
      },
      /**
       * Get the angle from this point to another point, in radians
       * @param {Point} b the other point
       * @return {Number} angle
       */
      angleTo: function(b) {
        return Math.atan2(this.y - b.y, this.x - b.x);
      },
      /**
       * Get the angle between this point and another point, in radians
       * @param {Point} b the other point
       * @return {Number} angle
       */
      angleWith: function(b) {
        return this.angleWithSep(b.x, b.y);
      },
      /*
       * Find the angle of the two vectors, solving the formula for
       * the cross product a x b = |a||b|sin(θ) for θ.
       * @param {Number} x the x-coordinate
       * @param {Number} y the y-coordinate
       * @return {Number} the angle in radians
       */
      angleWithSep: function(x, y) {
        return Math.atan2(
          this.x * y - this.y * x,
          this.x * x + this.y * y
        );
      },
      _matMult: function(m) {
        var x = m[0] * this.x + m[1] * this.y, y = m[2] * this.x + m[3] * this.y;
        this.x = x;
        this.y = y;
        return this;
      },
      _add: function(p) {
        this.x += p.x;
        this.y += p.y;
        return this;
      },
      _sub: function(p) {
        this.x -= p.x;
        this.y -= p.y;
        return this;
      },
      _mult: function(k) {
        this.x *= k;
        this.y *= k;
        return this;
      },
      _div: function(k) {
        this.x /= k;
        this.y /= k;
        return this;
      },
      _multByPoint: function(p) {
        this.x *= p.x;
        this.y *= p.y;
        return this;
      },
      _divByPoint: function(p) {
        this.x /= p.x;
        this.y /= p.y;
        return this;
      },
      _unit: function() {
        this._div(this.mag());
        return this;
      },
      _perp: function() {
        var y = this.y;
        this.y = this.x;
        this.x = -y;
        return this;
      },
      _rotate: function(angle) {
        var cos = Math.cos(angle), sin = Math.sin(angle), x = cos * this.x - sin * this.y, y = sin * this.x + cos * this.y;
        this.x = x;
        this.y = y;
        return this;
      },
      _rotateAround: function(angle, p) {
        var cos = Math.cos(angle), sin = Math.sin(angle), x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
        this.x = x;
        this.y = y;
        return this;
      },
      _round: function() {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
      }
    };
    Point2.convert = function(a) {
      if (a instanceof Point2) {
        return a;
      }
      if (Array.isArray(a)) {
        return new Point2(a[0], a[1]);
      }
      return a;
    };
  }
});

// node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortilefeature.js
var require_vectortilefeature = __commonJS({
  "node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortilefeature.js"(exports, module) {
    "use strict";
    var Point2 = require_point_geometry();
    module.exports = VectorTileFeature2;
    function VectorTileFeature2(pbf, end, extent, keys, values) {
      this.properties = {};
      this.extent = extent;
      this.type = 0;
      this._pbf = pbf;
      this._geometry = -1;
      this._keys = keys;
      this._values = values;
      pbf.readFields(readFeature, this, end);
    }
    function readFeature(tag, feature, pbf) {
      if (tag == 1) feature.id = pbf.readVarint();
      else if (tag == 2) readTag(pbf, feature);
      else if (tag == 3) feature.type = pbf.readVarint();
      else if (tag == 4) feature._geometry = pbf.pos;
    }
    function readTag(pbf, feature) {
      var end = pbf.readVarint() + pbf.pos;
      while (pbf.pos < end) {
        var key = feature._keys[pbf.readVarint()], value = feature._values[pbf.readVarint()];
        feature.properties[key] = value;
      }
    }
    VectorTileFeature2.types = ["Unknown", "Point", "LineString", "Polygon"];
    VectorTileFeature2.prototype.loadGeometry = function() {
      var pbf = this._pbf;
      pbf.pos = this._geometry;
      var end = pbf.readVarint() + pbf.pos, cmd = 1, length = 0, x = 0, y = 0, lines = [], line;
      while (pbf.pos < end) {
        if (length <= 0) {
          var cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (cmd === 1) {
            if (line) lines.push(line);
            line = [];
          }
          line.push(new Point2(x, y));
        } else if (cmd === 7) {
          if (line) {
            line.push(line[0].clone());
          }
        } else {
          throw new Error("unknown command " + cmd);
        }
      }
      if (line) lines.push(line);
      return lines;
    };
    VectorTileFeature2.prototype.bbox = function() {
      var pbf = this._pbf;
      pbf.pos = this._geometry;
      var end = pbf.readVarint() + pbf.pos, cmd = 1, length = 0, x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      while (pbf.pos < end) {
        if (length <= 0) {
          var cmdLen = pbf.readVarint();
          cmd = cmdLen & 7;
          length = cmdLen >> 3;
        }
        length--;
        if (cmd === 1 || cmd === 2) {
          x += pbf.readSVarint();
          y += pbf.readSVarint();
          if (x < x1) x1 = x;
          if (x > x2) x2 = x;
          if (y < y1) y1 = y;
          if (y > y2) y2 = y;
        } else if (cmd !== 7) {
          throw new Error("unknown command " + cmd);
        }
      }
      return [x1, y1, x2, y2];
    };
    VectorTileFeature2.prototype.toGeoJSON = function(x, y, z) {
      var size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, coords = this.loadGeometry(), type = VectorTileFeature2.types[this.type], i, j;
      function project(line) {
        for (var j2 = 0; j2 < line.length; j2++) {
          var p = line[j2], y2 = 180 - (p.y + y0) * 360 / size;
          line[j2] = [
            (p.x + x0) * 360 / size - 180,
            360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
          ];
        }
      }
      switch (this.type) {
        case 1:
          var points = [];
          for (i = 0; i < coords.length; i++) {
            points[i] = coords[i][0];
          }
          coords = points;
          project(coords);
          break;
        case 2:
          for (i = 0; i < coords.length; i++) {
            project(coords[i]);
          }
          break;
        case 3:
          coords = classifyRings2(coords);
          for (i = 0; i < coords.length; i++) {
            for (j = 0; j < coords[i].length; j++) {
              project(coords[i][j]);
            }
          }
          break;
      }
      if (coords.length === 1) {
        coords = coords[0];
      } else {
        type = "Multi" + type;
      }
      var result = {
        type: "Feature",
        geometry: {
          type,
          coordinates: coords
        },
        properties: this.properties
      };
      if ("id" in this) {
        result.id = this.id;
      }
      return result;
    };
    function classifyRings2(rings) {
      var len = rings.length;
      if (len <= 1) return [rings];
      var polygons = [], polygon, ccw;
      for (var i = 0; i < len; i++) {
        var area = signedArea2(rings[i]);
        if (area === 0) continue;
        if (ccw === void 0) ccw = area < 0;
        if (ccw === area < 0) {
          if (polygon) polygons.push(polygon);
          polygon = [rings[i]];
        } else {
          polygon.push(rings[i]);
        }
      }
      if (polygon) polygons.push(polygon);
      return polygons;
    }
    function signedArea2(ring) {
      var sum = 0;
      for (var i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
      }
      return sum;
    }
  }
});

// node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortilelayer.js
var require_vectortilelayer = __commonJS({
  "node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortilelayer.js"(exports, module) {
    "use strict";
    var VectorTileFeature2 = require_vectortilefeature();
    module.exports = VectorTileLayer2;
    function VectorTileLayer2(pbf, end) {
      this.version = 1;
      this.name = null;
      this.extent = 4096;
      this.length = 0;
      this._pbf = pbf;
      this._keys = [];
      this._values = [];
      this._features = [];
      pbf.readFields(readLayer, this, end);
      this.length = this._features.length;
    }
    function readLayer(tag, layer, pbf) {
      if (tag === 15) layer.version = pbf.readVarint();
      else if (tag === 1) layer.name = pbf.readString();
      else if (tag === 5) layer.extent = pbf.readVarint();
      else if (tag === 2) layer._features.push(pbf.pos);
      else if (tag === 3) layer._keys.push(pbf.readString());
      else if (tag === 4) layer._values.push(readValueMessage2(pbf));
    }
    function readValueMessage2(pbf) {
      var value = null, end = pbf.readVarint() + pbf.pos;
      while (pbf.pos < end) {
        var tag = pbf.readVarint() >> 3;
        value = tag === 1 ? pbf.readString() : tag === 2 ? pbf.readFloat() : tag === 3 ? pbf.readDouble() : tag === 4 ? pbf.readVarint64() : tag === 5 ? pbf.readVarint() : tag === 6 ? pbf.readSVarint() : tag === 7 ? pbf.readBoolean() : null;
      }
      return value;
    }
    VectorTileLayer2.prototype.feature = function(i) {
      if (i < 0 || i >= this._features.length) throw new Error("feature index out of bounds");
      this._pbf.pos = this._features[i];
      var end = this._pbf.readVarint() + this._pbf.pos;
      return new VectorTileFeature2(this._pbf, end, this.extent, this._keys, this._values);
    };
  }
});

// node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortile.js
var require_vectortile = __commonJS({
  "node_modules/vt-pbf/node_modules/@mapbox/vector-tile/lib/vectortile.js"(exports, module) {
    "use strict";
    var VectorTileLayer2 = require_vectortilelayer();
    module.exports = VectorTile2;
    function VectorTile2(pbf, end) {
      this.layers = pbf.readFields(readTile, {}, end);
    }
    function readTile(tag, layers, pbf) {
      if (tag === 3) {
        var layer = new VectorTileLayer2(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
      }
    }
  }
});

// node_modules/vt-pbf/node_modules/@mapbox/vector-tile/index.js
var require_vector_tile = __commonJS({
  "node_modules/vt-pbf/node_modules/@mapbox/vector-tile/index.js"(exports, module) {
    module.exports.VectorTile = require_vectortile();
    module.exports.VectorTileFeature = require_vectortilefeature();
    module.exports.VectorTileLayer = require_vectortilelayer();
  }
});

// node_modules/vt-pbf/lib/geojson_wrapper.js
var require_geojson_wrapper = __commonJS({
  "node_modules/vt-pbf/lib/geojson_wrapper.js"(exports, module) {
    "use strict";
    var Point2 = require_point_geometry();
    var VectorTileFeature2 = require_vector_tile().VectorTileFeature;
    module.exports = GeoJSONWrapper;
    function GeoJSONWrapper(features, options) {
      this.options = options || {};
      this.features = features;
      this.length = features.length;
    }
    GeoJSONWrapper.prototype.feature = function(i) {
      return new FeatureWrapper(this.features[i], this.options.extent);
    };
    function FeatureWrapper(feature, extent) {
      this.id = typeof feature.id === "number" ? feature.id : void 0;
      this.type = feature.type;
      this.rawGeometry = feature.type === 1 ? [feature.geometry] : feature.geometry;
      this.properties = feature.tags;
      this.extent = extent || 4096;
    }
    FeatureWrapper.prototype.loadGeometry = function() {
      var rings = this.rawGeometry;
      this.geometry = [];
      for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        var newRing = [];
        for (var j = 0; j < ring.length; j++) {
          newRing.push(new Point2(ring[j][0], ring[j][1]));
        }
        this.geometry.push(newRing);
      }
      return this.geometry;
    };
    FeatureWrapper.prototype.bbox = function() {
      if (!this.geometry) this.loadGeometry();
      var rings = this.geometry;
      var x1 = Infinity;
      var x2 = -Infinity;
      var y1 = Infinity;
      var y2 = -Infinity;
      for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 0; j < ring.length; j++) {
          var coord = ring[j];
          x1 = Math.min(x1, coord.x);
          x2 = Math.max(x2, coord.x);
          y1 = Math.min(y1, coord.y);
          y2 = Math.max(y2, coord.y);
        }
      }
      return [x1, y1, x2, y2];
    };
    FeatureWrapper.prototype.toGeoJSON = VectorTileFeature2.prototype.toGeoJSON;
  }
});

// node_modules/vt-pbf/index.js
var require_vt_pbf = __commonJS({
  "node_modules/vt-pbf/index.js"(exports, module) {
    var Pbf2 = require_pbf();
    var GeoJSONWrapper = require_geojson_wrapper();
    module.exports = fromVectorTileJs;
    module.exports.fromVectorTileJs = fromVectorTileJs;
    module.exports.fromGeojsonVt = fromGeojsonVt;
    module.exports.GeoJSONWrapper = GeoJSONWrapper;
    function fromVectorTileJs(tile) {
      var out = new Pbf2();
      writeTile(tile, out);
      return out.finish();
    }
    function fromGeojsonVt(layers, options) {
      options = options || {};
      var l = {};
      for (var k in layers) {
        l[k] = new GeoJSONWrapper(layers[k].features, options);
        l[k].name = k;
        l[k].version = options.version;
        l[k].extent = options.extent;
      }
      return fromVectorTileJs({ layers: l });
    }
    function writeTile(tile, pbf) {
      for (var key in tile.layers) {
        pbf.writeMessage(3, writeLayer, tile.layers[key]);
      }
    }
    function writeLayer(layer, pbf) {
      pbf.writeVarintField(15, layer.version || 1);
      pbf.writeStringField(1, layer.name || "");
      pbf.writeVarintField(5, layer.extent || 4096);
      var i;
      var context = {
        keys: [],
        values: [],
        keycache: {},
        valuecache: {}
      };
      for (i = 0; i < layer.length; i++) {
        context.feature = layer.feature(i);
        pbf.writeMessage(2, writeFeature, context);
      }
      var keys = context.keys;
      for (i = 0; i < keys.length; i++) {
        pbf.writeStringField(3, keys[i]);
      }
      var values = context.values;
      for (i = 0; i < values.length; i++) {
        pbf.writeMessage(4, writeValue, values[i]);
      }
    }
    function writeFeature(context, pbf) {
      var feature = context.feature;
      if (feature.id !== void 0) {
        pbf.writeVarintField(1, feature.id);
      }
      pbf.writeMessage(2, writeProperties, context);
      pbf.writeVarintField(3, feature.type);
      pbf.writeMessage(4, writeGeometry, feature);
    }
    function writeProperties(context, pbf) {
      var feature = context.feature;
      var keys = context.keys;
      var values = context.values;
      var keycache = context.keycache;
      var valuecache = context.valuecache;
      for (var key in feature.properties) {
        var value = feature.properties[key];
        var keyIndex = keycache[key];
        if (value === null) continue;
        if (typeof keyIndex === "undefined") {
          keys.push(key);
          keyIndex = keys.length - 1;
          keycache[key] = keyIndex;
        }
        pbf.writeVarint(keyIndex);
        var type = typeof value;
        if (type !== "string" && type !== "boolean" && type !== "number") {
          value = JSON.stringify(value);
        }
        var valueKey = type + ":" + value;
        var valueIndex = valuecache[valueKey];
        if (typeof valueIndex === "undefined") {
          values.push(value);
          valueIndex = values.length - 1;
          valuecache[valueKey] = valueIndex;
        }
        pbf.writeVarint(valueIndex);
      }
    }
    function command(cmd, length) {
      return (length << 3) + (cmd & 7);
    }
    function zigzag(num) {
      return num << 1 ^ num >> 31;
    }
    function writeGeometry(feature, pbf) {
      var geometry = feature.loadGeometry();
      var type = feature.type;
      var x = 0;
      var y = 0;
      var rings = geometry.length;
      for (var r = 0; r < rings; r++) {
        var ring = geometry[r];
        var count = 1;
        if (type === 1) {
          count = ring.length;
        }
        pbf.writeVarint(command(1, count));
        var lineCount = type === 3 ? ring.length - 1 : ring.length;
        for (var i = 0; i < lineCount; i++) {
          if (i === 1 && type !== 1) {
            pbf.writeVarint(command(2, lineCount - 1));
          }
          var dx = ring[i].x - x;
          var dy = ring[i].y - y;
          pbf.writeVarint(zigzag(dx));
          pbf.writeVarint(zigzag(dy));
          x += dx;
          y += dy;
        }
        if (type === 3) {
          pbf.writeVarint(command(7, 1));
        }
      }
    }
    function writeValue(value, pbf) {
      var type = typeof value;
      if (type === "string") {
        pbf.writeStringField(1, value);
      } else if (type === "boolean") {
        pbf.writeBooleanField(7, value);
      } else if (type === "number") {
        if (value % 1 !== 0) {
          pbf.writeDoubleField(3, value);
        } else if (value < 0) {
          pbf.writeSVarintField(6, value);
        } else {
          pbf.writeVarintField(5, value);
        }
      }
    }
  }
});

// node_modules/@maplibre/mlt/dist/vector/vector.js
var Vector = class {
  constructor(_name, dataBuffer, sizeOrNullabilityBuffer) {
    this._name = _name;
    this.dataBuffer = dataBuffer;
    if (typeof sizeOrNullabilityBuffer === "number") {
      this._size = sizeOrNullabilityBuffer;
    } else {
      this.nullabilityBuffer = sizeOrNullabilityBuffer;
      this._size = sizeOrNullabilityBuffer.size();
    }
  }
  getValue(index) {
    return this.nullabilityBuffer && !this.nullabilityBuffer.get(index) ? null : this.getValueFromBuffer(index);
  }
  has(index) {
    return this.nullabilityBuffer?.get(index) || !this.nullabilityBuffer;
  }
  get name() {
    return this._name;
  }
  get size() {
    return this._size;
  }
};

// node_modules/@maplibre/mlt/dist/vector/fixedSizeVector.js
var FixedSizeVector = class extends Vector {
};

// node_modules/@maplibre/mlt/dist/vector/flat/int32FlatVector.js
var Int32FlatVector = class extends FixedSizeVector {
  getValueFromBuffer(index) {
    return this.dataBuffer[index];
  }
};

// node_modules/@maplibre/mlt/dist/vector/flat/doubleFlatVector.js
var DoubleFlatVector = class extends FixedSizeVector {
  getValueFromBuffer(index) {
    return this.dataBuffer[index];
  }
};

// node_modules/@maplibre/mlt/dist/vector/sequence/sequenceVector.js
var SequenceVector = class extends Vector {
  constructor(name, baseValueBuffer, delta, size) {
    super(name, baseValueBuffer, size);
    this.delta = delta;
  }
};

// node_modules/@maplibre/mlt/dist/vector/sequence/int32SequenceVector.js
var Int32SequenceVector = class extends SequenceVector {
  constructor(name, baseValue, delta, size, isSigned) {
    super(name, isSigned ? Int32Array.of(baseValue) : Uint32Array.of(baseValue), delta, size);
  }
  getValueFromBuffer(index) {
    return this.dataBuffer[0] + index * this.delta;
  }
};

// node_modules/@maplibre/mlt/dist/vector/constant/int32ConstVector.js
var Int32ConstVector = class extends Vector {
  constructor(name, value, sizeOrNullabilityBuffer, isSigned) {
    super(name, isSigned ? Int32Array.of(value) : Uint32Array.of(value), sizeOrNullabilityBuffer);
  }
  getValueFromBuffer(_index) {
    return this.dataBuffer[0];
  }
};

// node_modules/@maplibre/mlt/dist/vector/featureTable.js
var FeatureTable = class {
  constructor(_name, _geometryVector, _idVector, _propertyVectors, _extent = 4096) {
    this._name = _name;
    this._geometryVector = _geometryVector;
    this._idVector = _idVector;
    this._propertyVectors = _propertyVectors;
    this._extent = _extent;
    if (_name.length === 0) {
      throw new Error("Missing layer name");
    }
  }
  get name() {
    return this._name;
  }
  get idVector() {
    return this._idVector;
  }
  get geometryVector() {
    return this._geometryVector;
  }
  get propertyVectors() {
    return this._propertyVectors ?? [];
  }
  getPropertyVector(name) {
    if (!this.propertyVectorsMap) {
      this.propertyVectorsMap = new Map(this.propertyVectors.map((vector) => [vector.name, vector]));
    }
    return this.propertyVectorsMap.get(name);
  }
  get numFeatures() {
    return this.geometryVector.numGeometries;
  }
  get extent() {
    return this._extent;
  }
  /**
   * Returns all features as an array
   */
  getFeatures() {
    const features = [];
    const geometries = this.geometryVector.getGeometries();
    for (let i = 0; i < this.numFeatures; i++) {
      let id;
      if (this.idVector) {
        const idValue = this.idVector.getValue(i);
        if (idValue !== null) {
          id = this.containsMaxSafeIntegerValues(this.idVector) ? Number(idValue) : idValue;
        }
      }
      const geometry = {
        coordinates: geometries[i],
        type: this.geometryVector.geometryType(i)
      };
      const properties = {};
      for (const propertyColumn of this.propertyVectors) {
        if (!propertyColumn)
          continue;
        const columnName = propertyColumn.name;
        const propertyValue = propertyColumn.getValue(i);
        if (propertyValue !== null) {
          properties[columnName] = propertyValue;
        }
      }
      features.push({ id, geometry, properties });
    }
    return features;
  }
  containsMaxSafeIntegerValues(idVector) {
    return idVector instanceof Int32FlatVector || idVector instanceof Int32ConstVector || idVector instanceof Int32SequenceVector || idVector instanceof DoubleFlatVector;
  }
};

// node_modules/@maplibre/mlt/dist/metadata/tileset/tilesetMetadata.js
var ColumnScope = {
  FEATURE: 0,
  VERTEX: 1
};
var ScalarType = {
  BOOLEAN: 0,
  INT_8: 1,
  UINT_8: 2,
  INT_32: 3,
  UINT_32: 4,
  INT_64: 5,
  UINT_64: 6,
  FLOAT: 7,
  DOUBLE: 8,
  STRING: 9
};
var ComplexType = {
  GEOMETRY: 0,
  STRUCT: 1,
  MAP: 2
};
var LogicalScalarType = {
  ID: 0
};

// node_modules/@maplibre/mlt/dist/decoding/intWrapper.js
var IntWrapper = class {
  constructor(value) {
    this.value = value;
  }
  get() {
    return this.value;
  }
  set(v) {
    this.value = v;
  }
  increment() {
    return this.value++;
  }
  add(v) {
    this.value += v;
  }
};

// node_modules/@maplibre/mlt/dist/metadata/tile/logicalLevelTechnique.js
var LogicalLevelTechnique;
(function(LogicalLevelTechnique2) {
  LogicalLevelTechnique2["NONE"] = "NONE";
  LogicalLevelTechnique2["DELTA"] = "DELTA";
  LogicalLevelTechnique2["COMPONENTWISE_DELTA"] = "COMPONENTWISE_DELTA";
  LogicalLevelTechnique2["RLE"] = "RLE";
  LogicalLevelTechnique2["MORTON"] = "MORTON";
})(LogicalLevelTechnique || (LogicalLevelTechnique = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/physicalLevelTechnique.js
var PhysicalLevelTechnique;
(function(PhysicalLevelTechnique2) {
  PhysicalLevelTechnique2["NONE"] = "NONE";
  PhysicalLevelTechnique2["FAST_PFOR"] = "FAST_PFOR";
  PhysicalLevelTechnique2["VARINT"] = "VARINT";
})(PhysicalLevelTechnique || (PhysicalLevelTechnique = {}));

// node_modules/@maplibre/mlt/dist/decoding/fastPforShared.js
var masks = new Uint32Array(33);
masks[0] = 0;
for (let bitWidth = 1; bitWidth <= 32; bitWidth++) {
  masks[bitWidth] = bitWidth === 32 ? 4294967295 : 4294967295 >>> 32 - bitWidth;
}
var MASKS = masks;
var DEFAULT_PAGE_SIZE = 65536;
var BLOCK_SIZE = 256;
function greatestMultiple(value, factor) {
  return value - value % factor;
}
function roundUpToMultipleOf32(value) {
  return greatestMultiple(value + 31, 32);
}
function normalizePageSize(pageSize) {
  if (!Number.isFinite(pageSize) || pageSize <= 0)
    return DEFAULT_PAGE_SIZE;
  const aligned = greatestMultiple(Math.floor(pageSize), BLOCK_SIZE);
  return aligned === 0 ? BLOCK_SIZE : aligned;
}
function bswap32(value) {
  const x = value >>> 0;
  return ((x & 255) << 24 | (x & 65280) << 8 | x >>> 8 & 65280 | x >>> 24 & 255) >>> 0;
}

// node_modules/@maplibre/mlt/dist/decoding/fastPforUnpack.js
function fastUnpack32_2(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  out[op++] = in0 >>> 0 & 3;
  out[op++] = in0 >>> 2 & 3;
  out[op++] = in0 >>> 4 & 3;
  out[op++] = in0 >>> 6 & 3;
  out[op++] = in0 >>> 8 & 3;
  out[op++] = in0 >>> 10 & 3;
  out[op++] = in0 >>> 12 & 3;
  out[op++] = in0 >>> 14 & 3;
  out[op++] = in0 >>> 16 & 3;
  out[op++] = in0 >>> 18 & 3;
  out[op++] = in0 >>> 20 & 3;
  out[op++] = in0 >>> 22 & 3;
  out[op++] = in0 >>> 24 & 3;
  out[op++] = in0 >>> 26 & 3;
  out[op++] = in0 >>> 28 & 3;
  out[op++] = in0 >>> 30 & 3;
  out[op++] = in1 >>> 0 & 3;
  out[op++] = in1 >>> 2 & 3;
  out[op++] = in1 >>> 4 & 3;
  out[op++] = in1 >>> 6 & 3;
  out[op++] = in1 >>> 8 & 3;
  out[op++] = in1 >>> 10 & 3;
  out[op++] = in1 >>> 12 & 3;
  out[op++] = in1 >>> 14 & 3;
  out[op++] = in1 >>> 16 & 3;
  out[op++] = in1 >>> 18 & 3;
  out[op++] = in1 >>> 20 & 3;
  out[op++] = in1 >>> 22 & 3;
  out[op++] = in1 >>> 24 & 3;
  out[op++] = in1 >>> 26 & 3;
  out[op++] = in1 >>> 28 & 3;
  out[op] = in1 >>> 30 & 3;
}
function fastUnpack32_3(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  out[op++] = in0 >>> 0 & 7;
  out[op++] = in0 >>> 3 & 7;
  out[op++] = in0 >>> 6 & 7;
  out[op++] = in0 >>> 9 & 7;
  out[op++] = in0 >>> 12 & 7;
  out[op++] = in0 >>> 15 & 7;
  out[op++] = in0 >>> 18 & 7;
  out[op++] = in0 >>> 21 & 7;
  out[op++] = in0 >>> 24 & 7;
  out[op++] = in0 >>> 27 & 7;
  out[op++] = (in0 >>> 30 | (in1 & 1) << 2) & 7;
  out[op++] = in1 >>> 1 & 7;
  out[op++] = in1 >>> 4 & 7;
  out[op++] = in1 >>> 7 & 7;
  out[op++] = in1 >>> 10 & 7;
  out[op++] = in1 >>> 13 & 7;
  out[op++] = in1 >>> 16 & 7;
  out[op++] = in1 >>> 19 & 7;
  out[op++] = in1 >>> 22 & 7;
  out[op++] = in1 >>> 25 & 7;
  out[op++] = in1 >>> 28 & 7;
  out[op++] = (in1 >>> 31 | (in2 & 3) << 1) & 7;
  out[op++] = in2 >>> 2 & 7;
  out[op++] = in2 >>> 5 & 7;
  out[op++] = in2 >>> 8 & 7;
  out[op++] = in2 >>> 11 & 7;
  out[op++] = in2 >>> 14 & 7;
  out[op++] = in2 >>> 17 & 7;
  out[op++] = in2 >>> 20 & 7;
  out[op++] = in2 >>> 23 & 7;
  out[op++] = in2 >>> 26 & 7;
  out[op] = in2 >>> 29 & 7;
}
function fastUnpack32_4(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  out[op++] = in0 >>> 0 & 15;
  out[op++] = in0 >>> 4 & 15;
  out[op++] = in0 >>> 8 & 15;
  out[op++] = in0 >>> 12 & 15;
  out[op++] = in0 >>> 16 & 15;
  out[op++] = in0 >>> 20 & 15;
  out[op++] = in0 >>> 24 & 15;
  out[op++] = in0 >>> 28 & 15;
  out[op++] = in1 >>> 0 & 15;
  out[op++] = in1 >>> 4 & 15;
  out[op++] = in1 >>> 8 & 15;
  out[op++] = in1 >>> 12 & 15;
  out[op++] = in1 >>> 16 & 15;
  out[op++] = in1 >>> 20 & 15;
  out[op++] = in1 >>> 24 & 15;
  out[op++] = in1 >>> 28 & 15;
  out[op++] = in2 >>> 0 & 15;
  out[op++] = in2 >>> 4 & 15;
  out[op++] = in2 >>> 8 & 15;
  out[op++] = in2 >>> 12 & 15;
  out[op++] = in2 >>> 16 & 15;
  out[op++] = in2 >>> 20 & 15;
  out[op++] = in2 >>> 24 & 15;
  out[op++] = in2 >>> 28 & 15;
  out[op++] = in3 >>> 0 & 15;
  out[op++] = in3 >>> 4 & 15;
  out[op++] = in3 >>> 8 & 15;
  out[op++] = in3 >>> 12 & 15;
  out[op++] = in3 >>> 16 & 15;
  out[op++] = in3 >>> 20 & 15;
  out[op++] = in3 >>> 24 & 15;
  out[op] = in3 >>> 28 & 15;
}
function fastUnpack32_5(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  out[op++] = in0 >>> 0 & 31;
  out[op++] = in0 >>> 5 & 31;
  out[op++] = in0 >>> 10 & 31;
  out[op++] = in0 >>> 15 & 31;
  out[op++] = in0 >>> 20 & 31;
  out[op++] = in0 >>> 25 & 31;
  out[op++] = (in0 >>> 30 | (in1 & 7) << 2) & 31;
  out[op++] = in1 >>> 3 & 31;
  out[op++] = in1 >>> 8 & 31;
  out[op++] = in1 >>> 13 & 31;
  out[op++] = in1 >>> 18 & 31;
  out[op++] = in1 >>> 23 & 31;
  out[op++] = (in1 >>> 28 | (in2 & 1) << 4) & 31;
  out[op++] = in2 >>> 1 & 31;
  out[op++] = in2 >>> 6 & 31;
  out[op++] = in2 >>> 11 & 31;
  out[op++] = in2 >>> 16 & 31;
  out[op++] = in2 >>> 21 & 31;
  out[op++] = in2 >>> 26 & 31;
  out[op++] = (in2 >>> 31 | (in3 & 15) << 1) & 31;
  out[op++] = in3 >>> 4 & 31;
  out[op++] = in3 >>> 9 & 31;
  out[op++] = in3 >>> 14 & 31;
  out[op++] = in3 >>> 19 & 31;
  out[op++] = in3 >>> 24 & 31;
  out[op++] = (in3 >>> 29 | (in4 & 3) << 3) & 31;
  out[op++] = in4 >>> 2 & 31;
  out[op++] = in4 >>> 7 & 31;
  out[op++] = in4 >>> 12 & 31;
  out[op++] = in4 >>> 17 & 31;
  out[op++] = in4 >>> 22 & 31;
  out[op] = in4 >>> 27 & 31;
}
function fastUnpack32_6(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  out[op++] = in0 >>> 0 & 63;
  out[op++] = in0 >>> 6 & 63;
  out[op++] = in0 >>> 12 & 63;
  out[op++] = in0 >>> 18 & 63;
  out[op++] = in0 >>> 24 & 63;
  out[op++] = (in0 >>> 30 | (in1 & 15) << 2) & 63;
  out[op++] = in1 >>> 4 & 63;
  out[op++] = in1 >>> 10 & 63;
  out[op++] = in1 >>> 16 & 63;
  out[op++] = in1 >>> 22 & 63;
  out[op++] = (in1 >>> 28 | (in2 & 3) << 4) & 63;
  out[op++] = in2 >>> 2 & 63;
  out[op++] = in2 >>> 8 & 63;
  out[op++] = in2 >>> 14 & 63;
  out[op++] = in2 >>> 20 & 63;
  out[op++] = in2 >>> 26 & 63;
  out[op++] = in3 >>> 0 & 63;
  out[op++] = in3 >>> 6 & 63;
  out[op++] = in3 >>> 12 & 63;
  out[op++] = in3 >>> 18 & 63;
  out[op++] = in3 >>> 24 & 63;
  out[op++] = (in3 >>> 30 | (in4 & 15) << 2) & 63;
  out[op++] = in4 >>> 4 & 63;
  out[op++] = in4 >>> 10 & 63;
  out[op++] = in4 >>> 16 & 63;
  out[op++] = in4 >>> 22 & 63;
  out[op++] = (in4 >>> 28 | (in5 & 3) << 4) & 63;
  out[op++] = in5 >>> 2 & 63;
  out[op++] = in5 >>> 8 & 63;
  out[op++] = in5 >>> 14 & 63;
  out[op++] = in5 >>> 20 & 63;
  out[op] = in5 >>> 26 & 63;
}
function fastUnpack32_7(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  out[op++] = in0 >>> 0 & 127;
  out[op++] = in0 >>> 7 & 127;
  out[op++] = in0 >>> 14 & 127;
  out[op++] = in0 >>> 21 & 127;
  out[op++] = (in0 >>> 28 | (in1 & 7) << 4) & 127;
  out[op++] = in1 >>> 3 & 127;
  out[op++] = in1 >>> 10 & 127;
  out[op++] = in1 >>> 17 & 127;
  out[op++] = in1 >>> 24 & 127;
  out[op++] = (in1 >>> 31 | (in2 & 63) << 1) & 127;
  out[op++] = in2 >>> 6 & 127;
  out[op++] = in2 >>> 13 & 127;
  out[op++] = in2 >>> 20 & 127;
  out[op++] = (in2 >>> 27 | (in3 & 3) << 5) & 127;
  out[op++] = in3 >>> 2 & 127;
  out[op++] = in3 >>> 9 & 127;
  out[op++] = in3 >>> 16 & 127;
  out[op++] = in3 >>> 23 & 127;
  out[op++] = (in3 >>> 30 | (in4 & 31) << 2) & 127;
  out[op++] = in4 >>> 5 & 127;
  out[op++] = in4 >>> 12 & 127;
  out[op++] = in4 >>> 19 & 127;
  out[op++] = (in4 >>> 26 | (in5 & 1) << 6) & 127;
  out[op++] = in5 >>> 1 & 127;
  out[op++] = in5 >>> 8 & 127;
  out[op++] = in5 >>> 15 & 127;
  out[op++] = in5 >>> 22 & 127;
  out[op++] = (in5 >>> 29 | (in6 & 15) << 3) & 127;
  out[op++] = in6 >>> 4 & 127;
  out[op++] = in6 >>> 11 & 127;
  out[op++] = in6 >>> 18 & 127;
  out[op] = in6 >>> 25 & 127;
}
function fastUnpack32_8(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  out[op++] = in0 >>> 0 & 255;
  out[op++] = in0 >>> 8 & 255;
  out[op++] = in0 >>> 16 & 255;
  out[op++] = in0 >>> 24 & 255;
  out[op++] = in1 >>> 0 & 255;
  out[op++] = in1 >>> 8 & 255;
  out[op++] = in1 >>> 16 & 255;
  out[op++] = in1 >>> 24 & 255;
  out[op++] = in2 >>> 0 & 255;
  out[op++] = in2 >>> 8 & 255;
  out[op++] = in2 >>> 16 & 255;
  out[op++] = in2 >>> 24 & 255;
  out[op++] = in3 >>> 0 & 255;
  out[op++] = in3 >>> 8 & 255;
  out[op++] = in3 >>> 16 & 255;
  out[op++] = in3 >>> 24 & 255;
  out[op++] = in4 >>> 0 & 255;
  out[op++] = in4 >>> 8 & 255;
  out[op++] = in4 >>> 16 & 255;
  out[op++] = in4 >>> 24 & 255;
  out[op++] = in5 >>> 0 & 255;
  out[op++] = in5 >>> 8 & 255;
  out[op++] = in5 >>> 16 & 255;
  out[op++] = in5 >>> 24 & 255;
  out[op++] = in6 >>> 0 & 255;
  out[op++] = in6 >>> 8 & 255;
  out[op++] = in6 >>> 16 & 255;
  out[op++] = in6 >>> 24 & 255;
  out[op++] = in7 >>> 0 & 255;
  out[op++] = in7 >>> 8 & 255;
  out[op++] = in7 >>> 16 & 255;
  out[op] = in7 >>> 24 & 255;
}
function fastUnpack32_9(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  const in8 = inValues[inPos + 8] >>> 0;
  out[op++] = in0 >>> 0 & 511;
  out[op++] = in0 >>> 9 & 511;
  out[op++] = in0 >>> 18 & 511;
  out[op++] = (in0 >>> 27 | (in1 & 15) << 5) & 511;
  out[op++] = in1 >>> 4 & 511;
  out[op++] = in1 >>> 13 & 511;
  out[op++] = in1 >>> 22 & 511;
  out[op++] = (in1 >>> 31 | (in2 & 255) << 1) & 511;
  out[op++] = in2 >>> 8 & 511;
  out[op++] = in2 >>> 17 & 511;
  out[op++] = (in2 >>> 26 | (in3 & 7) << 6) & 511;
  out[op++] = in3 >>> 3 & 511;
  out[op++] = in3 >>> 12 & 511;
  out[op++] = in3 >>> 21 & 511;
  out[op++] = (in3 >>> 30 | (in4 & 127) << 2) & 511;
  out[op++] = in4 >>> 7 & 511;
  out[op++] = in4 >>> 16 & 511;
  out[op++] = (in4 >>> 25 | (in5 & 3) << 7) & 511;
  out[op++] = in5 >>> 2 & 511;
  out[op++] = in5 >>> 11 & 511;
  out[op++] = in5 >>> 20 & 511;
  out[op++] = (in5 >>> 29 | (in6 & 63) << 3) & 511;
  out[op++] = in6 >>> 6 & 511;
  out[op++] = in6 >>> 15 & 511;
  out[op++] = (in6 >>> 24 | (in7 & 1) << 8) & 511;
  out[op++] = in7 >>> 1 & 511;
  out[op++] = in7 >>> 10 & 511;
  out[op++] = in7 >>> 19 & 511;
  out[op++] = (in7 >>> 28 | (in8 & 31) << 4) & 511;
  out[op++] = in8 >>> 5 & 511;
  out[op++] = in8 >>> 14 & 511;
  out[op] = in8 >>> 23 & 511;
}
function fastUnpack32_10(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  const in8 = inValues[inPos + 8] >>> 0;
  const in9 = inValues[inPos + 9] >>> 0;
  out[op++] = in0 >>> 0 & 1023;
  out[op++] = in0 >>> 10 & 1023;
  out[op++] = in0 >>> 20 & 1023;
  out[op++] = (in0 >>> 30 | (in1 & 255) << 2) & 1023;
  out[op++] = in1 >>> 8 & 1023;
  out[op++] = in1 >>> 18 & 1023;
  out[op++] = (in1 >>> 28 | (in2 & 63) << 4) & 1023;
  out[op++] = in2 >>> 6 & 1023;
  out[op++] = in2 >>> 16 & 1023;
  out[op++] = (in2 >>> 26 | (in3 & 15) << 6) & 1023;
  out[op++] = in3 >>> 4 & 1023;
  out[op++] = in3 >>> 14 & 1023;
  out[op++] = (in3 >>> 24 | (in4 & 3) << 8) & 1023;
  out[op++] = in4 >>> 2 & 1023;
  out[op++] = in4 >>> 12 & 1023;
  out[op++] = in4 >>> 22 & 1023;
  out[op++] = in5 >>> 0 & 1023;
  out[op++] = in5 >>> 10 & 1023;
  out[op++] = in5 >>> 20 & 1023;
  out[op++] = (in5 >>> 30 | (in6 & 255) << 2) & 1023;
  out[op++] = in6 >>> 8 & 1023;
  out[op++] = in6 >>> 18 & 1023;
  out[op++] = (in6 >>> 28 | (in7 & 63) << 4) & 1023;
  out[op++] = in7 >>> 6 & 1023;
  out[op++] = in7 >>> 16 & 1023;
  out[op++] = (in7 >>> 26 | (in8 & 15) << 6) & 1023;
  out[op++] = in8 >>> 4 & 1023;
  out[op++] = in8 >>> 14 & 1023;
  out[op++] = (in8 >>> 24 | (in9 & 3) << 8) & 1023;
  out[op++] = in9 >>> 2 & 1023;
  out[op++] = in9 >>> 12 & 1023;
  out[op] = in9 >>> 22 & 1023;
}
function fastUnpack32_11(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  const in8 = inValues[inPos + 8] >>> 0;
  const in9 = inValues[inPos + 9] >>> 0;
  const in10 = inValues[inPos + 10] >>> 0;
  out[op++] = in0 >>> 0 & 2047;
  out[op++] = in0 >>> 11 & 2047;
  out[op++] = (in0 >>> 22 | (in1 & 1) << 10) & 2047;
  out[op++] = in1 >>> 1 & 2047;
  out[op++] = in1 >>> 12 & 2047;
  out[op++] = (in1 >>> 23 | (in2 & 3) << 9) & 2047;
  out[op++] = in2 >>> 2 & 2047;
  out[op++] = in2 >>> 13 & 2047;
  out[op++] = (in2 >>> 24 | (in3 & 7) << 8) & 2047;
  out[op++] = in3 >>> 3 & 2047;
  out[op++] = in3 >>> 14 & 2047;
  out[op++] = (in3 >>> 25 | (in4 & 15) << 7) & 2047;
  out[op++] = in4 >>> 4 & 2047;
  out[op++] = in4 >>> 15 & 2047;
  out[op++] = (in4 >>> 26 | (in5 & 31) << 6) & 2047;
  out[op++] = in5 >>> 5 & 2047;
  out[op++] = in5 >>> 16 & 2047;
  out[op++] = (in5 >>> 27 | (in6 & 63) << 5) & 2047;
  out[op++] = in6 >>> 6 & 2047;
  out[op++] = in6 >>> 17 & 2047;
  out[op++] = (in6 >>> 28 | (in7 & 127) << 4) & 2047;
  out[op++] = in7 >>> 7 & 2047;
  out[op++] = in7 >>> 18 & 2047;
  out[op++] = (in7 >>> 29 | (in8 & 255) << 3) & 2047;
  out[op++] = in8 >>> 8 & 2047;
  out[op++] = in8 >>> 19 & 2047;
  out[op++] = (in8 >>> 30 | (in9 & 511) << 2) & 2047;
  out[op++] = in9 >>> 9 & 2047;
  out[op++] = in9 >>> 20 & 2047;
  out[op++] = (in9 >>> 31 | (in10 & 1023) << 1) & 2047;
  out[op++] = in10 >>> 10 & 2047;
  out[op] = in10 >>> 21 & 2047;
}
function fastUnpack32_12(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  const in8 = inValues[inPos + 8] >>> 0;
  const in9 = inValues[inPos + 9] >>> 0;
  const in10 = inValues[inPos + 10] >>> 0;
  const in11 = inValues[inPos + 11] >>> 0;
  out[op++] = in0 >>> 0 & 4095;
  out[op++] = in0 >>> 12 & 4095;
  out[op++] = (in0 >>> 24 | (in1 & 15) << 8) & 4095;
  out[op++] = in1 >>> 4 & 4095;
  out[op++] = in1 >>> 16 & 4095;
  out[op++] = (in1 >>> 28 | (in2 & 255) << 4) & 4095;
  out[op++] = in2 >>> 8 & 4095;
  out[op++] = in2 >>> 20 & 4095;
  out[op++] = in3 >>> 0 & 4095;
  out[op++] = in3 >>> 12 & 4095;
  out[op++] = (in3 >>> 24 | (in4 & 15) << 8) & 4095;
  out[op++] = in4 >>> 4 & 4095;
  out[op++] = in4 >>> 16 & 4095;
  out[op++] = (in4 >>> 28 | (in5 & 255) << 4) & 4095;
  out[op++] = in5 >>> 8 & 4095;
  out[op++] = in5 >>> 20 & 4095;
  out[op++] = in6 >>> 0 & 4095;
  out[op++] = in6 >>> 12 & 4095;
  out[op++] = (in6 >>> 24 | (in7 & 15) << 8) & 4095;
  out[op++] = in7 >>> 4 & 4095;
  out[op++] = in7 >>> 16 & 4095;
  out[op++] = (in7 >>> 28 | (in8 & 255) << 4) & 4095;
  out[op++] = in8 >>> 8 & 4095;
  out[op++] = in8 >>> 20 & 4095;
  out[op++] = in9 >>> 0 & 4095;
  out[op++] = in9 >>> 12 & 4095;
  out[op++] = (in9 >>> 24 | (in10 & 15) << 8) & 4095;
  out[op++] = in10 >>> 4 & 4095;
  out[op++] = in10 >>> 16 & 4095;
  out[op++] = (in10 >>> 28 | (in11 & 255) << 4) & 4095;
  out[op++] = in11 >>> 8 & 4095;
  out[op] = in11 >>> 20 & 4095;
}
function fastUnpack32_16(inValues, inPos, out, outPos) {
  let op = outPos;
  const in0 = inValues[inPos] >>> 0;
  const in1 = inValues[inPos + 1] >>> 0;
  const in2 = inValues[inPos + 2] >>> 0;
  const in3 = inValues[inPos + 3] >>> 0;
  const in4 = inValues[inPos + 4] >>> 0;
  const in5 = inValues[inPos + 5] >>> 0;
  const in6 = inValues[inPos + 6] >>> 0;
  const in7 = inValues[inPos + 7] >>> 0;
  const in8 = inValues[inPos + 8] >>> 0;
  const in9 = inValues[inPos + 9] >>> 0;
  const in10 = inValues[inPos + 10] >>> 0;
  const in11 = inValues[inPos + 11] >>> 0;
  const in12 = inValues[inPos + 12] >>> 0;
  const in13 = inValues[inPos + 13] >>> 0;
  const in14 = inValues[inPos + 14] >>> 0;
  const in15 = inValues[inPos + 15] >>> 0;
  out[op++] = in0 >>> 0 & 65535;
  out[op++] = in0 >>> 16 & 65535;
  out[op++] = in1 >>> 0 & 65535;
  out[op++] = in1 >>> 16 & 65535;
  out[op++] = in2 >>> 0 & 65535;
  out[op++] = in2 >>> 16 & 65535;
  out[op++] = in3 >>> 0 & 65535;
  out[op++] = in3 >>> 16 & 65535;
  out[op++] = in4 >>> 0 & 65535;
  out[op++] = in4 >>> 16 & 65535;
  out[op++] = in5 >>> 0 & 65535;
  out[op++] = in5 >>> 16 & 65535;
  out[op++] = in6 >>> 0 & 65535;
  out[op++] = in6 >>> 16 & 65535;
  out[op++] = in7 >>> 0 & 65535;
  out[op++] = in7 >>> 16 & 65535;
  out[op++] = in8 >>> 0 & 65535;
  out[op++] = in8 >>> 16 & 65535;
  out[op++] = in9 >>> 0 & 65535;
  out[op++] = in9 >>> 16 & 65535;
  out[op++] = in10 >>> 0 & 65535;
  out[op++] = in10 >>> 16 & 65535;
  out[op++] = in11 >>> 0 & 65535;
  out[op++] = in11 >>> 16 & 65535;
  out[op++] = in12 >>> 0 & 65535;
  out[op++] = in12 >>> 16 & 65535;
  out[op++] = in13 >>> 0 & 65535;
  out[op++] = in13 >>> 16 & 65535;
  out[op++] = in14 >>> 0 & 65535;
  out[op++] = in14 >>> 16 & 65535;
  out[op++] = in15 >>> 0 & 65535;
  out[op] = in15 >>> 16 & 65535;
}
function fastUnpack256_1(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 1;
    out[op++] = in0 >>> 1 & 1;
    out[op++] = in0 >>> 2 & 1;
    out[op++] = in0 >>> 3 & 1;
    out[op++] = in0 >>> 4 & 1;
    out[op++] = in0 >>> 5 & 1;
    out[op++] = in0 >>> 6 & 1;
    out[op++] = in0 >>> 7 & 1;
    out[op++] = in0 >>> 8 & 1;
    out[op++] = in0 >>> 9 & 1;
    out[op++] = in0 >>> 10 & 1;
    out[op++] = in0 >>> 11 & 1;
    out[op++] = in0 >>> 12 & 1;
    out[op++] = in0 >>> 13 & 1;
    out[op++] = in0 >>> 14 & 1;
    out[op++] = in0 >>> 15 & 1;
    out[op++] = in0 >>> 16 & 1;
    out[op++] = in0 >>> 17 & 1;
    out[op++] = in0 >>> 18 & 1;
    out[op++] = in0 >>> 19 & 1;
    out[op++] = in0 >>> 20 & 1;
    out[op++] = in0 >>> 21 & 1;
    out[op++] = in0 >>> 22 & 1;
    out[op++] = in0 >>> 23 & 1;
    out[op++] = in0 >>> 24 & 1;
    out[op++] = in0 >>> 25 & 1;
    out[op++] = in0 >>> 26 & 1;
    out[op++] = in0 >>> 27 & 1;
    out[op++] = in0 >>> 28 & 1;
    out[op++] = in0 >>> 29 & 1;
    out[op++] = in0 >>> 30 & 1;
    out[op++] = in0 >>> 31 & 1;
  }
}
function fastUnpack256_2(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 3;
    out[op++] = in0 >>> 2 & 3;
    out[op++] = in0 >>> 4 & 3;
    out[op++] = in0 >>> 6 & 3;
    out[op++] = in0 >>> 8 & 3;
    out[op++] = in0 >>> 10 & 3;
    out[op++] = in0 >>> 12 & 3;
    out[op++] = in0 >>> 14 & 3;
    out[op++] = in0 >>> 16 & 3;
    out[op++] = in0 >>> 18 & 3;
    out[op++] = in0 >>> 20 & 3;
    out[op++] = in0 >>> 22 & 3;
    out[op++] = in0 >>> 24 & 3;
    out[op++] = in0 >>> 26 & 3;
    out[op++] = in0 >>> 28 & 3;
    out[op++] = in0 >>> 30 & 3;
    out[op++] = in1 >>> 0 & 3;
    out[op++] = in1 >>> 2 & 3;
    out[op++] = in1 >>> 4 & 3;
    out[op++] = in1 >>> 6 & 3;
    out[op++] = in1 >>> 8 & 3;
    out[op++] = in1 >>> 10 & 3;
    out[op++] = in1 >>> 12 & 3;
    out[op++] = in1 >>> 14 & 3;
    out[op++] = in1 >>> 16 & 3;
    out[op++] = in1 >>> 18 & 3;
    out[op++] = in1 >>> 20 & 3;
    out[op++] = in1 >>> 22 & 3;
    out[op++] = in1 >>> 24 & 3;
    out[op++] = in1 >>> 26 & 3;
    out[op++] = in1 >>> 28 & 3;
    out[op++] = in1 >>> 30 & 3;
  }
}
function fastUnpack256_3(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 7;
    out[op++] = in0 >>> 3 & 7;
    out[op++] = in0 >>> 6 & 7;
    out[op++] = in0 >>> 9 & 7;
    out[op++] = in0 >>> 12 & 7;
    out[op++] = in0 >>> 15 & 7;
    out[op++] = in0 >>> 18 & 7;
    out[op++] = in0 >>> 21 & 7;
    out[op++] = in0 >>> 24 & 7;
    out[op++] = in0 >>> 27 & 7;
    out[op++] = (in0 >>> 30 | (in1 & 1) << 2) & 7;
    out[op++] = in1 >>> 1 & 7;
    out[op++] = in1 >>> 4 & 7;
    out[op++] = in1 >>> 7 & 7;
    out[op++] = in1 >>> 10 & 7;
    out[op++] = in1 >>> 13 & 7;
    out[op++] = in1 >>> 16 & 7;
    out[op++] = in1 >>> 19 & 7;
    out[op++] = in1 >>> 22 & 7;
    out[op++] = in1 >>> 25 & 7;
    out[op++] = in1 >>> 28 & 7;
    out[op++] = (in1 >>> 31 | (in2 & 3) << 1) & 7;
    out[op++] = in2 >>> 2 & 7;
    out[op++] = in2 >>> 5 & 7;
    out[op++] = in2 >>> 8 & 7;
    out[op++] = in2 >>> 11 & 7;
    out[op++] = in2 >>> 14 & 7;
    out[op++] = in2 >>> 17 & 7;
    out[op++] = in2 >>> 20 & 7;
    out[op++] = in2 >>> 23 & 7;
    out[op++] = in2 >>> 26 & 7;
    out[op++] = in2 >>> 29 & 7;
  }
}
function fastUnpack256_4(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    const in3 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 15;
    out[op++] = in0 >>> 4 & 15;
    out[op++] = in0 >>> 8 & 15;
    out[op++] = in0 >>> 12 & 15;
    out[op++] = in0 >>> 16 & 15;
    out[op++] = in0 >>> 20 & 15;
    out[op++] = in0 >>> 24 & 15;
    out[op++] = in0 >>> 28 & 15;
    out[op++] = in1 >>> 0 & 15;
    out[op++] = in1 >>> 4 & 15;
    out[op++] = in1 >>> 8 & 15;
    out[op++] = in1 >>> 12 & 15;
    out[op++] = in1 >>> 16 & 15;
    out[op++] = in1 >>> 20 & 15;
    out[op++] = in1 >>> 24 & 15;
    out[op++] = in1 >>> 28 & 15;
    out[op++] = in2 >>> 0 & 15;
    out[op++] = in2 >>> 4 & 15;
    out[op++] = in2 >>> 8 & 15;
    out[op++] = in2 >>> 12 & 15;
    out[op++] = in2 >>> 16 & 15;
    out[op++] = in2 >>> 20 & 15;
    out[op++] = in2 >>> 24 & 15;
    out[op++] = in2 >>> 28 & 15;
    out[op++] = in3 >>> 0 & 15;
    out[op++] = in3 >>> 4 & 15;
    out[op++] = in3 >>> 8 & 15;
    out[op++] = in3 >>> 12 & 15;
    out[op++] = in3 >>> 16 & 15;
    out[op++] = in3 >>> 20 & 15;
    out[op++] = in3 >>> 24 & 15;
    out[op++] = in3 >>> 28 & 15;
  }
}
function fastUnpack256_5(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    const in3 = inValues[ip++] >>> 0;
    const in4 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 31;
    out[op++] = in0 >>> 5 & 31;
    out[op++] = in0 >>> 10 & 31;
    out[op++] = in0 >>> 15 & 31;
    out[op++] = in0 >>> 20 & 31;
    out[op++] = in0 >>> 25 & 31;
    out[op++] = (in0 >>> 30 | (in1 & 7) << 2) & 31;
    out[op++] = in1 >>> 3 & 31;
    out[op++] = in1 >>> 8 & 31;
    out[op++] = in1 >>> 13 & 31;
    out[op++] = in1 >>> 18 & 31;
    out[op++] = in1 >>> 23 & 31;
    out[op++] = (in1 >>> 28 | (in2 & 1) << 4) & 31;
    out[op++] = in2 >>> 1 & 31;
    out[op++] = in2 >>> 6 & 31;
    out[op++] = in2 >>> 11 & 31;
    out[op++] = in2 >>> 16 & 31;
    out[op++] = in2 >>> 21 & 31;
    out[op++] = in2 >>> 26 & 31;
    out[op++] = (in2 >>> 31 | (in3 & 15) << 1) & 31;
    out[op++] = in3 >>> 4 & 31;
    out[op++] = in3 >>> 9 & 31;
    out[op++] = in3 >>> 14 & 31;
    out[op++] = in3 >>> 19 & 31;
    out[op++] = in3 >>> 24 & 31;
    out[op++] = (in3 >>> 29 | (in4 & 3) << 3) & 31;
    out[op++] = in4 >>> 2 & 31;
    out[op++] = in4 >>> 7 & 31;
    out[op++] = in4 >>> 12 & 31;
    out[op++] = in4 >>> 17 & 31;
    out[op++] = in4 >>> 22 & 31;
    out[op++] = in4 >>> 27 & 31;
  }
}
function fastUnpack256_6(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    const in3 = inValues[ip++] >>> 0;
    const in4 = inValues[ip++] >>> 0;
    const in5 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 63;
    out[op++] = in0 >>> 6 & 63;
    out[op++] = in0 >>> 12 & 63;
    out[op++] = in0 >>> 18 & 63;
    out[op++] = in0 >>> 24 & 63;
    out[op++] = (in0 >>> 30 | (in1 & 15) << 2) & 63;
    out[op++] = in1 >>> 4 & 63;
    out[op++] = in1 >>> 10 & 63;
    out[op++] = in1 >>> 16 & 63;
    out[op++] = in1 >>> 22 & 63;
    out[op++] = (in1 >>> 28 | (in2 & 3) << 4) & 63;
    out[op++] = in2 >>> 2 & 63;
    out[op++] = in2 >>> 8 & 63;
    out[op++] = in2 >>> 14 & 63;
    out[op++] = in2 >>> 20 & 63;
    out[op++] = in2 >>> 26 & 63;
    out[op++] = in3 >>> 0 & 63;
    out[op++] = in3 >>> 6 & 63;
    out[op++] = in3 >>> 12 & 63;
    out[op++] = in3 >>> 18 & 63;
    out[op++] = in3 >>> 24 & 63;
    out[op++] = (in3 >>> 30 | (in4 & 15) << 2) & 63;
    out[op++] = in4 >>> 4 & 63;
    out[op++] = in4 >>> 10 & 63;
    out[op++] = in4 >>> 16 & 63;
    out[op++] = in4 >>> 22 & 63;
    out[op++] = (in4 >>> 28 | (in5 & 3) << 4) & 63;
    out[op++] = in5 >>> 2 & 63;
    out[op++] = in5 >>> 8 & 63;
    out[op++] = in5 >>> 14 & 63;
    out[op++] = in5 >>> 20 & 63;
    out[op++] = in5 >>> 26 & 63;
  }
}
function fastUnpack256_7(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    const in3 = inValues[ip++] >>> 0;
    const in4 = inValues[ip++] >>> 0;
    const in5 = inValues[ip++] >>> 0;
    const in6 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 127;
    out[op++] = in0 >>> 7 & 127;
    out[op++] = in0 >>> 14 & 127;
    out[op++] = in0 >>> 21 & 127;
    out[op++] = (in0 >>> 28 | (in1 & 7) << 4) & 127;
    out[op++] = in1 >>> 3 & 127;
    out[op++] = in1 >>> 10 & 127;
    out[op++] = in1 >>> 17 & 127;
    out[op++] = in1 >>> 24 & 127;
    out[op++] = (in1 >>> 31 | (in2 & 63) << 1) & 127;
    out[op++] = in2 >>> 6 & 127;
    out[op++] = in2 >>> 13 & 127;
    out[op++] = in2 >>> 20 & 127;
    out[op++] = (in2 >>> 27 | (in3 & 3) << 5) & 127;
    out[op++] = in3 >>> 2 & 127;
    out[op++] = in3 >>> 9 & 127;
    out[op++] = in3 >>> 16 & 127;
    out[op++] = in3 >>> 23 & 127;
    out[op++] = (in3 >>> 30 | (in4 & 31) << 2) & 127;
    out[op++] = in4 >>> 5 & 127;
    out[op++] = in4 >>> 12 & 127;
    out[op++] = in4 >>> 19 & 127;
    out[op++] = (in4 >>> 26 | (in5 & 1) << 6) & 127;
    out[op++] = in5 >>> 1 & 127;
    out[op++] = in5 >>> 8 & 127;
    out[op++] = in5 >>> 15 & 127;
    out[op++] = in5 >>> 22 & 127;
    out[op++] = (in5 >>> 29 | (in6 & 15) << 3) & 127;
    out[op++] = in6 >>> 4 & 127;
    out[op++] = in6 >>> 11 & 127;
    out[op++] = in6 >>> 18 & 127;
    out[op++] = in6 >>> 25 & 127;
  }
}
function fastUnpack256_8(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let c = 0; c < 8; c++) {
    const in0 = inValues[ip++] >>> 0;
    const in1 = inValues[ip++] >>> 0;
    const in2 = inValues[ip++] >>> 0;
    const in3 = inValues[ip++] >>> 0;
    const in4 = inValues[ip++] >>> 0;
    const in5 = inValues[ip++] >>> 0;
    const in6 = inValues[ip++] >>> 0;
    const in7 = inValues[ip++] >>> 0;
    out[op++] = in0 >>> 0 & 255;
    out[op++] = in0 >>> 8 & 255;
    out[op++] = in0 >>> 16 & 255;
    out[op++] = in0 >>> 24 & 255;
    out[op++] = in1 >>> 0 & 255;
    out[op++] = in1 >>> 8 & 255;
    out[op++] = in1 >>> 16 & 255;
    out[op++] = in1 >>> 24 & 255;
    out[op++] = in2 >>> 0 & 255;
    out[op++] = in2 >>> 8 & 255;
    out[op++] = in2 >>> 16 & 255;
    out[op++] = in2 >>> 24 & 255;
    out[op++] = in3 >>> 0 & 255;
    out[op++] = in3 >>> 8 & 255;
    out[op++] = in3 >>> 16 & 255;
    out[op++] = in3 >>> 24 & 255;
    out[op++] = in4 >>> 0 & 255;
    out[op++] = in4 >>> 8 & 255;
    out[op++] = in4 >>> 16 & 255;
    out[op++] = in4 >>> 24 & 255;
    out[op++] = in5 >>> 0 & 255;
    out[op++] = in5 >>> 8 & 255;
    out[op++] = in5 >>> 16 & 255;
    out[op++] = in5 >>> 24 & 255;
    out[op++] = in6 >>> 0 & 255;
    out[op++] = in6 >>> 8 & 255;
    out[op++] = in6 >>> 16 & 255;
    out[op++] = in6 >>> 24 & 255;
    out[op++] = in7 >>> 0 & 255;
    out[op++] = in7 >>> 8 & 255;
    out[op++] = in7 >>> 16 & 255;
    out[op++] = in7 >>> 24 & 255;
  }
}
function fastUnpack256_16(inValues, inPos, out, outPos) {
  let op = outPos;
  let ip = inPos;
  for (let i = 0; i < 128; i++) {
    const in0 = inValues[ip++] >>> 0;
    out[op++] = in0 & 65535;
    out[op++] = in0 >>> 16 & 65535;
  }
}
function fastUnpack256_Generic(inValues, inPos, out, outPos, bitWidth) {
  const mask = MASKS[bitWidth] >>> 0;
  let inputWordIndex = inPos;
  let bitOffset = 0;
  let currentWord = inValues[inputWordIndex] >>> 0;
  let op = outPos;
  for (let c = 0; c < 8; c++) {
    for (let i = 0; i < 32; i++) {
      if (bitOffset + bitWidth <= 32) {
        const value = currentWord >>> bitOffset & mask;
        out[op + i] = value | 0;
        bitOffset += bitWidth;
        if (bitOffset === 32) {
          bitOffset = 0;
          inputWordIndex++;
          if (i !== 31) {
            currentWord = inValues[inputWordIndex] >>> 0;
          }
        }
      } else {
        const lowBits = 32 - bitOffset;
        const low = currentWord >>> bitOffset;
        inputWordIndex++;
        currentWord = inValues[inputWordIndex] >>> 0;
        const highBits = bitWidth - lowBits;
        const highMask = -1 >>> 32 - highBits >>> 0;
        const high = currentWord & highMask;
        const value = (low | high << lowBits) & mask;
        out[op + i] = value | 0;
        bitOffset = highBits;
      }
    }
    op += 32;
    bitOffset = 0;
    if (c < 7) {
      currentWord = inValues[inputWordIndex] >>> 0;
    }
  }
}

// node_modules/@maplibre/mlt/dist/decoding/fastPforDecoder.js
var MAX_BIT_WIDTH = 32;
var BIT_WIDTH_SLOTS = MAX_BIT_WIDTH + 1;
var PAGE_SIZE = normalizePageSize(DEFAULT_PAGE_SIZE);
var BYTE_CONTAINER_SIZE = 3 * PAGE_SIZE / BLOCK_SIZE + PAGE_SIZE | 0;
function createDecoderWorkspace() {
  const byteContainer = new Uint8Array(BYTE_CONTAINER_SIZE);
  return {
    dataToBePacked: new Array(BIT_WIDTH_SLOTS),
    dataPointers: new Int32Array(BIT_WIDTH_SLOTS),
    byteContainer,
    byteContainerI32: new Int32Array(byteContainer.buffer, byteContainer.byteOffset, byteContainer.byteLength >>> 2),
    exceptionSizes: new Int32Array(BIT_WIDTH_SLOTS)
  };
}
function createFastPforWireDecodeWorkspace(initialEncodedWordCapacity = 16) {
  if (initialEncodedWordCapacity < 0) {
    throw new RangeError(`initialEncodedWordCapacity must be >= 0, got ${initialEncodedWordCapacity}`);
  }
  const capacity = Math.max(16, initialEncodedWordCapacity | 0);
  return {
    encodedWords: new Uint32Array(capacity),
    decoderWorkspace: createDecoderWorkspace()
  };
}
function ensureFastPforWireEncodedWordsCapacity(workspace, requiredWordCount) {
  if (requiredWordCount <= workspace.encodedWords.length)
    return workspace.encodedWords;
  const next = new Uint32Array(Math.max(16, requiredWordCount * 2));
  workspace.encodedWords = next;
  return next;
}
function materializeByteContainer(inValues, byteContainerStart, byteSize, workspace) {
  if (workspace.byteContainer.length < byteSize) {
    workspace.byteContainer = new Uint8Array(byteSize * 2);
    workspace.byteContainerI32 = void 0;
  }
  const byteContainer = workspace.byteContainer;
  const numFullInts = byteSize >>> 2;
  if ((byteContainer.byteOffset & 3) === 0) {
    let intView = workspace.byteContainerI32;
    if (!intView || intView.buffer !== byteContainer.buffer || intView.byteOffset !== byteContainer.byteOffset || intView.length < numFullInts) {
      intView = workspace.byteContainerI32 = new Int32Array(byteContainer.buffer, byteContainer.byteOffset, byteContainer.byteLength >>> 2);
    }
    intView.set(inValues.subarray(byteContainerStart, byteContainerStart + numFullInts));
  } else {
    for (let i = 0; i < numFullInts; i = i + 1 | 0) {
      const val = inValues[byteContainerStart + i | 0] | 0;
      const base = i << 2;
      byteContainer[base] = val & 255;
      byteContainer[base + 1 | 0] = val >>> 8 & 255;
      byteContainer[base + 2 | 0] = val >>> 16 & 255;
      byteContainer[base + 3 | 0] = val >>> 24 & 255;
    }
  }
  const remainder = byteSize & 3;
  if (remainder > 0) {
    const lastIntIdx = byteContainerStart + numFullInts | 0;
    const lastVal = inValues[lastIntIdx] | 0;
    const base = numFullInts << 2;
    for (let r = 0; r < remainder; r = r + 1 | 0) {
      byteContainer[base + r | 0] = lastVal >>> (r << 3) & 255;
    }
  }
  return byteContainer;
}
function unpackExceptionStreams(inValues, inExcept, workspace) {
  const bitmap = inValues[inExcept++] | 0;
  const dataToBePacked = workspace.dataToBePacked;
  for (let bitWidth = 2; bitWidth <= MAX_BIT_WIDTH; bitWidth = bitWidth + 1 | 0) {
    if ((bitmap >>> bitWidth - 1 & 1) === 0)
      continue;
    if (inExcept >= inValues.length) {
      throw new Error(`FastPFOR decode: truncated exception stream header (bitWidth=${bitWidth}, streamWordIndex=${inExcept}, needWords=1, availableWords=${inValues.length - inExcept}, encodedWords=${inValues.length})`);
    }
    const size = inValues[inExcept++] >>> 0;
    const roundedUp = roundUpToMultipleOf32(size);
    const wordsNeeded = size * bitWidth + 31 >>> 5;
    if (inExcept + wordsNeeded > inValues.length) {
      throw new Error(`FastPFOR decode: truncated exception stream (bitWidth=${bitWidth}, size=${size}, streamWordIndex=${inExcept}, needWords=${wordsNeeded}, availableWords=${inValues.length - inExcept}, encodedWords=${inValues.length})`);
    }
    let exceptionStream = dataToBePacked[bitWidth];
    if (!exceptionStream || exceptionStream.length < roundedUp) {
      exceptionStream = dataToBePacked[bitWidth] = new Uint32Array(roundedUp);
    }
    let j = 0;
    for (; j < size; j = j + 32 | 0) {
      fastUnpack32(inValues, inExcept, exceptionStream, j, bitWidth);
      inExcept = inExcept + bitWidth | 0;
    }
    const overflow = j - size | 0;
    inExcept = inExcept - (overflow * bitWidth >>> 5) | 0;
    workspace.exceptionSizes[bitWidth] = size;
  }
  return inExcept;
}
function unpackBlock256(inValues, inPos, out, outPos, bitWidth) {
  switch (bitWidth) {
    case 1:
      fastUnpack256_1(inValues, inPos, out, outPos);
      break;
    case 2:
      fastUnpack256_2(inValues, inPos, out, outPos);
      break;
    case 3:
      fastUnpack256_3(inValues, inPos, out, outPos);
      break;
    case 4:
      fastUnpack256_4(inValues, inPos, out, outPos);
      break;
    case 5:
      fastUnpack256_5(inValues, inPos, out, outPos);
      break;
    case 6:
      fastUnpack256_6(inValues, inPos, out, outPos);
      break;
    case 7:
      fastUnpack256_7(inValues, inPos, out, outPos);
      break;
    case 8:
      fastUnpack256_8(inValues, inPos, out, outPos);
      break;
    case 16:
      fastUnpack256_16(inValues, inPos, out, outPos);
      break;
    default:
      fastUnpack256_Generic(inValues, inPos, out, outPos, bitWidth);
      break;
  }
  return inPos + (bitWidth << 3) | 0;
}
function readBlockHeader(byteContainer, byteContainerLen, bytePosIn, block) {
  if (bytePosIn + 2 > byteContainerLen) {
    throw new Error(`FastPFOR decode: byteContainer underflow at block=${block} (need 2 bytes for [bitWidth, exceptionCount], bytePos=${bytePosIn}, byteSize=${byteContainerLen})`);
  }
  const bitWidth = byteContainer[bytePosIn++];
  const exceptionCount = byteContainer[bytePosIn++];
  if (bitWidth > MAX_BIT_WIDTH) {
    throw new Error(`FastPFOR decode: invalid bitWidth=${bitWidth} at block=${block} (expected 0..${MAX_BIT_WIDTH}). This likely indicates corrupted or truncated input.`);
  }
  return { bitWidth, exceptionCount, bytePosIn };
}
function readBlockExceptionHeader(byteContainer, byteContainerLen, bytePosIn, bitWidth, exceptionCount, block) {
  if (bytePosIn + 1 > byteContainerLen) {
    throw new Error(`FastPFOR decode: exception header underflow at block=${block} (need 1 byte for maxBits, bytePos=${bytePosIn}, byteSize=${byteContainerLen})`);
  }
  const maxBits = byteContainer[bytePosIn++];
  if (maxBits < bitWidth || maxBits > MAX_BIT_WIDTH) {
    throw new Error(`FastPFOR decode: invalid maxBits=${maxBits} at block=${block} (bitWidth=${bitWidth}, expected ${bitWidth}..${MAX_BIT_WIDTH})`);
  }
  const exceptionBitWidth = maxBits - bitWidth | 0;
  if (exceptionBitWidth < 1 || exceptionBitWidth > MAX_BIT_WIDTH) {
    throw new Error(`FastPFOR decode: invalid exceptionBitWidth=${exceptionBitWidth} at block=${block} (bitWidth=${bitWidth}, maxBits=${maxBits})`);
  }
  if (bytePosIn + exceptionCount > byteContainerLen) {
    throw new Error(`FastPFOR decode: exception positions underflow at block=${block} (need=${exceptionCount}, have=${byteContainerLen - bytePosIn})`);
  }
  return { maxBits, exceptionBitWidth, bytePosIn };
}
function applyBlockExceptions(out, blockOutPos, bitWidth, exceptionCount, byteContainer, byteContainerLen, bytePosIn, workspace, block) {
  const { maxBits, exceptionBitWidth, bytePosIn: afterHeaderPos } = readBlockExceptionHeader(byteContainer, byteContainerLen, bytePosIn, bitWidth, exceptionCount, block);
  bytePosIn = afterHeaderPos;
  if (exceptionBitWidth === 1) {
    const shift = 1 << bitWidth;
    for (let k = 0; k < exceptionCount; k = k + 1 | 0) {
      const pos = byteContainer[bytePosIn++];
      out[pos + blockOutPos | 0] |= shift;
    }
    return bytePosIn;
  }
  const exceptionValues = workspace.dataToBePacked[exceptionBitWidth];
  if (!exceptionValues) {
    throw new Error(`FastPFOR decode: missing exception stream for exceptionBitWidth=${exceptionBitWidth} (bitWidth=${bitWidth}, maxBits=${maxBits}) at block ${block}`);
  }
  const exceptionPointers = workspace.dataPointers;
  let exPtr = exceptionPointers[exceptionBitWidth] | 0;
  const exSize = workspace.exceptionSizes[exceptionBitWidth] | 0;
  if (exPtr + exceptionCount > exSize) {
    throw new Error(`FastPFOR decode: exception stream overflow for exceptionBitWidth=${exceptionBitWidth} (ptr=${exPtr}, need ${exceptionCount}, size=${exSize}) at block ${block}`);
  }
  for (let k = 0; k < exceptionCount; k = k + 1 | 0) {
    const pos = byteContainer[bytePosIn++];
    const val = exceptionValues[exPtr++] | 0;
    out[pos + blockOutPos | 0] |= val << bitWidth;
  }
  exceptionPointers[exceptionBitWidth] = exPtr;
  return bytePosIn;
}
function decodePageBlocks(inValues, pageStart, inPos, packedEnd, out, outPos, blocks, byteContainer, byteContainerLen, workspace) {
  let tmpInPos = inPos | 0;
  let bytePosIn = 0;
  for (let run = 0; run < blocks; run = run + 1 | 0) {
    const header = readBlockHeader(byteContainer, byteContainerLen, bytePosIn, run);
    bytePosIn = header.bytePosIn;
    const bitWidth = header.bitWidth;
    const exceptionCount = header.exceptionCount;
    const blockOutPos = outPos + run * BLOCK_SIZE | 0;
    switch (bitWidth) {
      case 0:
        out.fill(0, blockOutPos, blockOutPos + BLOCK_SIZE);
        break;
      case 32:
        for (let i = 0; i < BLOCK_SIZE; i = i + 1 | 0) {
          out[blockOutPos + i | 0] = inValues[tmpInPos + i | 0] | 0;
        }
        tmpInPos = tmpInPos + BLOCK_SIZE | 0;
        break;
      default:
        tmpInPos = unpackBlock256(inValues, tmpInPos, out, blockOutPos, bitWidth);
        break;
    }
    if (exceptionCount > 0) {
      bytePosIn = applyBlockExceptions(out, blockOutPos, bitWidth, exceptionCount, byteContainer, byteContainerLen, bytePosIn, workspace, run);
    }
  }
  if (tmpInPos !== packedEnd) {
    throw new Error(`FastPFOR decode: packed region mismatch (pageStart=${pageStart}, packedStart=${inPos}, consumedPackedEnd=${tmpInPos}, expectedPackedEnd=${packedEnd}, packedWords=${packedEnd - inPos}, encoded.length=${inValues.length})`);
  }
  return;
}
function decodePage(inValues, out, inPos, outPos, thisSize, workspace) {
  const pageStart = inPos | 0;
  const whereMeta = inValues[pageStart] | 0;
  if (whereMeta <= 0 || pageStart + whereMeta > inValues.length - 1) {
    throw new Error(`FastPFOR decode: invalid whereMeta=${whereMeta} at pageStart=${pageStart} (expected > 0 and pageStart+whereMeta < encoded.length=${inValues.length})`);
  }
  const packedStart = pageStart + 1 | 0;
  const packedEnd = pageStart + whereMeta | 0;
  const byteSize = inValues[packedEnd] >>> 0;
  const metaInts = byteSize + 3 >>> 2;
  const byteContainerStart = packedEnd + 1;
  const bitmapPos = byteContainerStart + metaInts;
  if (bitmapPos >= inValues.length) {
    throw new Error(`FastPFOR decode: invalid byteSize=${byteSize} (metaInts=${metaInts}, pageStart=${pageStart}, packedEnd=${packedEnd}, byteContainerStart=${byteContainerStart}) causes bitmapPos=${bitmapPos} out of bounds (encoded.length=${inValues.length})`);
  }
  const byteContainer = materializeByteContainer(inValues, byteContainerStart, byteSize, workspace);
  const byteContainerLen = byteSize;
  const inExcept = unpackExceptionStreams(inValues, bitmapPos, workspace);
  const exceptionPointers = workspace.dataPointers;
  exceptionPointers.fill(0);
  const startOutPos = outPos | 0;
  const blocks = thisSize / BLOCK_SIZE | 0;
  decodePageBlocks(inValues, pageStart, packedStart, packedEnd, out, startOutPos, blocks, byteContainer, byteContainerLen, workspace);
  return inExcept;
}
function decodeAlignedPages(inValues, out, inPos, outPos, outLength, workspace) {
  const alignedOutLength = greatestMultiple(outLength, BLOCK_SIZE);
  const finalOut = outPos + alignedOutLength;
  let tmpOutPos = outPos;
  let tmpInPos = inPos;
  while (tmpOutPos !== finalOut) {
    const thisSize = Math.min(PAGE_SIZE, finalOut - tmpOutPos);
    tmpInPos = decodePage(inValues, out, tmpInPos, tmpOutPos, thisSize, workspace);
    tmpOutPos = tmpOutPos + thisSize | 0;
  }
  return tmpInPos;
}
function decodeVByte(inValues, inPos, inLength, out, outPos, expectedCount) {
  if (expectedCount === 0)
    return inPos;
  let bitOffset = 0;
  let wordIndex = inPos;
  const finalWordIndex = inPos + inLength;
  const outPos0 = outPos;
  let tmpOutPos = outPos;
  const targetOut = outPos + expectedCount;
  let accumulator = 0;
  let accumulatorShift = 0;
  while (wordIndex < finalWordIndex && tmpOutPos < targetOut) {
    const word = inValues[wordIndex];
    const byte = word >>> bitOffset & 255;
    bitOffset += 8;
    wordIndex += bitOffset >>> 5;
    bitOffset &= 31;
    accumulator |= (byte & 127) << accumulatorShift;
    if ((byte & 128) !== 0) {
      out[tmpOutPos++] = accumulator | 0;
      accumulator = 0;
      accumulatorShift = 0;
    } else {
      accumulatorShift += 7;
      if (accumulatorShift > 28) {
        throw new Error(`FastPFOR VByte: unterminated value (expected MSB=1 terminator within 5 bytes; shift=${accumulatorShift}, partial=${accumulator}, decoded=${tmpOutPos - outPos0}/${expectedCount}, inPos=${wordIndex}, inEnd=${finalWordIndex})`);
      }
    }
  }
  if (tmpOutPos !== targetOut) {
    throw new Error(`FastPFOR VByte: truncated stream (decoded=${tmpOutPos - outPos0}, expected=${expectedCount}, consumedWords=${wordIndex - inPos}/${inLength}, vbyteStart=${inPos}, vbyteEnd=${finalWordIndex})`);
  }
  return wordIndex;
}
function decodeFastPforInt32(encoded, numValues, workspace) {
  let inPos = 0;
  let outPos = 0;
  const decoded = new Uint32Array(numValues);
  const decoderWorkspace = workspace ?? createDecoderWorkspace();
  if (encoded.length > 0) {
    const alignedLength = encoded[inPos] | 0;
    inPos = inPos + 1 | 0;
    if ((alignedLength & BLOCK_SIZE - 1) !== 0) {
      throw new Error(`FastPFOR decode: invalid alignedLength=${alignedLength} (expected multiple of ${BLOCK_SIZE})`);
    }
    if (outPos + alignedLength > decoded.length) {
      throw new Error(`FastPFOR decode: output buffer too small (outPos=${outPos}, alignedLength=${alignedLength}, out.length=${decoded.length})`);
    }
    inPos = decodeAlignedPages(encoded, decoded, inPos, outPos, alignedLength, decoderWorkspace);
    outPos = outPos + alignedLength | 0;
  }
  const remainingLength = encoded.length - inPos | 0;
  const expectedTail = numValues - outPos | 0;
  decodeVByte(encoded, inPos, remainingLength, decoded, outPos, expectedTail);
  return decoded;
}
function fastUnpack32(inValues, inPos, out, outPos, bitWidth) {
  switch (bitWidth) {
    case 2:
      fastUnpack32_2(inValues, inPos, out, outPos);
      return;
    case 3:
      fastUnpack32_3(inValues, inPos, out, outPos);
      return;
    case 4:
      fastUnpack32_4(inValues, inPos, out, outPos);
      return;
    case 5:
      fastUnpack32_5(inValues, inPos, out, outPos);
      return;
    case 6:
      fastUnpack32_6(inValues, inPos, out, outPos);
      return;
    case 7:
      fastUnpack32_7(inValues, inPos, out, outPos);
      return;
    case 8:
      fastUnpack32_8(inValues, inPos, out, outPos);
      return;
    case 9:
      fastUnpack32_9(inValues, inPos, out, outPos);
      return;
    case 10:
      fastUnpack32_10(inValues, inPos, out, outPos);
      return;
    case 11:
      fastUnpack32_11(inValues, inPos, out, outPos);
      return;
    case 12:
      fastUnpack32_12(inValues, inPos, out, outPos);
      return;
    case 16:
      fastUnpack32_16(inValues, inPos, out, outPos);
      return;
    case 32:
      for (let i = 0; i < 32; i = i + 1 | 0) {
        out[outPos + i | 0] = inValues[inPos + i | 0] | 0;
      }
      return;
    default:
      break;
  }
  const valueMask = MASKS[bitWidth] >>> 0;
  let inputWordIndex = inPos;
  let bitOffset = 0;
  let currentWord = inValues[inputWordIndex] >>> 0;
  for (let i = 0; i < 32; i++) {
    if (bitOffset + bitWidth <= 32) {
      const value = currentWord >>> bitOffset & valueMask;
      out[outPos + i] = value | 0;
      bitOffset += bitWidth;
      if (bitOffset === 32) {
        bitOffset = 0;
        inputWordIndex++;
        if (i !== 31)
          currentWord = inValues[inputWordIndex] >>> 0;
      }
    } else {
      const lowBits = 32 - bitOffset;
      const low = currentWord >>> bitOffset;
      inputWordIndex++;
      currentWord = inValues[inputWordIndex] >>> 0;
      const highMask = MASKS[bitWidth - lowBits] >>> 0;
      const high = currentWord & highMask;
      const value = (low | high << lowBits) & valueMask;
      out[outPos + i] = value | 0;
      bitOffset = bitWidth - lowBits;
    }
  }
}

// node_modules/@maplibre/mlt/dist/decoding/bigEndianDecode.js
function decodeBigEndianInt32sInto(bytes, offset, byteLength, out) {
  if (offset < 0 || byteLength < 0 || offset + byteLength > bytes.length) {
    throw new RangeError(`decodeBigEndianInt32sInto: out of bounds (offset=${offset}, byteLength=${byteLength}, bytes.length=${bytes.length})`);
  }
  const numCompleteInts = Math.floor(byteLength / 4);
  const hasTrailingBytes = byteLength % 4 !== 0;
  const numInts = hasTrailingBytes ? numCompleteInts + 1 : numCompleteInts;
  if (out.length < numInts) {
    throw new RangeError(`decodeBigEndianInt32sInto: out.length=${out.length} < ${numInts}`);
  }
  if (numCompleteInts > 0) {
    const absoluteOffset = bytes.byteOffset + offset;
    if ((absoluteOffset & 3) === 0) {
      const u32 = new Uint32Array(bytes.buffer, absoluteOffset, numCompleteInts);
      for (let i = 0; i < numCompleteInts; i++) {
        out[i] = bswap32(u32[i]) | 0;
      }
    } else {
      for (let i = 0; i < numCompleteInts; i++) {
        const base = offset + i * 4;
        out[i] = bytes[base] << 24 | bytes[base + 1] << 16 | bytes[base + 2] << 8 | bytes[base + 3] | 0;
      }
    }
  }
  if (hasTrailingBytes) {
    const base = offset + numCompleteInts * 4;
    const remaining = byteLength - numCompleteInts * 4;
    let v = 0;
    for (let i = 0; i < remaining; i++) {
      v |= bytes[base + i] << 24 - i * 8;
    }
    out[numCompleteInts] = v | 0;
  }
  return numInts;
}

// node_modules/@maplibre/mlt/dist/decoding/integerDecodingUtils.js
function decodeVarintInt32(buf, bufferOffset, numValues) {
  const dst = new Uint32Array(numValues);
  let dstOffset = 0;
  let offset = bufferOffset.get();
  for (let i = 0; i < dst.length; i++) {
    let b = buf[offset++];
    let val = b & 127;
    if (b < 128) {
      dst[dstOffset++] = val;
      continue;
    }
    b = buf[offset++];
    val |= (b & 127) << 7;
    if (b < 128) {
      dst[dstOffset++] = val;
      continue;
    }
    b = buf[offset++];
    val |= (b & 127) << 14;
    if (b < 128) {
      dst[dstOffset++] = val;
      continue;
    }
    b = buf[offset++];
    val |= (b & 127) << 21;
    if (b < 128) {
      dst[dstOffset++] = val;
      continue;
    }
    b = buf[offset++];
    val |= (b & 15) << 28;
    dst[dstOffset++] = val;
  }
  bufferOffset.set(offset);
  return dst;
}
function decodeVarintInt64(src, offset, numValues) {
  const dst = new BigUint64Array(numValues);
  for (let i = 0; i < dst.length; i++) {
    dst[i] = decodeVarintInt64Value(src, offset);
  }
  return dst;
}
function decodeVarintInt64Value(bytes, pos) {
  let value = 0n;
  let shift = 0;
  let index = pos.get();
  while (index < bytes.length) {
    const b = bytes[index++];
    value |= BigInt(b & 127) << BigInt(shift);
    if ((b & 128) === 0) {
      break;
    }
    shift += 7;
    if (shift >= 64) {
      throw new Error("Varint too long");
    }
  }
  pos.set(index);
  return value;
}
function decodeVarintFloat64(src, offset, numValues) {
  const dst = new Float64Array(numValues);
  for (let i = 0; i < numValues; i++) {
    dst[i] = decodeVarintFloat64Value(src, offset);
  }
  return dst;
}
function decodeVarintFloat64Value(buf, offset) {
  let val;
  let b;
  b = buf[offset.get()];
  offset.increment();
  val = b & 127;
  if (b < 128)
    return val;
  b = buf[offset.get()];
  offset.increment();
  val |= (b & 127) << 7;
  if (b < 128)
    return val;
  b = buf[offset.get()];
  offset.increment();
  val |= (b & 127) << 14;
  if (b < 128)
    return val;
  b = buf[offset.get()];
  offset.increment();
  val |= (b & 127) << 21;
  if (b < 128)
    return val;
  b = buf[offset.get()];
  val |= (b & 15) << 28;
  return decodeVarintRemainder(val, buf, offset);
}
function decodeVarintRemainder(l, buf, offset) {
  let h;
  let b;
  b = buf[offset.get()];
  offset.increment();
  h = (b & 112) >> 4;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  b = buf[offset.get()];
  offset.increment();
  h |= (b & 127) << 3;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  b = buf[offset.get()];
  offset.increment();
  h |= (b & 127) << 10;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  b = buf[offset.get()];
  offset.increment();
  h |= (b & 127) << 17;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  b = buf[offset.get()];
  offset.increment();
  h |= (b & 127) << 24;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  b = buf[offset.get()];
  offset.increment();
  h |= (b & 1) << 31;
  if (b < 128)
    return h * 4294967296 + (l >>> 0);
  throw new Error("Expected varint not more than 10 bytes");
}
function decodeFastPfor(encodedBytes, expectedValueCount, encodedByteLength, offset) {
  const workspace = createFastPforWireDecodeWorkspace(encodedByteLength >>> 2);
  return decodeFastPforWithWorkspace(encodedBytes, expectedValueCount, encodedByteLength, offset, workspace);
}
function decodeFastPforWithWorkspace(encodedBytes, expectedValueCount, encodedByteLength, offset, workspace) {
  const inputByteOffset = offset.get();
  if ((encodedByteLength & 3) !== 0) {
    throw new Error(`FastPFOR: invalid encodedByteLength=${encodedByteLength} at offset=${inputByteOffset} (encodedBytes.length=${encodedBytes.length}; expected a multiple of 4 bytes for an int32 big-endian word stream)`);
  }
  const encodedWordCount = encodedByteLength >>> 2;
  const encodedWordBuffer = ensureFastPforWireEncodedWordsCapacity(workspace, encodedWordCount);
  decodeBigEndianInt32sInto(encodedBytes, inputByteOffset, encodedByteLength, encodedWordBuffer);
  const decodedValues = decodeFastPforInt32(encodedWordBuffer.subarray(0, encodedWordCount), expectedValueCount, workspace.decoderWorkspace);
  offset.add(encodedByteLength);
  return decodedValues;
}
function decodeZigZagInt32Value(encoded) {
  return encoded >>> 1 ^ -(encoded & 1);
}
function decodeZigZagInt64Value(encoded) {
  return encoded >> 1n ^ -(encoded & 1n);
}
function decodeZigZagFloat64Value(encoded) {
  return encoded % 2 === 1 ? (encoded + 1) / -2 : encoded / 2;
}
function decodeZigZagInt32(encodedData) {
  const decodedValues = new Int32Array(encodedData.length);
  for (let i = 0; i < encodedData.length; i++) {
    decodedValues[i] = decodeZigZagInt32Value(encodedData[i]);
  }
  return decodedValues;
}
function decodeZigZagInt64(encodedData) {
  const decodedValues = new BigInt64Array(encodedData.length);
  for (let i = 0; i < encodedData.length; i++) {
    decodedValues[i] = decodeZigZagInt64Value(encodedData[i]);
  }
  return decodedValues;
}
function decodeZigZagFloat64(encodedData) {
  for (let i = 0; i < encodedData.length; i++) {
    encodedData[i] = decodeZigZagFloat64Value(encodedData[i]);
  }
}
function decodeUnsignedRleInt32(encodedData, numRuns, numTotalValues) {
  if (numTotalValues === void 0) {
    numTotalValues = 0;
    for (let i = 0; i < numRuns; i++) {
      numTotalValues += encodedData[i];
    }
  }
  const decodedValues = new Uint32Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = encodedData[i];
    const value = encodedData[i + numRuns];
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function decodeUnsignedRleInt64(encodedData, numRuns, numTotalValues) {
  if (numTotalValues === void 0) {
    numTotalValues = 0;
    for (let i = 0; i < numRuns; i++) {
      numTotalValues += Number(encodedData[i]);
    }
  }
  const decodedValues = new BigUint64Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = Number(encodedData[i]);
    const value = encodedData[i + numRuns];
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function decodeUnsignedRleFloat64(encodedData, numRuns, numTotalValues) {
  const decodedValues = new Float64Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = encodedData[i];
    const value = encodedData[i + numRuns];
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function decodeZigZagDeltaInt32(data) {
  const decodedValues = new Int32Array(data.length);
  decodedValues[0] = decodeZigZagInt32Value(data[0]);
  const sz0 = data.length / 4 * 4;
  let i = 1;
  if (sz0 >= 4) {
    for (; i < sz0 - 4; i += 4) {
      const data1 = data[i];
      const data2 = data[i + 1];
      const data3 = data[i + 2];
      const data4 = data[i + 3];
      decodedValues[i] = decodeZigZagInt32Value(data1) + decodedValues[i - 1];
      decodedValues[i + 1] = decodeZigZagInt32Value(data2) + decodedValues[i];
      decodedValues[i + 2] = decodeZigZagInt32Value(data3) + decodedValues[i + 1];
      decodedValues[i + 3] = decodeZigZagInt32Value(data4) + decodedValues[i + 2];
    }
  }
  for (; i !== data.length; ++i) {
    decodedValues[i] = decodeZigZagInt32Value(data[i]) + decodedValues[i - 1];
  }
  return decodedValues;
}
function decodeZigZagDeltaInt64(data) {
  const decodedValues = new BigInt64Array(data.length);
  decodedValues[0] = decodeZigZagInt64Value(data[0]);
  const sz0 = data.length / 4 * 4;
  let i = 1;
  if (sz0 >= 4) {
    for (; i < sz0 - 4; i += 4) {
      const data1 = data[i];
      const data2 = data[i + 1];
      const data3 = data[i + 2];
      const data4 = data[i + 3];
      decodedValues[i] = decodeZigZagInt64Value(data1) + decodedValues[i - 1];
      decodedValues[i + 1] = decodeZigZagInt64Value(data2) + decodedValues[i];
      decodedValues[i + 2] = decodeZigZagInt64Value(data3) + decodedValues[i + 1];
      decodedValues[i + 3] = decodeZigZagInt64Value(data4) + decodedValues[i + 2];
    }
  }
  for (; i !== decodedValues.length; ++i) {
    decodedValues[i] = decodeZigZagInt64Value(data[i]) + decodedValues[i - 1];
  }
  return decodedValues;
}
function decodeZigZagDeltaFloat64(data) {
  data[0] = decodeZigZagFloat64Value(data[0]);
  const sz0 = data.length / 4 * 4;
  let i = 1;
  if (sz0 >= 4) {
    for (; i < sz0 - 4; i += 4) {
      const data1 = data[i];
      const data2 = data[i + 1];
      const data3 = data[i + 2];
      const data4 = data[i + 3];
      data[i] = decodeZigZagFloat64Value(data1) + data[i - 1];
      data[i + 1] = decodeZigZagFloat64Value(data2) + data[i];
      data[i + 2] = decodeZigZagFloat64Value(data3) + data[i + 1];
      data[i + 3] = decodeZigZagFloat64Value(data4) + data[i + 2];
    }
  }
  for (; i !== data.length; ++i) {
    data[i] = decodeZigZagFloat64Value(data[i]) + data[i - 1];
  }
}
function decodeZigZagRleInt32(data, numRuns, numTotalValues) {
  if (numTotalValues === void 0) {
    numTotalValues = 0;
    for (let i = 0; i < numRuns; i++) {
      numTotalValues += data[i];
    }
  }
  const decodedValues = new Int32Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = data[i];
    let value = data[i + numRuns];
    value = decodeZigZagInt32Value(value);
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function decodeZigZagRleInt64(data, numRuns, numTotalValues) {
  if (numTotalValues === void 0) {
    numTotalValues = 0;
    for (let i = 0; i < numRuns; i++) {
      numTotalValues += Number(data[i]);
    }
  }
  const decodedValues = new BigInt64Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = Number(data[i]);
    let value = data[i + numRuns];
    value = decodeZigZagInt64Value(value);
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function decodeZigZagRleFloat64(data, numRuns, numTotalValues) {
  const decodedValues = new Float64Array(numTotalValues);
  let offset = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = data[i];
    let value = data[i + numRuns];
    value = decodeZigZagFloat64Value(value);
    decodedValues.fill(value, offset, offset + runLength);
    offset += runLength;
  }
  return decodedValues;
}
function fastInverseDelta(data) {
  const sz0 = data.length / 4 * 4;
  let i = 1;
  if (sz0 >= 4) {
    for (let a = data[0]; i < sz0 - 4; i += 4) {
      a = data[i] += a;
      a = data[i + 1] += a;
      a = data[i + 2] += a;
      a = data[i + 3] += a;
    }
  }
  while (i !== data.length) {
    data[i] += data[i - 1];
    ++i;
  }
}
function inverseDelta(data) {
  let prevValue = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] += prevValue;
    prevValue = data[i];
  }
}
function decodeComponentwiseDeltaVec2(data) {
  if (data.length < 2)
    return new Int32Array(data);
  const decodedData = new Int32Array(data.length);
  decodedData[0] = decodeZigZagInt32Value(data[0]);
  decodedData[1] = decodeZigZagInt32Value(data[1]);
  const sz0 = data.length / 4 * 4;
  let i = 2;
  if (sz0 >= 4) {
    for (; i < sz0 - 4; i += 4) {
      const x1 = data[i];
      const y1 = data[i + 1];
      const x2 = data[i + 2];
      const y2 = data[i + 3];
      decodedData[i] = decodeZigZagInt32Value(x1) + decodedData[i - 2];
      decodedData[i + 1] = decodeZigZagInt32Value(y1) + decodedData[i - 1];
      decodedData[i + 2] = decodeZigZagInt32Value(x2) + decodedData[i];
      decodedData[i + 3] = decodeZigZagInt32Value(y2) + decodedData[i + 1];
    }
  }
  for (; i !== data.length; i += 2) {
    decodedData[i] = decodeZigZagInt32Value(data[i]) + decodedData[i - 2];
    decodedData[i + 1] = decodeZigZagInt32Value(data[i + 1]) + decodedData[i - 1];
  }
  return decodedData;
}
function decodeComponentwiseDeltaVec2Scaled(data, scale, min, max) {
  if (data.length < 2)
    return new Int32Array(data);
  const decodedData = new Int32Array(data.length);
  let previousVertexX = decodeZigZagInt32Value(data[0]);
  let previousVertexY = decodeZigZagInt32Value(data[1]);
  decodedData[0] = clamp(Math.round(previousVertexX * scale), min, max);
  decodedData[1] = clamp(Math.round(previousVertexY * scale), min, max);
  const sz0 = data.length / 16;
  let i = 2;
  if (sz0 >= 4) {
    for (; i < sz0 - 4; i += 4) {
      const x1 = data[i];
      const y1 = data[i + 1];
      const currentVertexX = decodeZigZagInt32Value(x1) + previousVertexX;
      const currentVertexY = decodeZigZagInt32Value(y1) + previousVertexY;
      decodedData[i] = clamp(Math.round(currentVertexX * scale), min, max);
      decodedData[i + 1] = clamp(Math.round(currentVertexY * scale), min, max);
      const x2 = data[i + 2];
      const y2 = data[i + 3];
      previousVertexX = decodeZigZagInt32Value(x2) + currentVertexX;
      previousVertexY = decodeZigZagInt32Value(y2) + currentVertexY;
      decodedData[i + 2] = clamp(Math.round(previousVertexX * scale), min, max);
      decodedData[i + 3] = clamp(Math.round(previousVertexY * scale), min, max);
    }
  }
  for (; i !== data.length; i += 2) {
    previousVertexX += decodeZigZagInt32Value(data[i]);
    previousVertexY += decodeZigZagInt32Value(data[i + 1]);
    decodedData[i] = clamp(Math.round(previousVertexX * scale), min, max);
    decodedData[i + 1] = clamp(Math.round(previousVertexY * scale), min, max);
  }
  return decodedData;
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function decodeZigZagDeltaOfDeltaInt32(data) {
  const decodedData = new Int32Array(data.length + 1);
  decodedData[0] = 0;
  decodedData[1] = decodeZigZagInt32Value(data[0]);
  let deltaSum = decodedData[1];
  for (let i = 2; i !== decodedData.length; ++i) {
    const zigZagValue = data[i - 1];
    const delta = decodeZigZagInt32Value(zigZagValue);
    deltaSum += delta;
    decodedData[i] = decodedData[i - 1] + deltaSum;
  }
  return new Uint32Array(decodedData);
}
function decodeZigZagRleDeltaInt32(data, numRuns, numTotalValues) {
  const decodedValues = new Int32Array(numTotalValues + 1);
  decodedValues[0] = 0;
  let offset = 1;
  let previousValue = decodedValues[0];
  for (let i = 0; i < numRuns; i++) {
    const runLength = data[i];
    let value = data[i + numRuns];
    value = decodeZigZagInt32Value(value);
    for (let j = offset; j < offset + runLength; j++) {
      decodedValues[j] = value + previousValue;
      previousValue = decodedValues[j];
    }
    offset += runLength;
  }
  return decodedValues;
}
function decodeRleDeltaInt32(data, numRuns, numTotalValues) {
  const decodedValues = new Uint32Array(numTotalValues + 1);
  decodedValues[0] = 0;
  let offset = 1;
  let previousValue = decodedValues[0];
  for (let i = 0; i < numRuns; i++) {
    const runLength = data[i];
    const value = data[i + numRuns];
    for (let j = offset; j < offset + runLength; j++) {
      decodedValues[j] = value + previousValue;
      previousValue = decodedValues[j];
    }
    offset += runLength;
  }
  return decodedValues;
}
function decodeDeltaRleInt32(data, numRuns, numValues) {
  const result = new Int32Array(numValues);
  let outPos = 0;
  let previousValue = 0;
  for (let i = 0; i < numRuns; i++) {
    const runLength = data[i];
    const zigZagDelta = data[i + numRuns];
    const delta = decodeZigZagInt32Value(zigZagDelta);
    for (let j = 0; j < runLength; j++) {
      previousValue += delta;
      result[outPos++] = previousValue;
    }
  }
  return result;
}
function decodeDeltaRleInt64(data, numRuns, numValues) {
  const result = new BigInt64Array(numValues);
  let outPos = 0;
  let previousValue = 0n;
  for (let i = 0; i < numRuns; i++) {
    const runLength = Number(data[i]);
    const zigZagDelta = data[i + numRuns];
    const delta = decodeZigZagInt64Value(zigZagDelta);
    for (let j = 0; j < runLength; j++) {
      previousValue += delta;
      result[outPos++] = previousValue;
    }
  }
  return result;
}
function decodeUnsignedZigZagDeltaInt32(data) {
  const decodedValues = new Uint32Array(data.length);
  decodedValues[0] = decodeZigZagInt32Value(data[0]) >>> 0;
  for (let i = 1; i < data.length; i++) {
    decodedValues[i] = decodedValues[i - 1] + decodeZigZagInt32Value(data[i]) >>> 0;
  }
  return decodedValues;
}
function decodeUnsignedZigZagDeltaInt64(data) {
  const decodedValues = new BigUint64Array(data.length);
  decodedValues[0] = BigInt.asUintN(64, decodeZigZagInt64Value(data[0]));
  for (let i = 1; i < data.length; i++) {
    decodedValues[i] = BigInt.asUintN(64, decodedValues[i - 1] + decodeZigZagInt64Value(data[i]));
  }
  return decodedValues;
}
function decodeUnsignedComponentwiseDeltaVec2(data) {
  if (data.length < 2) {
    return new Uint32Array(data);
  }
  const decodedData = new Uint32Array(data.length);
  decodedData[0] = decodeZigZagInt32Value(data[0]) >>> 0;
  decodedData[1] = decodeZigZagInt32Value(data[1]) >>> 0;
  for (let i = 2; i < data.length; i += 2) {
    decodedData[i] = decodedData[i - 2] + decodeZigZagInt32Value(data[i]) >>> 0;
    decodedData[i + 1] = decodedData[i - 1] + decodeZigZagInt32Value(data[i + 1]) >>> 0;
  }
  return decodedData;
}
function decodeUnsignedComponentwiseDeltaVec2Scaled(data, scale, min, max) {
  const scaledValues = decodeComponentwiseDeltaVec2Scaled(data, scale, min, max);
  return new Uint32Array(scaledValues);
}
function decodeUnsignedConstRleInt32(data) {
  return data[1];
}
function decodeZigZagConstRleInt32(data) {
  return decodeZigZagInt32Value(data[1]);
}
function decodeZigZagSequenceRleInt32(data) {
  if (data.length === 2) {
    const value = decodeZigZagInt32Value(data[1]);
    return [value, value];
  }
  const base = decodeZigZagInt32Value(data[2]);
  const delta = decodeZigZagInt32Value(data[3]);
  return [base, delta];
}
function decodeUnsignedConstRleInt64(data) {
  return data[1];
}
function decodeZigZagConstRleInt64(data) {
  return decodeZigZagInt64Value(data[1]);
}
function decodeZigZagSequenceRleInt64(data) {
  if (data.length === 2) {
    const value = decodeZigZagInt64Value(data[1]);
    return [value, value];
  }
  const base = decodeZigZagInt64Value(data[2]);
  const delta = decodeZigZagInt64Value(data[3]);
  return [base, delta];
}

// node_modules/@maplibre/mlt/dist/metadata/tile/physicalStreamType.js
var PhysicalStreamType;
(function(PhysicalStreamType2) {
  PhysicalStreamType2["PRESENT"] = "PRESENT";
  PhysicalStreamType2["DATA"] = "DATA";
  PhysicalStreamType2["OFFSET"] = "OFFSET";
  PhysicalStreamType2["LENGTH"] = "LENGTH";
})(PhysicalStreamType || (PhysicalStreamType = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/dictionaryType.js
var DictionaryType;
(function(DictionaryType2) {
  DictionaryType2["NONE"] = "NONE";
  DictionaryType2["SINGLE"] = "SINGLE";
  DictionaryType2["SHARED"] = "SHARED";
  DictionaryType2["VERTEX"] = "VERTEX";
  DictionaryType2["MORTON"] = "MORTON";
  DictionaryType2["FSST"] = "FSST";
})(DictionaryType || (DictionaryType = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/offsetType.js
var OffsetType;
(function(OffsetType2) {
  OffsetType2["VERTEX"] = "VERTEX";
  OffsetType2["INDEX"] = "INDEX";
  OffsetType2["STRING"] = "STRING";
  OffsetType2["KEY"] = "KEY";
})(OffsetType || (OffsetType = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/lengthType.js
var LengthType;
(function(LengthType2) {
  LengthType2["VAR_BINARY"] = "VAR_BINARY";
  LengthType2["GEOMETRIES"] = "GEOMETRIES";
  LengthType2["PARTS"] = "PARTS";
  LengthType2["RINGS"] = "RINGS";
  LengthType2["TRIANGLES"] = "TRIANGLES";
  LengthType2["SYMBOL"] = "SYMBOL";
  LengthType2["DICTIONARY"] = "DICTIONARY";
})(LengthType || (LengthType = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/streamMetadataDecoder.js
var PHYSICAL_STREAM_TYPE_BY_ID = [
  PhysicalStreamType.PRESENT,
  PhysicalStreamType.DATA,
  PhysicalStreamType.OFFSET,
  PhysicalStreamType.LENGTH
];
var LOGICAL_LEVEL_TECHNIQUE_BY_ID = [
  LogicalLevelTechnique.NONE,
  LogicalLevelTechnique.DELTA,
  LogicalLevelTechnique.COMPONENTWISE_DELTA,
  LogicalLevelTechnique.RLE,
  LogicalLevelTechnique.MORTON
];
var PHYSICAL_LEVEL_TECHNIQUE_BY_ID = [
  PhysicalLevelTechnique.NONE,
  PhysicalLevelTechnique.FAST_PFOR,
  PhysicalLevelTechnique.VARINT
];
var DICTIONARY_TYPE_BY_ID = [
  DictionaryType.NONE,
  DictionaryType.SINGLE,
  DictionaryType.SHARED,
  DictionaryType.VERTEX,
  DictionaryType.MORTON,
  DictionaryType.FSST
];
var OFFSET_TYPE_BY_ID = [
  OffsetType.VERTEX,
  OffsetType.INDEX,
  OffsetType.STRING,
  OffsetType.KEY
];
var LENGTH_TYPE_BY_ID = [
  LengthType.VAR_BINARY,
  LengthType.GEOMETRIES,
  LengthType.PARTS,
  LengthType.RINGS,
  LengthType.TRIANGLES,
  LengthType.SYMBOL,
  LengthType.DICTIONARY
];
function decodeStreamMetadata(tile, offset) {
  const streamMetadata = decodeStreamMetadataInternal(tile, offset);
  if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.MORTON) {
    return decodePartialMortonEncodedStreamMetadata(streamMetadata, tile, offset);
  }
  if ((LogicalLevelTechnique.RLE === streamMetadata.logicalLevelTechnique1 || LogicalLevelTechnique.RLE === streamMetadata.logicalLevelTechnique2) && PhysicalLevelTechnique.NONE !== streamMetadata.physicalLevelTechnique) {
    return decodePartialRleEncodedStreamMetadata(streamMetadata, tile, offset);
  }
  return streamMetadata;
}
function decodePartialMortonEncodedStreamMetadata(streamMetadata, tile, offset) {
  const mortonInfo = decodeVarintInt32(tile, offset, 2);
  return {
    physicalStreamType: streamMetadata.physicalStreamType,
    logicalStreamType: streamMetadata.logicalStreamType,
    logicalLevelTechnique1: streamMetadata.logicalLevelTechnique1,
    logicalLevelTechnique2: streamMetadata.logicalLevelTechnique2,
    physicalLevelTechnique: streamMetadata.physicalLevelTechnique,
    numValues: streamMetadata.numValues,
    byteLength: streamMetadata.byteLength,
    decompressedCount: streamMetadata.decompressedCount,
    numBits: mortonInfo[0],
    coordinateShift: mortonInfo[1]
  };
}
function decodePartialRleEncodedStreamMetadata(streamMetadata, tile, offset) {
  const rleInfo = decodeVarintInt32(tile, offset, 2);
  return {
    physicalStreamType: streamMetadata.physicalStreamType,
    logicalStreamType: streamMetadata.logicalStreamType,
    logicalLevelTechnique1: streamMetadata.logicalLevelTechnique1,
    logicalLevelTechnique2: streamMetadata.logicalLevelTechnique2,
    physicalLevelTechnique: streamMetadata.physicalLevelTechnique,
    numValues: streamMetadata.numValues,
    byteLength: streamMetadata.byteLength,
    decompressedCount: rleInfo[1],
    runs: rleInfo[0],
    numRleValues: rleInfo[1]
  };
}
function decodeStreamMetadataInternal(tile, offset) {
  const stream_type = tile[offset.get()];
  const physicalStreamType = PHYSICAL_STREAM_TYPE_BY_ID[stream_type >> 4];
  let logicalStreamType = {};
  switch (physicalStreamType) {
    case PhysicalStreamType.DATA:
      logicalStreamType = {
        dictionaryType: DICTIONARY_TYPE_BY_ID[stream_type & 15]
      };
      break;
    case PhysicalStreamType.OFFSET:
      logicalStreamType = {
        offsetType: OFFSET_TYPE_BY_ID[stream_type & 15]
      };
      break;
    case PhysicalStreamType.LENGTH:
      logicalStreamType = {
        lengthType: LENGTH_TYPE_BY_ID[stream_type & 15]
      };
      break;
  }
  offset.increment();
  const encodings_header = tile[offset.get()];
  const llt1 = LOGICAL_LEVEL_TECHNIQUE_BY_ID[encodings_header >> 5];
  const llt2 = LOGICAL_LEVEL_TECHNIQUE_BY_ID[encodings_header >> 2 & 7];
  const plt = PHYSICAL_LEVEL_TECHNIQUE_BY_ID[encodings_header & 3];
  offset.increment();
  const sizeInfo = decodeVarintInt32(tile, offset, 2);
  const numValues = sizeInfo[0];
  const byteLength = sizeInfo[1];
  return {
    physicalStreamType,
    logicalStreamType,
    logicalLevelTechnique1: llt1,
    logicalLevelTechnique2: llt2,
    physicalLevelTechnique: plt,
    numValues,
    byteLength,
    decompressedCount: numValues
  };
}

// node_modules/@maplibre/mlt/dist/vector/vectorType.js
var VectorType;
(function(VectorType2) {
  VectorType2[VectorType2["FLAT"] = 0] = "FLAT";
  VectorType2[VectorType2["CONST"] = 1] = "CONST";
  VectorType2[VectorType2["SEQUENCE"] = 2] = "SEQUENCE";
  VectorType2[VectorType2["DICTIONARY"] = 3] = "DICTIONARY";
  VectorType2[VectorType2["FSST_DICTIONARY"] = 4] = "FSST_DICTIONARY";
})(VectorType || (VectorType = {}));

// node_modules/@maplibre/mlt/dist/vector/flat/bitVector.js
var BitVector = class {
  /**
   * @param values The byte buffer containing the bit values in least-significant bit (LSB)
   *     numbering
   */
  constructor(values, size) {
    this.values = values;
    this._size = size;
  }
  get(index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    const b = this.values[byteIndex];
    return (b >> bitIndex & 1) === 1;
  }
  set(index, value) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    this.values[byteIndex] = this.values[byteIndex] | (value ? 1 : 0) << bitIndex;
  }
  getInt(index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    const b = this.values[byteIndex];
    return b >> bitIndex & 1;
  }
  size() {
    return this._size;
  }
  getBuffer() {
    return this.values;
  }
};

// node_modules/@maplibre/mlt/dist/decoding/unpackNullableUtils.js
function unpackNullable(dataStream, presentBits, defaultValue) {
  if (!presentBits) {
    return dataStream;
  }
  const size = presentBits.size();
  const constructor = dataStream.constructor;
  const result = new constructor(size);
  let counter = 0;
  for (let i = 0; i < size; i++) {
    result[i] = presentBits.get(i) ? dataStream[counter++] : defaultValue;
  }
  return result;
}
function unpackNullableBoolean(dataStream, dataStreamSize, presentBits) {
  if (!presentBits) {
    return dataStream;
  }
  const numFeatures = presentBits.size();
  const bitVector = new BitVector(dataStream, dataStreamSize);
  const result = new BitVector(new Uint8Array(Math.ceil(numFeatures / 8)), numFeatures);
  let counter = 0;
  for (let i = 0; i < numFeatures; i++) {
    const value = presentBits.get(i) ? bitVector.get(counter++) : false;
    result.set(i, value);
  }
  return result.getBuffer();
}

// node_modules/@maplibre/mlt/dist/decoding/decodingUtils.js
function skipColumn(numStreams, tile, offset) {
  for (let i = 0; i < numStreams; i++) {
    const streamMetadata = decodeStreamMetadata(tile, offset);
    offset.add(streamMetadata.byteLength);
  }
}
function decodeBooleanRle(buffer, numBooleans, byteLength, pos, nullabilityBuffer) {
  const numBytes = Math.ceil(numBooleans / 8);
  const values = decodeByteRle(buffer, numBytes, byteLength, pos);
  if (nullabilityBuffer) {
    return unpackNullableBoolean(values, numBooleans, nullabilityBuffer);
  }
  return values;
}
function decodeByteRle(buffer, numBytes, byteLength, pos) {
  const values = new Uint8Array(numBytes);
  let valueOffset = 0;
  const streamEndPos = pos.get() + byteLength;
  while (valueOffset < numBytes) {
    if (pos.get() >= streamEndPos) {
      break;
    }
    const header = buffer[pos.increment()];
    if (header <= 127) {
      const numRuns = header + 3;
      const value = buffer[pos.increment()];
      const endValueOffset = Math.min(valueOffset + numRuns, numBytes);
      values.fill(value, valueOffset, endValueOffset);
      valueOffset = endValueOffset;
    } else {
      const numLiterals = 256 - header;
      for (let i = 0; i < numLiterals && valueOffset < numBytes; i++) {
        values[valueOffset++] = buffer[pos.increment()];
      }
    }
  }
  pos.set(streamEndPos);
  return values;
}
function decodeFloatsLE(encodedValues, pos, numValues, nullabilityBuffer) {
  const currentPos = pos.get();
  const newOffset = currentPos + numValues * Float32Array.BYTES_PER_ELEMENT;
  const newBuf = new Uint8Array(encodedValues.subarray(currentPos, newOffset)).buffer;
  const fb = new Float32Array(newBuf);
  pos.set(newOffset);
  if (nullabilityBuffer) {
    return unpackNullable(fb, nullabilityBuffer, 0);
  }
  return fb;
}
function decodeDoublesLE(encodedValues, pos, numValues, nullabilityBuffer) {
  const currentPos = pos.get();
  const newOffset = currentPos + numValues * Float64Array.BYTES_PER_ELEMENT;
  const newBuf = new Uint8Array(encodedValues.subarray(currentPos, newOffset)).buffer;
  const fb = new Float64Array(newBuf);
  pos.set(newOffset);
  if (nullabilityBuffer) {
    return unpackNullable(fb, nullabilityBuffer, 0);
  }
  return fb;
}
function decodeUint32sLE(encodedValues, pos, numValues) {
  const currentPos = pos.get();
  const byteLength = numValues * Uint32Array.BYTES_PER_ELEMENT;
  const view = new DataView(encodedValues.buffer, encodedValues.byteOffset, encodedValues.byteLength);
  const values = new Uint32Array(numValues);
  for (let i = 0; i < numValues; i++) {
    values[i] = view.getUint32(currentPos + i * Uint32Array.BYTES_PER_ELEMENT, true);
  }
  pos.add(byteLength);
  return values;
}
function decodeUint64sLE(encodedValues, pos, numValues) {
  const currentPos = pos.get();
  const byteLength = numValues * BigUint64Array.BYTES_PER_ELEMENT;
  const view = new DataView(encodedValues.buffer, encodedValues.byteOffset, encodedValues.byteLength);
  const values = new BigUint64Array(numValues);
  for (let i = 0; i < numValues; i++) {
    values[i] = view.getBigUint64(currentPos + i * BigUint64Array.BYTES_PER_ELEMENT, true);
  }
  pos.add(byteLength);
  return values;
}
var TEXT_DECODER_MIN_LENGTH = 12;
var utf8TextDecoder = new TextDecoder();
function decodeString(buf, pos, end) {
  if (end - pos >= TEXT_DECODER_MIN_LENGTH) {
    return utf8TextDecoder.decode(buf.subarray(pos, end));
  }
  return readUtf8(buf, pos, end);
}
function readUtf8(buf, pos, end) {
  let str = "";
  let i = pos;
  while (i < end) {
    const b0 = buf[i];
    let c = null;
    let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
    if (i + bytesPerSequence > end)
      break;
    let b1;
    let b2;
    let b3;
    if (bytesPerSequence === 1) {
      if (b0 < 128) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 192) === 128) {
        c = (b0 & 31) << 6 | b1 & 63;
        if (c <= 127) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 192) === 128 && (b2 & 192) === 128) {
        c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
        if (c <= 2047 || c >= 55296 && c <= 57343) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
        c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        if (c <= 65535 || c >= 1114112) {
          c = null;
        }
      }
    }
    if (c === null) {
      c = 65533;
      bytesPerSequence = 1;
    } else if (c > 65535) {
      c -= 65536;
      str += String.fromCharCode(c >>> 10 & 1023 | 55296);
      c = 56320 | c & 1023;
    }
    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }
  return str;
}

// node_modules/@maplibre/mlt/dist/decoding/integerStreamDecoder.js
function decodeSignedInt32Stream(data, offset, streamMetadata, scalingData, nullabilityBuffer) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  return decodeSignedInt32(values, streamMetadata, scalingData, nullabilityBuffer);
}
function decodeUnsignedInt32Stream(data, offset, streamMetadata, scalingData, nullabilityBuffer) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  return decodeUnsignedInt32(values, streamMetadata, scalingData, nullabilityBuffer);
}
function decodeLengthStreamToOffsetBuffer(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  return decodeLengthToOffsetBuffer(values, streamMetadata);
}
function decodePhysicalLevelTechnique(data, offset, streamMetadata) {
  const physicalLevelTechnique = streamMetadata.physicalLevelTechnique;
  switch (physicalLevelTechnique) {
    case PhysicalLevelTechnique.FAST_PFOR:
      return decodeFastPfor(data, streamMetadata.numValues, streamMetadata.byteLength, offset);
    case PhysicalLevelTechnique.VARINT:
      return decodeVarintInt32(data, offset, streamMetadata.numValues);
    case PhysicalLevelTechnique.NONE:
      return decodeUint32sLE(data, offset, streamMetadata.numValues);
    default:
      throw new Error(`Specified physicalLevelTechnique ${physicalLevelTechnique} is not supported (yet).`);
  }
}
function decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata) {
  const physicalLevelTechnique = streamMetadata.physicalLevelTechnique;
  switch (physicalLevelTechnique) {
    case PhysicalLevelTechnique.VARINT:
      return decodeVarintInt64(data, offset, streamMetadata.numValues);
    case PhysicalLevelTechnique.NONE:
      return decodeUint64sLE(data, offset, streamMetadata.numValues);
    default:
      throw new Error(`Specified physicalLevelTechnique ${physicalLevelTechnique} is not supported (yet).`);
  }
}
function decodeSignedConstInt32Stream(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  if (values.length === 1) {
    return decodeZigZagInt32Value(values[0]);
  }
  return decodeZigZagConstRleInt32(values);
}
function decodeUnsignedConstInt32Stream(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  if (values.length === 1) {
    if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.DELTA) {
      return decodeZigZagInt32Value(values[0]);
    }
    return values[0];
  }
  return decodeUnsignedConstRleInt32(values);
}
function decodeSequenceInt32Stream(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechnique(data, offset, streamMetadata);
  return decodeZigZagSequenceRleInt32(values);
}
function decodeSequenceInt64Stream(data, offset, streamMetadata) {
  const values = decodeVarintInt64(data, offset, streamMetadata.numValues);
  return decodeZigZagSequenceRleInt64(values);
}
function decodeSignedInt64Stream(data, offset, streamMetadata, nullabilityBuffer) {
  const values = decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata);
  return decodeSignedInt64(values, streamMetadata, nullabilityBuffer);
}
function decodeUnsignedInt64Stream(data, offset, streamMetadata, nullabilityBuffer) {
  const values = decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata);
  return decodeUnsignedInt64(values, streamMetadata, nullabilityBuffer);
}
function decodeUnsignedInt64AsFloat64Stream(data, offset, streamMetadata, nullabilityBuffer) {
  const values = decodeInt64AsFloat64(data, offset, streamMetadata, false);
  return nullabilityBuffer ? unpackNullable(values, nullabilityBuffer, 0) : values;
}
function decodeInt64AsFloat64(data, offset, streamMetadata, isSigned) {
  if (streamMetadata.physicalLevelTechnique === PhysicalLevelTechnique.VARINT) {
    const values2 = decodeVarintFloat64(data, offset, streamMetadata.numValues);
    return decodeFloat64Values(values2, streamMetadata, isSigned);
  }
  const values = decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata);
  const decodedValues = isSigned ? decodeSignedInt64(values, streamMetadata) : decodeUnsignedInt64(values, streamMetadata);
  return Float64Array.from(decodedValues, Number);
}
function decodeSignedConstInt64Stream(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata);
  if (values.length === 1) {
    return decodeZigZagInt64Value(values[0]);
  }
  return decodeZigZagConstRleInt64(values);
}
function decodeUnsignedConstInt64Stream(data, offset, streamMetadata) {
  const values = decodePhysicalLevelTechniqueInt64(data, offset, streamMetadata);
  if (values.length === 1) {
    if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.DELTA) {
      return decodeZigZagInt64Value(values[0]);
    }
    return values[0];
  }
  return decodeUnsignedConstRleInt64(values);
}
function decodeSignedInt32(values, streamMetadata, scalingData, nullabilityBuffer) {
  let decodedValues;
  switch (streamMetadata.logicalLevelTechnique1) {
    case LogicalLevelTechnique.DELTA:
      if (streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
        const rleMetadata = streamMetadata;
        if (!nullabilityBuffer) {
          return decodeDeltaRleInt32(values, rleMetadata.runs, rleMetadata.numRleValues);
        }
        values = decodeUnsignedRleInt32(values, rleMetadata.runs, rleMetadata.numRleValues);
        decodedValues = decodeZigZagDeltaInt32(values);
      } else {
        decodedValues = decodeZigZagDeltaInt32(values);
      }
      break;
    case LogicalLevelTechnique.RLE:
      decodedValues = decodeZigZagRleInt32(values, streamMetadata.runs, streamMetadata.numRleValues);
      break;
    case LogicalLevelTechnique.MORTON:
      fastInverseDelta(values);
      decodedValues = new Int32Array(values);
      break;
    case LogicalLevelTechnique.COMPONENTWISE_DELTA:
      if (scalingData && !nullabilityBuffer) {
        return decodeComponentwiseDeltaVec2Scaled(values, scalingData.scale, scalingData.min, scalingData.max);
      }
      decodedValues = decodeComponentwiseDeltaVec2(values);
      break;
    case LogicalLevelTechnique.NONE:
      decodedValues = decodeZigZagInt32(values);
      break;
    default:
      throw new Error(`The specified Logical level technique is not supported: ${streamMetadata.logicalLevelTechnique1}`);
  }
  if (nullabilityBuffer) {
    return unpackNullable(decodedValues, nullabilityBuffer, 0);
  }
  return decodedValues;
}
function decodeUnsignedInt32(values, streamMetadata, scalingData, nullabilityBuffer) {
  let decodedValues;
  switch (streamMetadata.logicalLevelTechnique1) {
    case LogicalLevelTechnique.DELTA:
      if (streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
        const rleMetadata = streamMetadata;
        const deltaValues = decodeUnsignedRleInt32(values, rleMetadata.runs, rleMetadata.numRleValues);
        decodedValues = decodeUnsignedZigZagDeltaInt32(deltaValues);
      } else {
        decodedValues = decodeUnsignedZigZagDeltaInt32(values);
      }
      break;
    case LogicalLevelTechnique.RLE:
      decodedValues = decodeUnsignedRleInt32(values, streamMetadata.runs, streamMetadata.numRleValues);
      break;
    case LogicalLevelTechnique.MORTON:
      fastInverseDelta(values);
      decodedValues = values;
      break;
    case LogicalLevelTechnique.COMPONENTWISE_DELTA:
      if (scalingData && !nullabilityBuffer) {
        decodedValues = decodeUnsignedComponentwiseDeltaVec2Scaled(values, scalingData.scale, scalingData.min, scalingData.max);
      } else {
        decodedValues = decodeUnsignedComponentwiseDeltaVec2(values);
      }
      break;
    case LogicalLevelTechnique.NONE:
      decodedValues = values;
      break;
    default:
      throw new Error(`The specified Logical level technique is not supported: ${streamMetadata.logicalLevelTechnique1}`);
  }
  if (nullabilityBuffer) {
    return unpackNullable(decodedValues, nullabilityBuffer, 0);
  }
  return decodedValues;
}
function decodeSignedInt64(values, streamMetadata, nullabilityBuffer) {
  let decodedValues;
  switch (streamMetadata.logicalLevelTechnique1) {
    case LogicalLevelTechnique.DELTA:
      if (streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
        const rleMetadata = streamMetadata;
        if (!nullabilityBuffer) {
          return decodeDeltaRleInt64(values, rleMetadata.runs, rleMetadata.numRleValues);
        }
        values = decodeUnsignedRleInt64(values, rleMetadata.runs, rleMetadata.numRleValues);
        decodedValues = decodeZigZagDeltaInt64(values);
      } else {
        decodedValues = decodeZigZagDeltaInt64(values);
      }
      break;
    case LogicalLevelTechnique.RLE:
      decodedValues = decodeZigZagRleInt64(values, streamMetadata.runs, streamMetadata.numRleValues);
      break;
    case LogicalLevelTechnique.NONE:
      decodedValues = decodeZigZagInt64(values);
      break;
    default:
      throw new Error(`The specified Logical level technique is not supported: ${streamMetadata.logicalLevelTechnique1}`);
  }
  if (nullabilityBuffer) {
    return unpackNullable(decodedValues, nullabilityBuffer, 0n);
  }
  return decodedValues;
}
function decodeUnsignedInt64(values, streamMetadata, nullabilityBuffer) {
  let decodedValues;
  switch (streamMetadata.logicalLevelTechnique1) {
    case LogicalLevelTechnique.DELTA:
      if (streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
        const rleMetadata = streamMetadata;
        const deltaValues = decodeUnsignedRleInt64(values, rleMetadata.runs, rleMetadata.numRleValues);
        decodedValues = decodeUnsignedZigZagDeltaInt64(deltaValues);
      } else {
        decodedValues = decodeUnsignedZigZagDeltaInt64(values);
      }
      break;
    case LogicalLevelTechnique.RLE:
      decodedValues = decodeUnsignedRleInt64(values, streamMetadata.runs, streamMetadata.numRleValues);
      break;
    case LogicalLevelTechnique.NONE:
      decodedValues = values;
      break;
    default:
      throw new Error(`The specified Logical level technique is not supported: ${streamMetadata.logicalLevelTechnique1}`);
  }
  if (nullabilityBuffer) {
    return unpackNullable(decodedValues, nullabilityBuffer, 0n);
  }
  return decodedValues;
}
function decodeFloat64Values(values, streamMetadata, isSigned) {
  switch (streamMetadata.logicalLevelTechnique1) {
    case LogicalLevelTechnique.DELTA:
      if (streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
        const rleMetadata = streamMetadata;
        values = decodeUnsignedRleFloat64(values, rleMetadata.runs, rleMetadata.numRleValues);
      }
      decodeZigZagDeltaFloat64(values);
      return values;
    case LogicalLevelTechnique.RLE:
      return decodeRleFloat64(values, streamMetadata, isSigned);
    case LogicalLevelTechnique.NONE:
      if (isSigned) {
        decodeZigZagFloat64(values);
      }
      return values;
    default:
      throw new Error(`The specified Logical level technique is not supported: ${streamMetadata.logicalLevelTechnique1}`);
  }
}
function decodeLengthToOffsetBuffer(values, streamMetadata) {
  if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.DELTA && streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.NONE) {
    return decodeZigZagDeltaOfDeltaInt32(values);
  }
  if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.RLE && streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.NONE) {
    const rleMetadata = streamMetadata;
    return decodeRleDeltaInt32(values, rleMetadata.runs, rleMetadata.numRleValues);
  }
  if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.NONE && streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.NONE) {
    inverseDelta(values);
    const offsets = new Uint32Array(streamMetadata.numValues + 1);
    offsets[0] = 0;
    offsets.set(values, 1);
    return offsets;
  }
  if (streamMetadata.logicalLevelTechnique1 === LogicalLevelTechnique.DELTA && streamMetadata.logicalLevelTechnique2 === LogicalLevelTechnique.RLE) {
    const rleMetadata = streamMetadata;
    const decodedValues = decodeZigZagRleDeltaInt32(values, rleMetadata.runs, rleMetadata.numRleValues);
    fastInverseDelta(decodedValues);
    return new Uint32Array(decodedValues);
  }
  throw new Error("Only delta encoding is supported for transforming length to offset streams yet.");
}
function getVectorType(streamMetadata, sizeOrNullabilityBuffer, data, offset, varintWidth = "int32") {
  const logicalLevelTechnique1 = streamMetadata.logicalLevelTechnique1;
  if (logicalLevelTechnique1 === LogicalLevelTechnique.RLE) {
    return streamMetadata.runs === 1 ? VectorType.CONST : VectorType.FLAT;
  }
  if (logicalLevelTechnique1 !== LogicalLevelTechnique.DELTA || streamMetadata.logicalLevelTechnique2 !== LogicalLevelTechnique.RLE) {
    return streamMetadata.numValues === 1 ? VectorType.CONST : VectorType.FLAT;
  }
  const numFeatures = sizeOrNullabilityBuffer instanceof BitVector ? sizeOrNullabilityBuffer.size() : sizeOrNullabilityBuffer;
  const rleMetadata = streamMetadata;
  if (rleMetadata.numRleValues !== numFeatures) {
    return VectorType.FLAT;
  }
  if (rleMetadata.runs === 1) {
    return VectorType.SEQUENCE;
  }
  if (rleMetadata.runs !== 2) {
    return streamMetadata.numValues === 1 ? VectorType.CONST : VectorType.FLAT;
  }
  const savedOffset = offset.get();
  if (streamMetadata.physicalLevelTechnique === PhysicalLevelTechnique.VARINT) {
    if (isDeltaRleSequenceVarintWidth(data, offset, varintWidth)) {
      return VectorType.SEQUENCE;
    }
    return streamMetadata.numValues === 1 ? VectorType.CONST : VectorType.FLAT;
  }
  const byteOffset = offset.get();
  const values = new Int32Array(data.buffer, data.byteOffset + byteOffset, 4);
  offset.set(savedOffset);
  const zigZagOne = 2;
  if (values[2] === zigZagOne && values[3] === zigZagOne) {
    return VectorType.SEQUENCE;
  }
  return streamMetadata.numValues === 1 ? VectorType.CONST : VectorType.FLAT;
}
function isDeltaRleSequenceVarintWidth(data, offset, varintWidth) {
  const peekOffset = new IntWrapper(offset.get());
  if (varintWidth === "int64") {
    const values2 = decodeVarintInt64(data, peekOffset, 4);
    return values2[2] === 2n && values2[3] === 2n;
  }
  const values = decodeVarintInt32(data, peekOffset, 4);
  return values[2] === 2 && values[3] === 2;
}
function decodeRleFloat64(data, streamMetadata, isSigned) {
  return isSigned ? decodeZigZagRleFloat64(data, streamMetadata.runs, streamMetadata.numRleValues) : decodeUnsignedRleFloat64(data, streamMetadata.runs, streamMetadata.numRleValues);
}

// node_modules/@maplibre/mlt/dist/vector/flat/int64FlatVector.js
var Int64FlatVector = class extends FixedSizeVector {
  getValueFromBuffer(index) {
    return this.dataBuffer[index];
  }
};

// node_modules/@maplibre/mlt/dist/vector/sequence/int64SequenceVector.js
var Int64SequenceVector = class extends SequenceVector {
  constructor(name, baseValue, delta, size, isSigned) {
    super(name, isSigned ? BigInt64Array.of(baseValue) : BigUint64Array.of(baseValue), delta, size);
  }
  getValueFromBuffer(index) {
    return this.dataBuffer[0] + BigInt(index) * this.delta;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/zOrderCurve.js
function decodeZOrderCurve(mortonCode, numBits, coordinateShift) {
  const x = decodeMorton(mortonCode, numBits) - coordinateShift;
  const y = decodeMorton(mortonCode >> 1, numBits) - coordinateShift;
  return { x, y };
}
function decodeMorton(code, numBits) {
  let coordinate = 0;
  for (let i = 0; i < numBits; i++) {
    coordinate |= (code & 1 << 2 * i) >> i;
  }
  return coordinate;
}

// node_modules/@maplibre/mlt/dist/vector/geometry/geometryType.js
var GEOMETRY_TYPE;
(function(GEOMETRY_TYPE2) {
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["POINT"] = 0] = "POINT";
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["LINESTRING"] = 1] = "LINESTRING";
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["POLYGON"] = 2] = "POLYGON";
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["MULTIPOINT"] = 3] = "MULTIPOINT";
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["MULTILINESTRING"] = 4] = "MULTILINESTRING";
  GEOMETRY_TYPE2[GEOMETRY_TYPE2["MULTIPOLYGON"] = 5] = "MULTIPOLYGON";
})(GEOMETRY_TYPE || (GEOMETRY_TYPE = {}));
var SINGLE_PART_GEOMETRY_TYPE;
(function(SINGLE_PART_GEOMETRY_TYPE2) {
  SINGLE_PART_GEOMETRY_TYPE2[SINGLE_PART_GEOMETRY_TYPE2["POINT"] = 0] = "POINT";
  SINGLE_PART_GEOMETRY_TYPE2[SINGLE_PART_GEOMETRY_TYPE2["LINESTRING"] = 1] = "LINESTRING";
  SINGLE_PART_GEOMETRY_TYPE2[SINGLE_PART_GEOMETRY_TYPE2["POLYGON"] = 2] = "POLYGON";
})(SINGLE_PART_GEOMETRY_TYPE || (SINGLE_PART_GEOMETRY_TYPE = {}));

// node_modules/@maplibre/mlt/dist/vector/geometry/vertexBufferType.js
var VertexBufferType;
(function(VertexBufferType2) {
  VertexBufferType2[VertexBufferType2["MORTON"] = 0] = "MORTON";
  VertexBufferType2[VertexBufferType2["VEC_2"] = 1] = "VEC_2";
  VertexBufferType2[VertexBufferType2["VEC_3"] = 2] = "VEC_3";
})(VertexBufferType || (VertexBufferType = {}));

// node_modules/@mapbox/point-geometry/index.js
function Point(x, y) {
  this.x = x;
  this.y = y;
}
Point.prototype = {
  /**
   * Clone this point, returning a new point that can be modified
   * without affecting the old one.
   * @return {Point} the clone
   */
  clone() {
    return new Point(this.x, this.y);
  },
  /**
   * Add this point's x & y coordinates to another point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  add(p) {
    return this.clone()._add(p);
  },
  /**
   * Subtract this point's x & y coordinates to from point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  sub(p) {
    return this.clone()._sub(p);
  },
  /**
   * Multiply this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  multByPoint(p) {
    return this.clone()._multByPoint(p);
  },
  /**
   * Divide this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  divByPoint(p) {
    return this.clone()._divByPoint(p);
  },
  /**
   * Multiply this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  mult(k) {
    return this.clone()._mult(k);
  },
  /**
   * Divide this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  div(k) {
    return this.clone()._div(k);
  },
  /**
   * Rotate this point around the 0, 0 origin by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @return {Point} output point
   */
  rotate(a) {
    return this.clone()._rotate(a);
  },
  /**
   * Rotate this point around p point by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @param {Point} p Point to rotate around
   * @return {Point} output point
   */
  rotateAround(a, p) {
    return this.clone()._rotateAround(a, p);
  },
  /**
   * Multiply this point by a 4x1 transformation matrix
   * @param {[number, number, number, number]} m transformation matrix
   * @return {Point} output point
   */
  matMult(m) {
    return this.clone()._matMult(m);
  },
  /**
   * Calculate this point but as a unit vector from 0, 0, meaning
   * that the distance from the resulting point to the 0, 0
   * coordinate will be equal to 1 and the angle from the resulting
   * point to the 0, 0 coordinate will be the same as before.
   * @return {Point} unit vector point
   */
  unit() {
    return this.clone()._unit();
  },
  /**
   * Compute a perpendicular point, where the new y coordinate
   * is the old x coordinate and the new x coordinate is the old y
   * coordinate multiplied by -1
   * @return {Point} perpendicular point
   */
  perp() {
    return this.clone()._perp();
  },
  /**
   * Return a version of this point with the x & y coordinates
   * rounded to integers.
   * @return {Point} rounded point
   */
  round() {
    return this.clone()._round();
  },
  /**
   * Return the magnitude of this point: this is the Euclidean
   * distance from the 0, 0 coordinate to this point's x and y
   * coordinates.
   * @return {number} magnitude
   */
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  /**
   * Judge whether this point is equal to another point, returning
   * true or false.
   * @param {Point} other the other point
   * @return {boolean} whether the points are equal
   */
  equals(other) {
    return this.x === other.x && this.y === other.y;
  },
  /**
   * Calculate the distance from this point to another point
   * @param {Point} p the other point
   * @return {number} distance
   */
  dist(p) {
    return Math.sqrt(this.distSqr(p));
  },
  /**
   * Calculate the distance from this point to another point,
   * without the square root step. Useful if you're comparing
   * relative distances.
   * @param {Point} p the other point
   * @return {number} distance
   */
  distSqr(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    return dx * dx + dy * dy;
  },
  /**
   * Get the angle from the 0, 0 coordinate to this point, in radians
   * coordinates.
   * @return {number} angle
   */
  angle() {
    return Math.atan2(this.y, this.x);
  },
  /**
   * Get the angle from this point to another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleTo(b) {
    return Math.atan2(this.y - b.y, this.x - b.x);
  },
  /**
   * Get the angle between this point and another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleWith(b) {
    return this.angleWithSep(b.x, b.y);
  },
  /**
   * Find the angle of the two vectors, solving the formula for
   * the cross product a x b = |a||b|sin(θ) for θ.
   * @param {number} x the x-coordinate
   * @param {number} y the y-coordinate
   * @return {number} the angle in radians
   */
  angleWithSep(x, y) {
    return Math.atan2(
      this.x * y - this.y * x,
      this.x * x + this.y * y
    );
  },
  /** @param {[number, number, number, number]} m */
  _matMult(m) {
    const x = m[0] * this.x + m[1] * this.y, y = m[2] * this.x + m[3] * this.y;
    this.x = x;
    this.y = y;
    return this;
  },
  /** @param {Point} p */
  _add(p) {
    this.x += p.x;
    this.y += p.y;
    return this;
  },
  /** @param {Point} p */
  _sub(p) {
    this.x -= p.x;
    this.y -= p.y;
    return this;
  },
  /** @param {number} k */
  _mult(k) {
    this.x *= k;
    this.y *= k;
    return this;
  },
  /** @param {number} k */
  _div(k) {
    this.x /= k;
    this.y /= k;
    return this;
  },
  /** @param {Point} p */
  _multByPoint(p) {
    this.x *= p.x;
    this.y *= p.y;
    return this;
  },
  /** @param {Point} p */
  _divByPoint(p) {
    this.x /= p.x;
    this.y /= p.y;
    return this;
  },
  _unit() {
    this._div(this.mag());
    return this;
  },
  _perp() {
    const y = this.y;
    this.y = this.x;
    this.x = -y;
    return this;
  },
  /** @param {number} angle */
  _rotate(angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x = cos * this.x - sin * this.y, y = sin * this.x + cos * this.y;
    this.x = x;
    this.y = y;
    return this;
  },
  /**
   * @param {number} angle
   * @param {Point} p
   */
  _rotateAround(angle, p) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
    this.x = x;
    this.y = y;
    return this;
  },
  _round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  },
  constructor: Point
};
Point.convert = function(p) {
  if (p instanceof Point) {
    return (
      /** @type {Point} */
      p
    );
  }
  if (Array.isArray(p)) {
    return new Point(+p[0], +p[1]);
  }
  if (p.x !== void 0 && p.y !== void 0) {
    return new Point(+p.x, +p.y);
  }
  throw new Error("Expected [x, y] or {x, y} point format");
};

// node_modules/@maplibre/mlt/dist/vector/geometry/geometryVectorConverter.js
function convertGeometryVector(geometryVector) {
  const geometries = new Array(geometryVector.numGeometries);
  let partOffsetCounter = 1;
  let ringOffsetsCounter = 1;
  let geometryOffsetsCounter = 1;
  let geometryCounter = 0;
  let vertexBufferOffset = 0;
  let vertexOffsetsOffset = 0;
  const mortonSettings = geometryVector.mortonSettings;
  const topologyVector = geometryVector.topologyVector;
  const geometryOffsets = topologyVector.geometryOffsets;
  const partOffsets = topologyVector.partOffsets;
  const ringOffsets = topologyVector.ringOffsets;
  const vertexOffsets = geometryVector.vertexOffsets;
  const nonOffset = !vertexOffsets || vertexOffsets.length === 0;
  const containsPolygon = geometryVector.containsPolygonGeometry();
  const vertexBuffer = geometryVector.vertexBuffer;
  for (let i = 0; i < geometryVector.numGeometries; i++) {
    const geometryType = geometryVector.geometryType(i);
    switch (geometryType) {
      case GEOMETRY_TYPE.POINT:
        {
          let x;
          let y;
          if (nonOffset) {
            x = vertexBuffer[vertexBufferOffset++];
            y = vertexBuffer[vertexBufferOffset++];
          } else if (geometryVector.vertexBufferType === VertexBufferType.MORTON) {
            const offset = vertexOffsets[vertexOffsetsOffset++];
            const mortonCode = vertexBuffer[offset];
            const vertex = decodeZOrderCurve(mortonCode, mortonSettings.numBits, mortonSettings.coordinateShift);
            x = vertex.x;
            y = vertex.y;
          } else {
            const offset = vertexOffsets[vertexOffsetsOffset++] * 2;
            x = vertexBuffer[offset];
            y = vertexBuffer[offset + 1];
          }
          geometries[geometryCounter++] = [[new Point(x, y)]];
          if (geometryOffsets)
            geometryOffsetsCounter++;
          if (partOffsets)
            partOffsetCounter++;
          if (ringOffsets)
            ringOffsetsCounter++;
        }
        break;
      case GEOMETRY_TYPE.MULTIPOINT:
        {
          const numPoints = geometryOffsets[geometryOffsetsCounter] - geometryOffsets[geometryOffsetsCounter - 1];
          geometryOffsetsCounter++;
          let points;
          if (nonOffset) {
            points = new Array(numPoints);
            for (let j = 0; j < numPoints; j++) {
              const x = vertexBuffer[vertexBufferOffset++];
              const y = vertexBuffer[vertexBufferOffset++];
              points[j] = new Point(x, y);
            }
          } else {
            points = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numPoints, false, mortonSettings);
            vertexOffsetsOffset += numPoints;
          }
          geometries[geometryCounter++] = points.map((point) => [point]);
          partOffsetCounter += numPoints;
          ringOffsetsCounter += numPoints;
        }
        break;
      case GEOMETRY_TYPE.LINESTRING:
        {
          let numVertices;
          if (containsPolygon) {
            numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
            ringOffsetsCounter++;
          } else {
            numVertices = partOffsets[partOffsetCounter] - partOffsets[partOffsetCounter - 1];
          }
          partOffsetCounter++;
          let vertices;
          if (nonOffset) {
            vertices = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numVertices, false);
            vertexBufferOffset += numVertices * 2;
          } else {
            vertices = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, false, mortonSettings);
            vertexOffsetsOffset += numVertices;
          }
          geometries[geometryCounter++] = [vertices];
          if (geometryOffsets)
            geometryOffsetsCounter++;
        }
        break;
      case GEOMETRY_TYPE.POLYGON:
        {
          const numRings = partOffsets[partOffsetCounter] - partOffsets[partOffsetCounter - 1];
          partOffsetCounter++;
          const rings = new Array(numRings - 1);
          let shell;
          let numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
          ringOffsetsCounter++;
          if (nonOffset) {
            shell = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numVertices, true);
            vertexBufferOffset += numVertices * 2;
            for (let j = 0; j < rings.length; j++) {
              numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
              ringOffsetsCounter++;
              rings[j] = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numVertices, true);
              vertexBufferOffset += numVertices * 2;
            }
          } else {
            shell = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, true, mortonSettings);
            vertexOffsetsOffset += numVertices;
            for (let j = 0; j < rings.length; j++) {
              numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
              ringOffsetsCounter++;
              rings[j] = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, true, mortonSettings);
              vertexOffsetsOffset += numVertices;
            }
          }
          geometries[geometryCounter++] = [shell].concat(rings);
          if (geometryOffsets)
            geometryOffsetsCounter++;
        }
        break;
      case GEOMETRY_TYPE.MULTILINESTRING:
        {
          const numLineStrings = geometryOffsets[geometryOffsetsCounter] - geometryOffsets[geometryOffsetsCounter - 1];
          geometryOffsetsCounter++;
          const lineStrings = new Array(numLineStrings);
          for (let j = 0; j < numLineStrings; j++) {
            let numVertices;
            if (containsPolygon) {
              numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
              ringOffsetsCounter++;
            } else {
              numVertices = partOffsets[partOffsetCounter] - partOffsets[partOffsetCounter - 1];
            }
            partOffsetCounter++;
            if (nonOffset) {
              lineStrings[j] = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numVertices, false);
              vertexBufferOffset += numVertices * 2;
            } else {
              const vertices = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, false, mortonSettings);
              lineStrings[j] = vertices;
              vertexOffsetsOffset += numVertices;
            }
          }
          geometries[geometryCounter++] = lineStrings;
        }
        break;
      case GEOMETRY_TYPE.MULTIPOLYGON:
        {
          const numPolygons = geometryOffsets[geometryOffsetsCounter] - geometryOffsets[geometryOffsetsCounter - 1];
          geometryOffsetsCounter++;
          const polygons = new Array(numPolygons);
          for (let j = 0; j < numPolygons; j++) {
            const numRings = partOffsets[partOffsetCounter] - partOffsets[partOffsetCounter - 1];
            partOffsetCounter++;
            let shell;
            const rings = new Array(numRings - 1);
            const numVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
            ringOffsetsCounter++;
            if (nonOffset) {
              shell = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numVertices, true);
              vertexBufferOffset += numVertices * 2;
            } else {
              shell = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numVertices, true, mortonSettings);
              vertexOffsetsOffset += numVertices;
            }
            for (let k = 0; k < rings.length; k++) {
              const numRingVertices = ringOffsets[ringOffsetsCounter] - ringOffsets[ringOffsetsCounter - 1];
              ringOffsetsCounter++;
              if (nonOffset) {
                rings[k] = getLineStringOrRing(vertexBuffer, vertexBufferOffset, numRingVertices, true);
                vertexBufferOffset += numRingVertices * 2;
              } else {
                rings[k] = decodeDictionaryEncodedVertices(geometryVector.vertexBufferType, vertexBuffer, vertexOffsets, vertexOffsetsOffset, numRingVertices, true, mortonSettings);
                vertexOffsetsOffset += numRingVertices;
              }
            }
            polygons[j] = [shell].concat(rings);
          }
          geometries[geometryCounter++] = polygons.flat();
        }
        break;
      default:
        throw new Error(`The specified geometry type (${geometryType}) is currently not supported.`);
    }
  }
  return geometries;
}
function decodeDictionaryEncodedVertices(vertexBufferType, vertexBuffer, vertexOffsets, vertexOffset, numVertices, isRing, mortonSettings) {
  if (vertexBufferType === VertexBufferType.MORTON) {
    return decodeMortonDictionaryEncodedVertices(vertexBuffer, vertexOffsets, vertexOffset, numVertices, isRing, mortonSettings);
  } else {
    return decodeVec2DictionaryEncodedVertices(vertexBuffer, vertexOffsets, vertexOffset, numVertices, isRing);
  }
}
function getLineStringOrRing(vertexBuffer, startIndex, numVertices, isRing) {
  const vertices = new Array(isRing ? numVertices + 1 : numVertices);
  for (let i = 0; i < numVertices * 2; i += 2) {
    const x = vertexBuffer[startIndex + i];
    const y = vertexBuffer[startIndex + i + 1];
    vertices[i / 2] = new Point(x, y);
  }
  if (isRing) {
    vertices[vertices.length - 1] = vertices[0];
  }
  return vertices;
}
function decodeVec2DictionaryEncodedVertices(vertexBuffer, vertexOffsets, vertexOffset, numVertices, isRing) {
  const vertices = new Array(isRing ? numVertices + 1 : numVertices);
  for (let i = 0; i < numVertices * 2; i += 2) {
    const offset = vertexOffsets[vertexOffset + i / 2] * 2;
    const x = vertexBuffer[offset];
    const y = vertexBuffer[offset + 1];
    vertices[i / 2] = new Point(x, y);
  }
  if (isRing) {
    vertices[vertices.length - 1] = vertices[0];
  }
  return vertices;
}
function decodeMortonDictionaryEncodedVertices(vertexBuffer, vertexOffsets, vertexOffset, numVertices, isRing, mortonSettings) {
  const vertices = new Array(isRing ? numVertices + 1 : numVertices);
  for (let i = 0; i < numVertices; i++) {
    const offset = vertexOffsets[vertexOffset + i];
    const mortonEncodedVertex = vertexBuffer[offset];
    const vertex = decodeZOrderCurve(mortonEncodedVertex, mortonSettings.numBits, mortonSettings.coordinateShift);
    vertices[i] = new Point(vertex.x, vertex.y);
  }
  if (isRing) {
    vertices[vertices.length - 1] = vertices[0];
  }
  return vertices;
}

// node_modules/@maplibre/mlt/dist/vector/geometry/geometryVector.js
var GeometryVector = class {
  constructor(_vertexBufferType, _topologyVector, _vertexOffsets, _vertexBuffer, _mortonSettings) {
    this._vertexBufferType = _vertexBufferType;
    this._topologyVector = _topologyVector;
    this._vertexOffsets = _vertexOffsets;
    this._vertexBuffer = _vertexBuffer;
    this._mortonSettings = _mortonSettings;
  }
  get vertexBufferType() {
    return this._vertexBufferType;
  }
  get topologyVector() {
    return this._topologyVector;
  }
  get vertexOffsets() {
    return this._vertexOffsets;
  }
  get vertexBuffer() {
    return this._vertexBuffer;
  }
  /* Allows faster access to the vertices since morton encoding is currently not used in the POC. Morton encoding
     will be used after adapting the shader to decode the morton codes on the GPU. */
  getSimpleEncodedVertex(index) {
    const offset = this.vertexOffsets ? this.vertexOffsets[index] * 2 : index * 2;
    const x = this.vertexBuffer[offset];
    const y = this.vertexBuffer[offset + 1];
    return [x, y];
  }
  //TODO: add scaling information to the constructor
  getVertex(index) {
    if (this.vertexOffsets && this.mortonSettings) {
      const vertexOffset = this.vertexOffsets[index];
      const mortonEncodedVertex = this.vertexBuffer[vertexOffset];
      const vertex = decodeZOrderCurve(mortonEncodedVertex, this.mortonSettings.numBits, this.mortonSettings.coordinateShift);
      return [vertex.x, vertex.y];
    }
    const offset = this.vertexOffsets ? this.vertexOffsets[index] * 2 : index * 2;
    const x = this.vertexBuffer[offset];
    const y = this.vertexBuffer[offset + 1];
    return [x, y];
  }
  getGeometries() {
    return convertGeometryVector(this);
  }
  get mortonSettings() {
    return this._mortonSettings;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/constGeometryVector.js
function createConstGeometryVector(numGeometries, geometryType, topologyVector, vertexOffsets, vertexBuffer) {
  return new ConstGeometryVector(numGeometries, geometryType, VertexBufferType.VEC_2, topologyVector, vertexOffsets, vertexBuffer);
}
function createMortonEncodedConstGeometryVector(numGeometries, geometryType, topologyVector, vertexOffsets, vertexBuffer, mortonInfo) {
  return new ConstGeometryVector(numGeometries, geometryType, VertexBufferType.MORTON, topologyVector, vertexOffsets, vertexBuffer, mortonInfo);
}
var ConstGeometryVector = class extends GeometryVector {
  constructor(_numGeometries, _geometryType, vertexBufferType, topologyVector, vertexOffsets, vertexBuffer, mortonSettings) {
    super(vertexBufferType, topologyVector, vertexOffsets, vertexBuffer, mortonSettings);
    this._numGeometries = _numGeometries;
    this._geometryType = _geometryType;
  }
  geometryType(_index) {
    return this._geometryType;
  }
  get numGeometries() {
    return this._numGeometries;
  }
  containsPolygonGeometry() {
    return this._geometryType === GEOMETRY_TYPE.POLYGON || this._geometryType === GEOMETRY_TYPE.MULTIPOLYGON;
  }
  containsSingleGeometryType() {
    return true;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/flatGeometryVector.js
function createFlatGeometryVector(geometryTypes, topologyVector, vertexOffsets, vertexBuffer) {
  return new FlatGeometryVector(VertexBufferType.VEC_2, geometryTypes, topologyVector, vertexOffsets, vertexBuffer);
}
function createFlatGeometryVectorMortonEncoded(geometryTypes, topologyVector, vertexOffsets, vertexBuffer, mortonInfo) {
  return new FlatGeometryVector(VertexBufferType.MORTON, geometryTypes, topologyVector, vertexOffsets, vertexBuffer, mortonInfo);
}
var FlatGeometryVector = class extends GeometryVector {
  constructor(vertexBufferType, _geometryTypes, topologyVector, vertexOffsets, vertexBuffer, mortonSettings) {
    super(vertexBufferType, topologyVector, vertexOffsets, vertexBuffer, mortonSettings);
    this._geometryTypes = _geometryTypes;
  }
  geometryType(index) {
    return this._geometryTypes[index];
  }
  get numGeometries() {
    return this._geometryTypes.length;
  }
  containsPolygonGeometry() {
    for (let i = 0; i < this.numGeometries; i++) {
      if (this.geometryType(i) === GEOMETRY_TYPE.POLYGON || this.geometryType(i) === GEOMETRY_TYPE.MULTIPOLYGON) {
        return true;
      }
    }
    return false;
  }
  containsSingleGeometryType() {
    return false;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/gpuVector.js
var GpuVector = class {
  constructor(_triangleOffsets, _indexBuffer, _vertexBuffer, _topologyVector) {
    this._triangleOffsets = _triangleOffsets;
    this._indexBuffer = _indexBuffer;
    this._vertexBuffer = _vertexBuffer;
    this._topologyVector = _topologyVector;
  }
  get triangleOffsets() {
    return this._triangleOffsets;
  }
  get indexBuffer() {
    return this._indexBuffer;
  }
  get vertexBuffer() {
    return this._vertexBuffer;
  }
  get topologyVector() {
    return this._topologyVector;
  }
  getGeometries() {
    if (!this._topologyVector) {
      throw new Error("Cannot convert GpuVector to coordinates without topology information");
    }
    const types = new Uint32Array(this.numGeometries);
    for (let i = 0; i < this.numGeometries; i++) {
      types[i] = this.geometryType(i);
    }
    return createFlatGeometryVector(types, this._topologyVector, void 0, this._vertexBuffer).getGeometries();
  }
  [Symbol.iterator]() {
    return null;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/constGpuVector.js
function createConstGpuVector(numGeometries, geometryType, triangleOffsets, indexBuffer, vertexBuffer, topologyVector) {
  return new ConstGpuVector(numGeometries, geometryType, triangleOffsets, indexBuffer, vertexBuffer, topologyVector);
}
var ConstGpuVector = class extends GpuVector {
  constructor(_numGeometries, _geometryType, triangleOffsets, indexBuffer, vertexBuffer, topologyVector) {
    super(triangleOffsets, indexBuffer, vertexBuffer, topologyVector);
    this._numGeometries = _numGeometries;
    this._geometryType = _geometryType;
  }
  geometryType(_index) {
    return this._geometryType;
  }
  get numGeometries() {
    return this._numGeometries;
  }
  containsSingleGeometryType() {
    return true;
  }
};

// node_modules/@maplibre/mlt/dist/vector/geometry/flatGpuVector.js
function createFlatGpuVector(geometryTypes, triangleOffsets, indexBuffer, vertexBuffer, topologyVector) {
  return new FlatGpuVector(geometryTypes, triangleOffsets, indexBuffer, vertexBuffer, topologyVector);
}
var FlatGpuVector = class extends GpuVector {
  constructor(_geometryTypes, triangleOffsets, indexBuffer, vertexBuffer, topologyVector) {
    super(triangleOffsets, indexBuffer, vertexBuffer, topologyVector);
    this._geometryTypes = _geometryTypes;
  }
  geometryType(index) {
    return this._geometryTypes[index];
  }
  get numGeometries() {
    return this._geometryTypes.length;
  }
  containsSingleGeometryType() {
    return false;
  }
};

// node_modules/@maplibre/mlt/dist/decoding/geometryDecoder.js
function decodeGeometryColumn(tile, numStreams, offset, numFeatures, scalingData) {
  const geometryTypeMetadata = decodeStreamMetadata(tile, offset);
  const geometryTypesVectorType = getVectorType(geometryTypeMetadata, numFeatures, tile, offset);
  let vertexOffsets;
  let vertexBuffer;
  let mortonSettings;
  let indexBuffer;
  if (geometryTypesVectorType === VectorType.CONST) {
    const geometryType = decodeUnsignedConstInt32Stream(tile, offset, geometryTypeMetadata);
    let geometryOffsets2;
    let partOffsets2;
    let ringOffsets2;
    let triangleOffsets2;
    for (let i = 0; i < numStreams - 1; i++) {
      const geometryStreamMetadata = decodeStreamMetadata(tile, offset);
      switch (geometryStreamMetadata.physicalStreamType) {
        case PhysicalStreamType.LENGTH:
          switch (geometryStreamMetadata.logicalStreamType.lengthType) {
            case LengthType.GEOMETRIES:
              geometryOffsets2 = decodeLengthStreamToOffsetBuffer(tile, offset, geometryStreamMetadata);
              break;
            case LengthType.PARTS:
              partOffsets2 = decodeLengthStreamToOffsetBuffer(tile, offset, geometryStreamMetadata);
              break;
            case LengthType.RINGS:
              ringOffsets2 = decodeLengthStreamToOffsetBuffer(tile, offset, geometryStreamMetadata);
              break;
            case LengthType.TRIANGLES:
              triangleOffsets2 = decodeLengthStreamToOffsetBuffer(tile, offset, geometryStreamMetadata);
          }
          break;
        case PhysicalStreamType.OFFSET: {
          switch (geometryStreamMetadata.logicalStreamType.offsetType) {
            case OffsetType.VERTEX:
              vertexOffsets = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
              break;
            case OffsetType.INDEX:
              indexBuffer = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
              break;
          }
          break;
        }
        case PhysicalStreamType.DATA: {
          if (DictionaryType.VERTEX === geometryStreamMetadata.logicalStreamType.dictionaryType) {
            vertexBuffer = decodeSignedInt32Stream(tile, offset, geometryStreamMetadata, scalingData);
          } else {
            const mortonMetadata = geometryStreamMetadata;
            mortonSettings = {
              numBits: mortonMetadata.numBits,
              coordinateShift: mortonMetadata.coordinateShift
            };
            vertexBuffer = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata, scalingData);
          }
          break;
        }
      }
    }
    if (indexBuffer) {
      if (geometryOffsets2 !== void 0 || partOffsets2 !== void 0) {
        const topologyVector = { geometryOffsets: geometryOffsets2, partOffsets: partOffsets2, ringOffsets: ringOffsets2 };
        return createConstGpuVector(numFeatures, geometryType, triangleOffsets2, indexBuffer, vertexBuffer, topologyVector);
      }
      return createConstGpuVector(numFeatures, geometryType, triangleOffsets2, indexBuffer, vertexBuffer);
    }
    return mortonSettings === void 0 ? (
      /* Currently only 2D coordinates (Vec2) are implemented in the encoder  */
      createConstGeometryVector(numFeatures, geometryType, { geometryOffsets: geometryOffsets2, partOffsets: partOffsets2, ringOffsets: ringOffsets2 }, vertexOffsets, vertexBuffer)
    ) : createMortonEncodedConstGeometryVector(numFeatures, geometryType, { geometryOffsets: geometryOffsets2, partOffsets: partOffsets2, ringOffsets: ringOffsets2 }, vertexOffsets, vertexBuffer, mortonSettings);
  }
  const geometryTypeVector = decodeUnsignedInt32Stream(tile, offset, geometryTypeMetadata);
  let geometryLengths;
  let partLengths;
  let ringLengths;
  let triangleOffsets;
  for (let i = 0; i < numStreams - 1; i++) {
    const geometryStreamMetadata = decodeStreamMetadata(tile, offset);
    switch (geometryStreamMetadata.physicalStreamType) {
      case PhysicalStreamType.LENGTH:
        switch (geometryStreamMetadata.logicalStreamType.lengthType) {
          case LengthType.GEOMETRIES:
            geometryLengths = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
            break;
          case LengthType.PARTS:
            partLengths = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
            break;
          case LengthType.RINGS:
            ringLengths = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
            break;
          case LengthType.TRIANGLES:
            triangleOffsets = decodeLengthStreamToOffsetBuffer(tile, offset, geometryStreamMetadata);
        }
        break;
      case PhysicalStreamType.OFFSET:
        switch (geometryStreamMetadata.logicalStreamType.offsetType) {
          case OffsetType.VERTEX:
            vertexOffsets = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
            break;
          case OffsetType.INDEX:
            indexBuffer = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata);
            break;
        }
        break;
      case PhysicalStreamType.DATA:
        if (DictionaryType.VERTEX === geometryStreamMetadata.logicalStreamType.dictionaryType) {
          vertexBuffer = decodeSignedInt32Stream(tile, offset, geometryStreamMetadata, scalingData);
        } else {
          const mortonMetadata = geometryStreamMetadata;
          mortonSettings = {
            numBits: mortonMetadata.numBits,
            coordinateShift: mortonMetadata.coordinateShift
          };
          vertexBuffer = decodeUnsignedInt32Stream(tile, offset, geometryStreamMetadata, scalingData);
        }
        break;
    }
  }
  let geometryOffsets;
  let partOffsets;
  let ringOffsets;
  if (geometryLengths) {
    geometryOffsets = decodeRootLengthStream(geometryTypeVector, geometryLengths, 2);
    if (partLengths && ringLengths) {
      partOffsets = decodeLevel1LengthStream(geometryTypeVector, geometryOffsets, partLengths, false);
      ringOffsets = decodeLevel2LengthStream(geometryTypeVector, geometryOffsets, partOffsets, ringLengths);
    } else if (partLengths) {
      partOffsets = decodeLevel1WithoutRingBufferLengthStream(geometryTypeVector, geometryOffsets, partLengths);
    }
  } else if (partLengths && ringLengths) {
    partOffsets = decodeRootLengthStream(geometryTypeVector, partLengths, 1);
    ringOffsets = decodeLevel1LengthStream(geometryTypeVector, partOffsets, ringLengths, true);
  } else if (partLengths) {
    partOffsets = decodeRootLengthStream(geometryTypeVector, partLengths, 0);
  }
  if (indexBuffer && !partOffsets) {
    return createFlatGpuVector(geometryTypeVector, triangleOffsets, indexBuffer, vertexBuffer);
  }
  if (indexBuffer) {
    return createFlatGpuVector(geometryTypeVector, triangleOffsets, indexBuffer, vertexBuffer, {
      geometryOffsets,
      partOffsets,
      ringOffsets
    });
  }
  return mortonSettings === void 0 ? createFlatGeometryVector(geometryTypeVector, { geometryOffsets, partOffsets, ringOffsets }, vertexOffsets, vertexBuffer) : createFlatGeometryVectorMortonEncoded(geometryTypeVector, { geometryOffsets, partOffsets, ringOffsets }, vertexOffsets, vertexBuffer, mortonSettings);
}
function decodeRootLengthStream(geometryTypes, rootLengthStream, bufferId) {
  const rootBufferOffsets = new Uint32Array(geometryTypes.length + 1);
  let previousOffset = 0;
  rootBufferOffsets[0] = previousOffset;
  let rootLengthCounter = 0;
  for (let i = 0; i < geometryTypes.length; i++) {
    previousOffset = rootBufferOffsets[i + 1] = previousOffset + (geometryTypes[i] > bufferId ? rootLengthStream[rootLengthCounter++] : 1);
  }
  return rootBufferOffsets;
}
function decodeLevel1LengthStream(geometryTypes, rootOffsetBuffer, level1LengthBuffer, isLineStringPresent) {
  const level1BufferOffsets = new Uint32Array(rootOffsetBuffer[rootOffsetBuffer.length - 1] + 1);
  let previousOffset = 0;
  level1BufferOffsets[0] = previousOffset;
  let level1BufferCounter = 1;
  let level1LengthBufferCounter = 0;
  for (let i = 0; i < geometryTypes.length; i++) {
    const geometryType = geometryTypes[i];
    const numGeometries = rootOffsetBuffer[i + 1] - rootOffsetBuffer[i];
    if (geometryType === 5 || geometryType === 2 || isLineStringPresent && (geometryType === 4 || geometryType === 1)) {
      for (let j = 0; j < numGeometries; j++) {
        previousOffset = level1BufferOffsets[level1BufferCounter++] = previousOffset + level1LengthBuffer[level1LengthBufferCounter++];
      }
    } else {
      for (let j = 0; j < numGeometries; j++) {
        level1BufferOffsets[level1BufferCounter++] = ++previousOffset;
      }
    }
  }
  return level1BufferOffsets;
}
function decodeLevel1WithoutRingBufferLengthStream(geometryTypes, rootOffsetBuffer, level1LengthBuffer) {
  const level1BufferOffsets = new Uint32Array(rootOffsetBuffer[rootOffsetBuffer.length - 1] + 1);
  let previousOffset = 0;
  level1BufferOffsets[0] = previousOffset;
  let level1OffsetBufferCounter = 1;
  let level1LengthCounter = 0;
  for (let i = 0; i < geometryTypes.length; i++) {
    const geometryType = geometryTypes[i];
    const numGeometries = rootOffsetBuffer[i + 1] - rootOffsetBuffer[i];
    if (geometryType === 4 || geometryType === 1) {
      for (let j = 0; j < numGeometries; j++) {
        previousOffset = level1BufferOffsets[level1OffsetBufferCounter++] = previousOffset + level1LengthBuffer[level1LengthCounter++];
      }
    } else {
      for (let j = 0; j < numGeometries; j++) {
        level1BufferOffsets[level1OffsetBufferCounter++] = ++previousOffset;
      }
    }
  }
  return level1BufferOffsets;
}
function decodeLevel2LengthStream(geometryTypes, rootOffsetBuffer, level1OffsetBuffer, level2LengthBuffer) {
  const level2BufferOffsets = new Uint32Array(level1OffsetBuffer[level1OffsetBuffer.length - 1] + 1);
  let previousOffset = 0;
  level2BufferOffsets[0] = previousOffset;
  let level1OffsetBufferCounter = 1;
  let level2OffsetBufferCounter = 1;
  let level2LengthBufferCounter = 0;
  for (let i = 0; i < geometryTypes.length; i++) {
    const geometryType = geometryTypes[i];
    const numGeometries = rootOffsetBuffer[i + 1] - rootOffsetBuffer[i];
    if (geometryType !== 0 && geometryType !== 3) {
      for (let j = 0; j < numGeometries; j++) {
        const numParts = level1OffsetBuffer[level1OffsetBufferCounter] - level1OffsetBuffer[level1OffsetBufferCounter - 1];
        level1OffsetBufferCounter++;
        for (let k = 0; k < numParts; k++) {
          previousOffset = level2BufferOffsets[level2OffsetBufferCounter++] = previousOffset + level2LengthBuffer[level2LengthBufferCounter++];
        }
      }
    } else {
      for (let j = 0; j < numGeometries; j++) {
        level2BufferOffsets[level2OffsetBufferCounter++] = ++previousOffset;
        level1OffsetBufferCounter++;
      }
    }
  }
  return level2BufferOffsets;
}

// node_modules/@maplibre/mlt/dist/vector/flat/booleanFlatVector.js
var BooleanFlatVector = class extends Vector {
  constructor(name, dataVector, sizeOrNullabilityBuffer) {
    super(name, dataVector.getBuffer(), sizeOrNullabilityBuffer);
    this.dataVector = dataVector;
  }
  getValueFromBuffer(index) {
    return this.dataVector.get(index);
  }
};

// node_modules/@maplibre/mlt/dist/vector/flat/floatFlatVector.js
var FloatFlatVector = class extends FixedSizeVector {
  getValueFromBuffer(index) {
    return this.dataBuffer[index];
  }
};

// node_modules/@maplibre/mlt/dist/vector/constant/int64ConstVector.js
var Int64ConstVector = class extends Vector {
  constructor(name, value, sizeOrNullabilityBuffer, isSigned) {
    super(name, isSigned ? BigInt64Array.of(value) : BigUint64Array.of(value), sizeOrNullabilityBuffer);
  }
  getValueFromBuffer(_index) {
    return this.dataBuffer[0];
  }
};

// node_modules/@maplibre/mlt/dist/vector/variableSizeVector.js
var VariableSizeVector = class extends Vector {
  constructor(name, offsetBuffer, dataBuffer, sizeOrNullabilityBuffer) {
    super(name, dataBuffer, sizeOrNullabilityBuffer);
    this.offsetBuffer = offsetBuffer;
  }
};

// node_modules/@maplibre/mlt/dist/vector/flat/stringFlatVector.js
var StringFlatVector = class extends VariableSizeVector {
  constructor(name, offsetBuffer, dataBuffer, nullabilityBuffer) {
    super(name, offsetBuffer, dataBuffer, nullabilityBuffer ?? offsetBuffer.length - 1);
  }
  getValueFromBuffer(index) {
    const start = this.offsetBuffer[index];
    const end = this.offsetBuffer[index + 1];
    return decodeString(this.dataBuffer, start, end);
  }
};

// node_modules/@maplibre/mlt/dist/vector/dictionary/stringDictionaryVector.js
var StringDictionaryVector = class extends VariableSizeVector {
  constructor(name, indexBuffer, offsetBuffer, dictionaryBuffer, nullabilityBuffer) {
    super(name, offsetBuffer, dictionaryBuffer, nullabilityBuffer ?? indexBuffer.length);
    this.indexBuffer = indexBuffer;
    this.indexBuffer = indexBuffer;
  }
  getValueFromBuffer(index) {
    const offset = this.indexBuffer[index];
    const start = this.offsetBuffer[offset];
    const end = this.offsetBuffer[offset + 1];
    return decodeString(this.dataBuffer, start, end);
  }
};

// node_modules/@maplibre/mlt/dist/decoding/fsstDecoder.js
function getDecodedLength(symbolLengths, compressedData) {
  let decodedLength = 0;
  for (let i = 0; i < compressedData.length; i++) {
    const symbolIndex = compressedData[i];
    if (symbolIndex === 255) {
      decodedLength++;
      i++;
    } else {
      decodedLength += symbolLengths[symbolIndex];
    }
  }
  return decodedLength;
}
function decodeFsst(symbols, symbolLengths, compressedData) {
  const symbolOffsets = new Uint32Array(symbolLengths.length);
  for (let i = 1; i < symbolLengths.length; i++) {
    symbolOffsets[i] = symbolOffsets[i - 1] + symbolLengths[i - 1];
  }
  const decodedData = new Uint8Array(getDecodedLength(symbolLengths, compressedData));
  let decodedOffset = 0;
  for (let i = 0; i < compressedData.length; i++) {
    const symbolIndex = compressedData[i];
    if (symbolIndex === 255) {
      i++;
      decodedData[decodedOffset++] = compressedData[i];
    } else {
      let symbolLength = symbolLengths[symbolIndex];
      let symbolOffset = symbolOffsets[symbolIndex];
      while (symbolLength-- > 0) {
        decodedData[decodedOffset++] = symbols[symbolOffset++];
      }
    }
  }
  return decodedData;
}

// node_modules/@maplibre/mlt/dist/vector/fsst-dictionary/stringFsstDictionaryVector.js
var StringFsstDictionaryVector = class extends VariableSizeVector {
  constructor(name, indexBuffer, offsetBuffer, dictionaryBuffer, symbolOffsetBuffer, symbolTableBuffer, nullabilityBuffer, sharedDictionaryCache) {
    super(name, offsetBuffer, dictionaryBuffer, nullabilityBuffer ?? indexBuffer.length);
    this.indexBuffer = indexBuffer;
    this.symbolOffsetBuffer = symbolOffsetBuffer;
    this.symbolTableBuffer = symbolTableBuffer;
    this.sharedDictionaryCache = sharedDictionaryCache;
  }
  getValueFromBuffer(index) {
    if (this.decodedDictionary == null) {
      this.decodedDictionary = this.sharedDictionaryCache?.decodedDictionary;
      if (this.decodedDictionary == null) {
        this.decodedDictionary = this.decodeDictionary();
        if (this.sharedDictionaryCache) {
          this.sharedDictionaryCache.decodedDictionary = this.decodedDictionary;
        }
      }
    }
    const offset = this.indexBuffer[index];
    const start = this.offsetBuffer[offset];
    const end = this.offsetBuffer[offset + 1];
    return decodeString(this.decodedDictionary, start, end);
  }
  decodeDictionary() {
    if (this.symbolLengthBuffer == null) {
      this.symbolLengthBuffer = this.offsetToLengthBuffer(this.symbolOffsetBuffer);
    }
    return decodeFsst(this.symbolTableBuffer, this.symbolLengthBuffer, this.dataBuffer);
  }
  // TODO: get rid of that conversion
  offsetToLengthBuffer(offsetBuffer) {
    const lengthBuffer = new Uint32Array(offsetBuffer.length - 1);
    let previousOffset = offsetBuffer[0];
    for (let i = 1; i < offsetBuffer.length; i++) {
      const offset = offsetBuffer[i];
      lengthBuffer[i - 1] = offset - previousOffset;
      previousOffset = offset;
    }
    return lengthBuffer;
  }
};

// node_modules/@maplibre/mlt/dist/decoding/stringDecoder.js
function decodeString2(name, data, offset, numStreams, bitVector) {
  let dictionaryLengthStream;
  let offsetStream;
  let dictionaryStream;
  let symbolLengthStream;
  let symbolTableStream;
  let nullabilityBuffer = bitVector;
  let plainLengthStream;
  let plainDataStream;
  for (let i = 0; i < numStreams; i++) {
    const streamMetadata = decodeStreamMetadata(data, offset);
    switch (streamMetadata.physicalStreamType) {
      case PhysicalStreamType.PRESENT: {
        const presentData = decodeBooleanRle(data, streamMetadata.numValues, streamMetadata.byteLength, offset);
        const presentStream = new BitVector(presentData, streamMetadata.numValues);
        nullabilityBuffer = bitVector ?? presentStream;
        break;
      }
      case PhysicalStreamType.OFFSET: {
        offsetStream = decodeUnsignedInt32Stream(data, offset, streamMetadata, void 0, nullabilityBuffer);
        break;
      }
      case PhysicalStreamType.LENGTH: {
        const lengthStream = decodeLengthStreamToOffsetBuffer(data, offset, streamMetadata);
        if (LengthType.DICTIONARY === streamMetadata.logicalStreamType.lengthType) {
          dictionaryLengthStream = lengthStream;
        } else if (LengthType.SYMBOL === streamMetadata.logicalStreamType.lengthType) {
          symbolLengthStream = lengthStream;
        } else {
          plainLengthStream = lengthStream;
        }
        break;
      }
      case PhysicalStreamType.DATA: {
        const dataStream = data.subarray(offset.get(), offset.get() + streamMetadata.byteLength);
        offset.add(streamMetadata.byteLength);
        const dictType = streamMetadata.logicalStreamType.dictionaryType;
        if (DictionaryType.FSST === dictType) {
          symbolTableStream = dataStream;
        } else if (DictionaryType.SINGLE === dictType || DictionaryType.SHARED === dictType) {
          dictionaryStream = dataStream;
        } else if (DictionaryType.NONE === dictType) {
          plainDataStream = dataStream;
        }
        break;
      }
    }
  }
  return decodeFsstDictionaryVector(name, symbolTableStream, offsetStream, dictionaryLengthStream, dictionaryStream, symbolLengthStream, nullabilityBuffer) ?? decodeDictionaryVector(name, dictionaryStream, offsetStream, dictionaryLengthStream, nullabilityBuffer) ?? decodePlainStringVector(name, plainLengthStream, plainDataStream, offsetStream, nullabilityBuffer);
}
function decodeFsstDictionaryVector(name, symbolTableStream, offsetStream, dictionaryLengthStream, dictionaryStream, symbolLengthStream, nullabilityBuffer) {
  if (!symbolTableStream) {
    return void 0;
  }
  if (!offsetStream || !dictionaryLengthStream || !dictionaryStream || !symbolLengthStream) {
    throw new Error(`Incomplete FSST dictionary string column "${name}"`);
  }
  return new StringFsstDictionaryVector(name, offsetStream, dictionaryLengthStream, dictionaryStream, symbolLengthStream, symbolTableStream, nullabilityBuffer);
}
function decodeDictionaryVector(name, dictionaryStream, offsetStream, dictionaryLengthStream, nullabilityBuffer) {
  if (!dictionaryStream) {
    return void 0;
  }
  if (!offsetStream || !dictionaryLengthStream) {
    throw new Error(`Incomplete dictionary string column "${name}"`);
  }
  return nullabilityBuffer ? new StringDictionaryVector(name, offsetStream, dictionaryLengthStream, dictionaryStream, nullabilityBuffer) : new StringDictionaryVector(name, offsetStream, dictionaryLengthStream, dictionaryStream);
}
function decodePlainStringVector(name, plainLengthStream, plainDataStream, offsetStream, nullabilityBuffer) {
  if (!plainLengthStream || !plainDataStream) {
    return void 0;
  }
  if (offsetStream) {
    return nullabilityBuffer ? new StringDictionaryVector(name, offsetStream, plainLengthStream, plainDataStream, nullabilityBuffer) : new StringDictionaryVector(name, offsetStream, plainLengthStream, plainDataStream);
  }
  if (nullabilityBuffer && nullabilityBuffer.size() !== plainLengthStream.length - 1) {
    const sparseOffsetStream = new Uint32Array(nullabilityBuffer.size());
    let valueIndex = 0;
    for (let i = 0; i < nullabilityBuffer.size(); i++) {
      if (nullabilityBuffer.get(i)) {
        sparseOffsetStream[i] = valueIndex++;
      } else {
        sparseOffsetStream[i] = 0;
      }
    }
    return new StringDictionaryVector(name, sparseOffsetStream, plainLengthStream, plainDataStream, nullabilityBuffer);
  }
  return nullabilityBuffer ? new StringFlatVector(name, plainLengthStream, plainDataStream, nullabilityBuffer) : new StringFlatVector(name, plainLengthStream, plainDataStream);
}
function decodeSharedDictionary(data, offset, column, propertyColumnNames) {
  let dictionaryOffsetBuffer;
  let dictionaryBuffer;
  let symbolOffsetBuffer;
  let symbolTableBuffer;
  let dictionaryStreamDecoded = false;
  while (!dictionaryStreamDecoded) {
    const streamMetadata = decodeStreamMetadata(data, offset);
    switch (streamMetadata.physicalStreamType) {
      case PhysicalStreamType.LENGTH:
        if (LengthType.DICTIONARY === streamMetadata.logicalStreamType.lengthType) {
          dictionaryOffsetBuffer = decodeLengthStreamToOffsetBuffer(data, offset, streamMetadata);
        } else {
          symbolOffsetBuffer = decodeLengthStreamToOffsetBuffer(data, offset, streamMetadata);
        }
        break;
      case PhysicalStreamType.DATA:
        if (DictionaryType.SINGLE === streamMetadata.logicalStreamType.dictionaryType || DictionaryType.SHARED === streamMetadata.logicalStreamType.dictionaryType) {
          dictionaryBuffer = data.subarray(offset.get(), offset.get() + streamMetadata.byteLength);
          dictionaryStreamDecoded = true;
        } else {
          symbolTableBuffer = data.subarray(offset.get(), offset.get() + streamMetadata.byteLength);
        }
        offset.add(streamMetadata.byteLength);
        break;
    }
  }
  if (column.type !== "complexType") {
    throw new Error(`Shared dictionary column ${column.name} must be a complex (struct) column.`);
  }
  if (!dictionaryOffsetBuffer || !dictionaryBuffer) {
    throw new Error(`Incomplete shared dictionary for column "${column.name}"`);
  }
  const childFields = column.complexType.children;
  const stringDictionaryVectors = [];
  const sharedDictionaryCache = symbolTableBuffer ? {} : void 0;
  let i = 0;
  for (const childField of childFields) {
    const numStreams = decodeVarintInt32(data, offset, 1)[0];
    if (numStreams === 0) {
      continue;
    }
    const columnName = childField.name ? `${column.name}${childField.name}` : column.name;
    if (propertyColumnNames) {
      if (!propertyColumnNames.has(columnName)) {
        skipColumn(numStreams, data, offset);
        continue;
      }
    }
    if (childField.type !== "scalarField" || childField.scalarField.physicalType !== ScalarType.STRING) {
      throw new Error("Currently only scalar string fields are implemented for a struct.");
    }
    if (numStreams > 1 && !childField.nullable || numStreams === 1 && childField.nullable) {
      throw new Error(`The number of streams for the child field ${childField.name} does not match its nullability. nullibilty: ${childField.nullable}, numStreams: ${numStreams}`);
    }
    let presentStreamBitVector;
    if (childField.nullable) {
      const presentStreamMetadata = decodeStreamMetadata(data, offset);
      const presentStream = decodeBooleanRle(data, presentStreamMetadata.numValues, presentStreamMetadata.byteLength, offset);
      presentStreamBitVector = new BitVector(presentStream, presentStreamMetadata.numValues);
    }
    const offsetStreamMetadata = decodeStreamMetadata(data, offset);
    const offsetStream = decodeUnsignedInt32Stream(data, offset, offsetStreamMetadata, void 0, presentStreamBitVector);
    if (symbolTableBuffer) {
      if (!symbolOffsetBuffer) {
        throw new Error(`Incomplete shared FSST dictionary for column "${columnName}"`);
      }
      stringDictionaryVectors[i++] = new StringFsstDictionaryVector(columnName, offsetStream, dictionaryOffsetBuffer, dictionaryBuffer, symbolOffsetBuffer, symbolTableBuffer, presentStreamBitVector, sharedDictionaryCache);
    } else {
      stringDictionaryVectors[i++] = new StringDictionaryVector(columnName, offsetStream, dictionaryOffsetBuffer, dictionaryBuffer, presentStreamBitVector);
    }
  }
  return stringDictionaryVectors;
}

// node_modules/@maplibre/mlt/dist/vector/flat/objectFlatVector.js
var ObjectFlatVector = class extends Vector {
  constructor(name, values, nullabilityBuffer) {
    super(name, new Uint8Array(0), nullabilityBuffer ?? values.length);
    this.values = values;
  }
  getValueFromBuffer(index) {
    return this.values[index];
  }
};

// node_modules/@maplibre/mlt/dist/metadata/tile/mapMask.js
var MapMask;
(function(MapMask2) {
  MapMask2[MapMask2["STRING"] = 1] = "STRING";
  MapMask2[MapMask2["INT32"] = 2] = "INT32";
  MapMask2[MapMask2["UINT32"] = 4] = "UINT32";
  MapMask2[MapMask2["INT64"] = 8] = "INT64";
  MapMask2[MapMask2["UINT64"] = 16] = "UINT64";
  MapMask2[MapMask2["FLOAT"] = 32] = "FLOAT";
  MapMask2[MapMask2["DOUBLE"] = 64] = "DOUBLE";
  MapMask2[MapMask2["PRESENCE"] = 128] = "PRESENCE";
})(MapMask || (MapMask = {}));

// node_modules/@maplibre/mlt/dist/metadata/tile/mapControlValue.js
var MapControlValue;
(function(MapControlValue2) {
  MapControlValue2[MapControlValue2["FALSE"] = 0] = "FALSE";
  MapControlValue2[MapControlValue2["TRUE"] = 1] = "TRUE";
  MapControlValue2[MapControlValue2["START_MAP"] = 2] = "START_MAP";
  MapControlValue2[MapControlValue2["START_LIST"] = 3] = "START_LIST";
  MapControlValue2[MapControlValue2["COUNT"] = 4] = "COUNT";
})(MapControlValue || (MapControlValue = {}));

// node_modules/@maplibre/mlt/dist/decoding/mapPropertyDecoder.js
function decodeMapPropertyColumn(data, offset, columnMetadata, numStreams) {
  const columnNames = getMapColumnNames(columnMetadata);
  if (numStreams === 0) {
    return columnNames.map((name) => new ObjectFlatVector(name, []));
  }
  const streams = decodeMapStreams(data, offset, numStreams);
  const totalCounts = streams.presentStream ? streams.presentCount : streams.lengthStream.length;
  const featureCount = totalCounts / columnNames.length;
  const vectors = [];
  let countsCursor = 0;
  let valuesCursor = 0;
  for (let childIndex = 0; childIndex < columnNames.length; childIndex++) {
    const child = decodeChildColumn(streams, childIndex, featureCount, countsCursor, valuesCursor);
    vectors.push(new ObjectFlatVector(columnNames[childIndex], child.value, child.nullabilityBuffer));
    countsCursor = child.countsEnd;
    valuesCursor = child.valuesEnd;
  }
  return vectors;
}
function getMapColumnNames(columnMetadata) {
  const children = columnMetadata.type === "complexType" ? columnMetadata.complexType.children : void 0;
  if (!children || children.length === 0) {
    return [columnMetadata.name];
  }
  return children.map((child) => columnMetadata.name + (child.name ?? ""));
}
function decodeMapStreams(data, offset, numStreams) {
  const dictionaryMask = data[offset.get()];
  offset.add(1);
  const lengthStream = decodeUnsignedInt32Stream(data, offset, decodeStreamMetadata(data, offset));
  let remainingStreams = numStreams - 1;
  const dictionary = [];
  if (dictionaryMask & MapMask.STRING) {
    remainingStreams -= decodeStringDictionary(data, offset, dictionary);
  }
  remainingStreams -= decodeIntegerDictionaries(data, offset, dictionaryMask, dictionary);
  remainingStreams -= decodeFloatingPointDictionaries(data, offset, dictionaryMask, dictionary);
  let presentStream;
  let presentCount = 0;
  if (dictionaryMask & MapMask.PRESENCE) {
    const presence = decodePresenceStream(data, offset);
    presentStream = presence.value;
    presentCount = presence.count;
    remainingStreams--;
  }
  let flattenedValues = new Uint32Array(0);
  if (remainingStreams > 0) {
    flattenedValues = decodeUnsignedInt32Stream(data, offset, decodeStreamMetadata(data, offset));
    remainingStreams--;
  }
  if (remainingStreams !== 0) {
    throw new Error(`Unexpected number of remaining streams while decoding map column: ${remainingStreams}`);
  }
  return { lengthStream, dictionary, presentStream, presentCount, flattenedValues };
}
function decodeStringDictionary(data, offset, dictionary) {
  const stringStreamCount = data[offset.get()];
  offset.add(1);
  const strings = decodeString2("", data, offset, stringStreamCount);
  if (strings) {
    for (let i = 0; i < strings.size; i++) {
      dictionary.push(strings.getValue(i));
    }
  }
  return stringStreamCount;
}
function decodeIntegerDictionaries(data, offset, dictionaryMask, dictionary) {
  let consumed = 0;
  if (dictionaryMask & MapMask.INT32) {
    pushAll(dictionary, decodeSignedInt32Stream(data, offset, decodeStreamMetadata(data, offset)));
    consumed++;
  } else if (dictionaryMask & MapMask.INT64) {
    pushAll(dictionary, decodeSignedInt64Stream(data, offset, decodeStreamMetadata(data, offset)));
    consumed++;
  }
  if (dictionaryMask & MapMask.UINT32) {
    pushAll(dictionary, decodeUnsignedInt32Stream(data, offset, decodeStreamMetadata(data, offset)));
    consumed++;
  } else if (dictionaryMask & MapMask.UINT64) {
    pushAll(dictionary, decodeUnsignedInt64Stream(data, offset, decodeStreamMetadata(data, offset)));
    consumed++;
  }
  return consumed;
}
function decodeFloatingPointDictionaries(data, offset, dictionaryMask, dictionary) {
  let consumed = 0;
  if (dictionaryMask & MapMask.FLOAT) {
    const streamMetadata = decodeStreamMetadata(data, offset);
    pushAll(dictionary, decodeFloatsLE(data, offset, streamMetadata.numValues));
    consumed++;
  }
  if (dictionaryMask & MapMask.DOUBLE) {
    const streamMetadata = decodeStreamMetadata(data, offset);
    pushAll(dictionary, decodeDoublesLE(data, offset, streamMetadata.numValues));
    consumed++;
  }
  return consumed;
}
function decodePresenceStream(data, offset) {
  const streamMetadata = decodeStreamMetadata(data, offset);
  if (streamMetadata.physicalStreamType !== PhysicalStreamType.PRESENT) {
    throw new Error(`Expected PRESENT stream for map column but found: ${streamMetadata.physicalStreamType}`);
  }
  const count = streamMetadata.numValues;
  const streamDataStart = offset.get();
  const value = new BitVector(decodeBooleanRle(data, count, streamMetadata.byteLength, offset), count);
  offset.set(streamDataStart + streamMetadata.byteLength);
  return { value, count };
}
function decodeChildColumn(streams, childIndex, featureCount, countsCursor, valuesCursor) {
  const { lengthStream, flattenedValues, presentStream, dictionary } = streams;
  const presentOffset = childIndex * featureCount;
  let presentInChild = featureCount;
  let nullabilityBuffer;
  if (presentStream) {
    nullabilityBuffer = new BitVector(new Uint8Array(Math.ceil(featureCount / 8)), featureCount);
    presentInChild = 0;
    for (let i = 0; i < featureCount; i++) {
      if (presentStream.get(presentOffset + i)) {
        nullabilityBuffer.set(i, true);
        presentInChild++;
      }
    }
  }
  const countsEnd = countsCursor + presentInChild;
  if (countsEnd > lengthStream.length) {
    throw new Error("Merged map counts underflow while decoding child streams");
  }
  const value = new Array(featureCount);
  let countCursor = countsCursor;
  let flattenedIndex = valuesCursor;
  for (let featureIndex = 0; featureIndex < featureCount; featureIndex++) {
    if (presentStream && !presentStream.get(presentOffset + featureIndex)) {
      value[featureIndex] = null;
      continue;
    }
    const endIndex = flattenedIndex + lengthStream[countCursor++];
    if (endIndex > flattenedValues.length) {
      throw new Error("Map value stream underflow while decoding feature payload");
    }
    const decoded = decodeFeatureValue(flattenedValues, flattenedIndex, endIndex, dictionary);
    value[featureIndex] = decoded.value;
    flattenedIndex = decoded.nextIndex;
  }
  let childValueCount = 0;
  for (let i = countsCursor; i < countsEnd; i++)
    childValueCount += lengthStream[i];
  const valuesEnd = valuesCursor + childValueCount;
  if (flattenedIndex !== valuesEnd) {
    throw new Error("Unused flattened map values remain after decode");
  }
  return { value, nullabilityBuffer, countsEnd, valuesEnd };
}
function decodeFeatureValue(flattenedValues, startIndex, endIndex, dictionary) {
  if (endIndex - startIndex === 1 || flattenedValues[startIndex] === MapControlValue.START_LIST) {
    return decodeValue(flattenedValues, startIndex, endIndex, dictionary);
  }
  return decodeMapEntries(flattenedValues, startIndex, endIndex, dictionary);
}
function decodeMapEntries(flattenedValues, startIndex, endIndex, dictionary) {
  const value = /* @__PURE__ */ Object.create(null);
  let index = startIndex;
  while (index < endIndex) {
    const key = decodeScalarByIndex(flattenedValues[index++], dictionary);
    if (typeof key !== "string") {
      throw new Error(`Map key dictionary index does not resolve to a string: ${key}`);
    }
    const decoded = decodeValue(flattenedValues, index, endIndex, dictionary);
    value[key] = decoded.value;
    index = decoded.nextIndex;
  }
  return { value, nextIndex: index };
}
function decodeValue(flattenedValues, startIndex, endIndex, dictionary) {
  if (startIndex >= endIndex) {
    throw new Error("Unexpected end of map value stream");
  }
  const token = flattenedValues[startIndex];
  if (token === MapControlValue.FALSE)
    return { value: false, nextIndex: startIndex + 1 };
  if (token === MapControlValue.TRUE)
    return { value: true, nextIndex: startIndex + 1 };
  if (token === MapControlValue.START_MAP) {
    const valueEndIndex = decodeNestedPayloadEnd(flattenedValues, startIndex, endIndex);
    const nested = decodeMapEntries(flattenedValues, startIndex + 2, valueEndIndex, dictionary);
    return { value: nested.value, nextIndex: valueEndIndex };
  }
  if (token === MapControlValue.START_LIST) {
    const valueEndIndex = decodeNestedPayloadEnd(flattenedValues, startIndex, endIndex);
    const value = [];
    let index = startIndex + 2;
    while (index < valueEndIndex) {
      const nested = decodeValue(flattenedValues, index, valueEndIndex, dictionary);
      value.push(nested.value);
      index = nested.nextIndex;
    }
    return { value, nextIndex: valueEndIndex };
  }
  return { value: decodeScalarByIndex(token, dictionary), nextIndex: startIndex + 1 };
}
function decodeNestedPayloadEnd(flattenedValues, startIndex, endIndex) {
  if (startIndex + 1 >= endIndex) {
    throw new Error("Missing length for nested map/list payload");
  }
  const encodedLength = flattenedValues[startIndex + 1];
  if (encodedLength < 2) {
    throw new Error(`Invalid nested payload length: ${encodedLength}`);
  }
  const valueEndIndex = startIndex + encodedLength;
  if (valueEndIndex > endIndex) {
    throw new Error("Nested payload exceeds containing payload bounds");
  }
  return valueEndIndex;
}
function decodeScalarByIndex(token, dictionary) {
  const dictionaryIndex = token - MapControlValue.COUNT;
  if (dictionaryIndex < 0 || dictionaryIndex >= dictionary.length) {
    throw new Error(`Scalar dictionary index out of range: ${token}`);
  }
  return dictionary[dictionaryIndex];
}
function pushAll(dictionary, values) {
  for (const value of values)
    dictionary.push(value);
}

// node_modules/@maplibre/mlt/dist/decoding/propertyDecoder.js
function decodePropertyColumn(data, offset, columnMetadata, numStreams, numFeatures, propertyColumnNames) {
  if (columnMetadata.type === "scalarType") {
    if (propertyColumnNames && !propertyColumnNames.has(columnMetadata.name)) {
      skipColumn(numStreams, data, offset);
      return null;
    }
    return decodeScalarPropertyColumn(numStreams, data, offset, numFeatures, columnMetadata.scalarType, columnMetadata);
  }
  if (columnMetadata.complexType?.physicalType === ComplexType.MAP) {
    return decodeMapPropertyColumn(data, offset, columnMetadata, numStreams);
  }
  if (numStreams === 0) {
    return null;
  }
  return decodeSharedDictionary(data, offset, columnMetadata, propertyColumnNames);
}
function decodeScalarPropertyColumn(numStreams, data, offset, numFeatures, column, columnMetadata) {
  let nullabilityBuffer;
  if (numStreams === 0) {
    return null;
  }
  if (columnMetadata.nullable) {
    const presentStreamMetadata = decodeStreamMetadata(data, offset);
    const numValues = presentStreamMetadata.numValues;
    const streamDataStart = offset.get();
    const presentVector = decodeBooleanRle(data, numValues, presentStreamMetadata.byteLength, offset);
    offset.set(streamDataStart + presentStreamMetadata.byteLength);
    nullabilityBuffer = new BitVector(presentVector, presentStreamMetadata.numValues);
  }
  const sizeOrNullabilityBuffer = nullabilityBuffer ?? numFeatures;
  const scalarType = column.physicalType;
  switch (scalarType) {
    case ScalarType.UINT_32:
    case ScalarType.INT_32:
      return decodeInt32Column(data, offset, columnMetadata, column, sizeOrNullabilityBuffer);
    case ScalarType.STRING: {
      const stringDataStreams = columnMetadata.nullable ? numStreams - 1 : numStreams;
      return decodeString2(columnMetadata.name, data, offset, stringDataStreams, nullabilityBuffer) ?? null;
    }
    case ScalarType.BOOLEAN:
      return decodeBooleanColumn(data, offset, columnMetadata, numFeatures, sizeOrNullabilityBuffer);
    case ScalarType.UINT_64:
    case ScalarType.INT_64:
      return decodeInt64Column(data, offset, columnMetadata, sizeOrNullabilityBuffer, column);
    case ScalarType.FLOAT:
      return decodeFloatColumn(data, offset, columnMetadata, sizeOrNullabilityBuffer);
    case ScalarType.DOUBLE:
      return decodeDoubleColumn(data, offset, columnMetadata, sizeOrNullabilityBuffer);
    default:
      throw new Error(`The specified data type for the field is currently not supported: ${column}`);
  }
}
function decodeBooleanColumn(data, offset, column, _numFeatures, sizeOrNullabilityBuffer) {
  const dataStreamMetadata = decodeStreamMetadata(data, offset);
  const numValues = dataStreamMetadata.numValues;
  const streamDataStart = offset.get();
  const nullabilityBuffer = isNullabilityBuffer(sizeOrNullabilityBuffer) ? sizeOrNullabilityBuffer : void 0;
  const dataStream = decodeBooleanRle(data, numValues, dataStreamMetadata.byteLength, offset, nullabilityBuffer);
  offset.set(streamDataStart + dataStreamMetadata.byteLength);
  const dataVector = new BitVector(dataStream, numValues);
  return new BooleanFlatVector(column.name, dataVector, sizeOrNullabilityBuffer);
}
function decodeFloatColumn(data, offset, column, sizeOrNullabilityBuffer) {
  const dataStreamMetadata = decodeStreamMetadata(data, offset);
  const nullabilityBuffer = isNullabilityBuffer(sizeOrNullabilityBuffer) ? sizeOrNullabilityBuffer : void 0;
  const dataStream = decodeFloatsLE(data, offset, dataStreamMetadata.numValues, nullabilityBuffer);
  return new FloatFlatVector(column.name, dataStream, sizeOrNullabilityBuffer);
}
function decodeDoubleColumn(data, offset, column, sizeOrNullabilityBuffer) {
  const dataStreamMetadata = decodeStreamMetadata(data, offset);
  const nullabilityBuffer = isNullabilityBuffer(sizeOrNullabilityBuffer) ? sizeOrNullabilityBuffer : void 0;
  const dataStream = decodeDoublesLE(data, offset, dataStreamMetadata.numValues, nullabilityBuffer);
  return new DoubleFlatVector(column.name, dataStream, sizeOrNullabilityBuffer);
}
function decodeInt64Column(data, offset, column, sizeOrNullabilityBuffer, scalarColumn) {
  const dataStreamMetadata = decodeStreamMetadata(data, offset);
  const vectorType = getVectorType(dataStreamMetadata, sizeOrNullabilityBuffer, data, offset, "int64");
  const isSigned = scalarColumn.physicalType === ScalarType.INT_64;
  if (vectorType === VectorType.FLAT) {
    const nullabilityBuffer = isNullabilityBuffer(sizeOrNullabilityBuffer) ? sizeOrNullabilityBuffer : void 0;
    const dataStream = isSigned ? decodeSignedInt64Stream(data, offset, dataStreamMetadata, nullabilityBuffer) : decodeUnsignedInt64Stream(data, offset, dataStreamMetadata, nullabilityBuffer);
    return new Int64FlatVector(column.name, dataStream, sizeOrNullabilityBuffer);
  }
  if (vectorType === VectorType.SEQUENCE) {
    const id = decodeSequenceInt64Stream(data, offset, dataStreamMetadata);
    return new Int64SequenceVector(column.name, id[0], id[1], dataStreamMetadata.numRleValues, isSigned);
  }
  const constValue = isSigned ? decodeSignedConstInt64Stream(data, offset, dataStreamMetadata) : decodeUnsignedConstInt64Stream(data, offset, dataStreamMetadata);
  return new Int64ConstVector(column.name, constValue, sizeOrNullabilityBuffer, isSigned);
}
function decodeInt32Column(data, offset, column, scalarColumn, sizeOrNullabilityBuffer) {
  const dataStreamMetadata = decodeStreamMetadata(data, offset);
  const vectorType = getVectorType(dataStreamMetadata, sizeOrNullabilityBuffer, data, offset);
  const isSigned = scalarColumn.physicalType === ScalarType.INT_32;
  if (vectorType === VectorType.FLAT) {
    const nullabilityBuffer = isNullabilityBuffer(sizeOrNullabilityBuffer) ? sizeOrNullabilityBuffer : void 0;
    const dataStream = isSigned ? decodeSignedInt32Stream(data, offset, dataStreamMetadata, void 0, nullabilityBuffer) : decodeUnsignedInt32Stream(data, offset, dataStreamMetadata, void 0, nullabilityBuffer);
    return new Int32FlatVector(column.name, dataStream, sizeOrNullabilityBuffer);
  }
  if (vectorType === VectorType.SEQUENCE) {
    const id = decodeSequenceInt32Stream(data, offset, dataStreamMetadata);
    return new Int32SequenceVector(column.name, id[0], id[1], dataStreamMetadata.numRleValues, isSigned);
  }
  const constValue = isSigned ? decodeSignedConstInt32Stream(data, offset, dataStreamMetadata) : decodeUnsignedConstInt32Stream(data, offset, dataStreamMetadata);
  return new Int32ConstVector(column.name, constValue, sizeOrNullabilityBuffer, isSigned);
}
function isNullabilityBuffer(sizeOrNullabilityBuffer) {
  return sizeOrNullabilityBuffer instanceof BitVector;
}

// node_modules/@maplibre/mlt/dist/metadata/tileset/typeMap.js
var ColumnTypeCode = {
  /** Id columns occupy 0..3. */
  ID: 0,
  /** Set on an id column whose values can be null. */
  ID_NULLABLE: 1,
  /** Set on an id column holding 64-bit rather than 32-bit ids. */
  ID_LONG: 2,
  GEOMETRY: 4,
  /** Scalar properties are `SCALAR_BASE + scalarType * 2 + (nullable ? 1 : 0)`. */
  SCALAR_BASE: 10,
  STRUCT: 30,
  MAP: 31
};
function decodeColumnType(typeCode) {
  switch (typeCode) {
    case ColumnTypeCode.ID:
    case ColumnTypeCode.ID | ColumnTypeCode.ID_NULLABLE:
    case ColumnTypeCode.ID | ColumnTypeCode.ID_LONG:
    case ColumnTypeCode.ID | ColumnTypeCode.ID_LONG | ColumnTypeCode.ID_NULLABLE:
      return {
        nullable: (typeCode & ColumnTypeCode.ID_NULLABLE) !== 0,
        columnScope: ColumnScope.FEATURE,
        type: "scalarType",
        scalarType: {
          longID: (typeCode & ColumnTypeCode.ID_LONG) !== 0,
          type: "logicalType",
          logicalType: LogicalScalarType.ID
        }
      };
    case ColumnTypeCode.GEOMETRY:
      return {
        nullable: false,
        columnScope: ColumnScope.FEATURE,
        type: "complexType",
        complexType: {
          type: "physicalType",
          physicalType: ComplexType.GEOMETRY,
          children: []
        }
      };
    case ColumnTypeCode.STRUCT:
      return {
        nullable: false,
        columnScope: ColumnScope.FEATURE,
        type: "complexType",
        complexType: {
          type: "physicalType",
          physicalType: ComplexType.STRUCT,
          children: []
        }
      };
    case ColumnTypeCode.MAP:
      return {
        nullable: true,
        columnScope: ColumnScope.FEATURE,
        type: "complexType",
        complexType: {
          type: "physicalType",
          physicalType: ComplexType.MAP,
          children: []
        }
      };
    default:
      return mapScalarType(typeCode);
  }
}
function columnTypeHasName(typeCode) {
  return typeCode >= ColumnTypeCode.SCALAR_BASE;
}
function columnTypeHasChildren(typeCode) {
  return typeCode === ColumnTypeCode.STRUCT || typeCode === ColumnTypeCode.MAP;
}
function hasStreamCount(column) {
  if (column.type === "scalarType") {
    const scalarCol = column.scalarType;
    if (scalarCol.type === "physicalType") {
      const physicalType = scalarCol.physicalType;
      switch (physicalType) {
        case ScalarType.BOOLEAN:
        case ScalarType.INT_8:
        case ScalarType.UINT_8:
        case ScalarType.INT_32:
        case ScalarType.UINT_32:
        case ScalarType.INT_64:
        case ScalarType.UINT_64:
        case ScalarType.FLOAT:
        case ScalarType.DOUBLE:
          return false;
        case ScalarType.STRING:
          return true;
        default:
          return false;
      }
    }
    if (scalarCol.type === "logicalType") {
      return false;
    }
  } else if (column.type === "complexType") {
    const complexCol = column.complexType;
    if (complexCol.type === "physicalType") {
      const physicalType = complexCol.physicalType;
      switch (physicalType) {
        case ComplexType.GEOMETRY:
        case ComplexType.STRUCT:
        case ComplexType.MAP:
          return true;
        default:
          return false;
      }
    }
  }
  console.warn("Unexpected column type in hasStreamCount", column);
  return false;
}
function isLogicalIdColumn(column) {
  return column.type === "scalarType" && column.scalarType?.type === "logicalType" && column.scalarType.logicalType === LogicalScalarType.ID;
}
function isGeometryColumn(column) {
  return column.type === "complexType" && column.complexType?.type === "physicalType" && column.complexType.physicalType === ComplexType.GEOMETRY;
}
function mapScalarType(typeCode) {
  let physicalType;
  switch (typeCode) {
    case 10:
    case 11:
      physicalType = ScalarType.BOOLEAN;
      break;
    case 12:
    case 13:
      physicalType = ScalarType.INT_8;
      break;
    case 14:
    case 15:
      physicalType = ScalarType.UINT_8;
      break;
    case 16:
    case 17:
      physicalType = ScalarType.INT_32;
      break;
    case 18:
    case 19:
      physicalType = ScalarType.UINT_32;
      break;
    case 20:
    case 21:
      physicalType = ScalarType.INT_64;
      break;
    case 22:
    case 23:
      physicalType = ScalarType.UINT_64;
      break;
    case 24:
    case 25:
      physicalType = ScalarType.FLOAT;
      break;
    case 26:
    case 27:
      physicalType = ScalarType.DOUBLE;
      break;
    case 28:
    case 29:
      physicalType = ScalarType.STRING;
      break;
    default:
      return null;
  }
  return {
    nullable: (typeCode & 1) !== 0,
    columnScope: ColumnScope.FEATURE,
    type: "scalarType",
    scalarType: {
      longID: false,
      type: "physicalType",
      physicalType
    }
  };
}

// node_modules/@maplibre/mlt/dist/metadata/tileset/embeddedTilesetMetadataDecoder.js
var textDecoder = new TextDecoder();
var SUPPORTED_COLUMN_TYPES = "0-3(ID), 4(GEOMETRY), 10-29(scalars), 30(STRUCT), 31(MAP)";
var SUPPORTED_FIELD_TYPES = "10-29(scalars), 30(STRUCT), 31(MAP)";
function decodeString3(src, offset) {
  const length = decodeVarintInt32(src, offset, 1)[0];
  if (length === 0) {
    return "";
  }
  const start = offset.get();
  const end = start + length;
  const view = src.subarray(start, end);
  offset.add(length);
  return textDecoder.decode(view);
}
function columnToField(column) {
  const name = column.name;
  const nullable = column.nullable;
  return column.type === "scalarType" ? { type: "scalarField", scalarField: column.scalarType, name, nullable } : { type: "complexField", complexField: column.complexType, name, nullable };
}
function decodeField(src, offset) {
  const typeCode = decodeVarintInt32(src, offset, 1)[0] >>> 0;
  const base = typeCode >= ColumnTypeCode.SCALAR_BASE ? decodeColumnType(typeCode) : null;
  if (!base) {
    throw new Error(`Unsupported field type code ${typeCode}. Supported: ${SUPPORTED_FIELD_TYPES}`);
  }
  const column = { ...base, name: decodeString3(src, offset) };
  if (column.type === "complexType" && columnTypeHasChildren(typeCode)) {
    const complexCol = column.complexType;
    const childCount = decodeVarintInt32(src, offset, 1)[0] >>> 0;
    complexCol.children = new Array(childCount);
    for (let i = 0; i < childCount; i++) {
      complexCol.children[i] = decodeField(src, offset);
    }
  }
  return columnToField(column);
}
function decodeColumn(src, offset) {
  const typeCode = decodeVarintInt32(src, offset, 1)[0] >>> 0;
  const base = decodeColumnType(typeCode);
  if (!base) {
    throw new Error(`Unsupported column type code ${typeCode}. Supported: ${SUPPORTED_COLUMN_TYPES}`);
  }
  let name;
  if (columnTypeHasName(typeCode)) {
    name = decodeString3(src, offset);
  } else if (typeCode < ColumnTypeCode.GEOMETRY) {
    name = "id";
  } else if (typeCode === ColumnTypeCode.GEOMETRY) {
    name = "geometry";
  } else {
    throw new Error(`Unsupported column type code ${typeCode}. Supported: ${SUPPORTED_COLUMN_TYPES}`);
  }
  const column = { ...base, name };
  if (column.type === "complexType" && columnTypeHasChildren(typeCode)) {
    const childCount = decodeVarintInt32(src, offset, 1)[0] >>> 0;
    const complexCol = column.complexType;
    complexCol.children = new Array(childCount);
    for (let i = 0; i < childCount; i++) {
      complexCol.children[i] = decodeField(src, offset);
    }
  }
  return column;
}
function decodeEmbeddedTileSetMetadata(bytes, offset) {
  const meta = {};
  meta.featureTables = [];
  const table = {};
  table.name = decodeString3(bytes, offset);
  if (table.name.length === 0) {
    throw new Error("Missing layer name");
  }
  const extent = decodeVarintInt32(bytes, offset, 1)[0] >>> 0;
  const columnCount = decodeVarintInt32(bytes, offset, 1)[0] >>> 0;
  table.columns = new Array(columnCount);
  for (let j = 0; j < columnCount; j++) {
    table.columns[j] = decodeColumn(bytes, offset);
  }
  meta.featureTables.push(table);
  return [meta, extent];
}

// node_modules/@maplibre/mlt/dist/mltDecoder.js
function decodeTile(tile, geometryScaling, idWithinMaxSafeInteger = true) {
  const offset = new IntWrapper(0);
  const featureTables = [];
  while (offset.get() < tile.length) {
    const blockLength = decodeVarintInt32(tile, offset, 1)[0] >>> 0;
    const blockStart = offset.get();
    const blockEnd = blockStart + blockLength;
    if (blockEnd > tile.length) {
      throw new Error(`Block overruns tile: ${blockEnd} > ${tile.length}`);
    }
    const tag = decodeVarintInt32(tile, offset, 1)[0] >>> 0;
    if (tag !== 1 && tag !== 2) {
      offset.set(blockEnd);
      continue;
    }
    const [metadata, extent] = decodeEmbeddedTileSetMetadata(tile, offset);
    const featureTableMetadata = metadata.featureTables[0];
    let idVector = null;
    let geometryVector = null;
    const propertyVectors = [];
    let numFeatures = 0;
    for (const columnMetadata of featureTableMetadata.columns) {
      const columnName = columnMetadata.name;
      if (isLogicalIdColumn(columnMetadata)) {
        let nullabilityBuffer = null;
        if (columnMetadata.nullable) {
          const presentStreamMetadata = decodeStreamMetadata(tile, offset);
          const streamDataStart = offset.get();
          const values = decodeBooleanRle(tile, presentStreamMetadata.numValues, presentStreamMetadata.byteLength, offset);
          offset.set(streamDataStart + presentStreamMetadata.byteLength);
          nullabilityBuffer = new BitVector(values, presentStreamMetadata.numValues);
        }
        const idDataStreamMetadata = decodeStreamMetadata(tile, offset);
        numFeatures = nullabilityBuffer ? nullabilityBuffer.size() : idDataStreamMetadata.decompressedCount;
        idVector = decodeIdColumn(tile, columnMetadata, offset, columnName, idDataStreamMetadata, nullabilityBuffer ?? numFeatures, idWithinMaxSafeInteger);
      } else if (isGeometryColumn(columnMetadata)) {
        const numStreams = decodeVarintInt32(tile, offset, 1)[0];
        if (numFeatures === 0) {
          const savedOffset = offset.get();
          const geometryTypeMetadata = decodeStreamMetadata(tile, offset);
          numFeatures = geometryTypeMetadata.decompressedCount;
          offset.set(savedOffset);
        }
        if (geometryScaling) {
          geometryScaling.scale = geometryScaling.extent / extent;
        }
        geometryVector = decodeGeometryColumn(tile, numStreams, offset, numFeatures, geometryScaling);
      } else {
        const columnHasStreamCount = hasStreamCount(columnMetadata);
        const numStreams = columnHasStreamCount ? decodeVarintInt32(tile, offset, 1)[0] : 1;
        if (numStreams === 0) {
          continue;
        }
        const propertyVector = decodePropertyColumn(tile, offset, columnMetadata, numStreams, numFeatures, void 0);
        if (propertyVector) {
          if (Array.isArray(propertyVector)) {
            for (const property of propertyVector) {
              propertyVectors.push(property);
            }
          } else {
            propertyVectors.push(propertyVector);
          }
        }
      }
    }
    const featureTable = new FeatureTable(featureTableMetadata.name, geometryVector, idVector, propertyVectors, extent);
    featureTables.push(featureTable);
    offset.set(blockEnd);
  }
  return featureTables;
}
function decodeIdColumn(tile, columnMetadata, offset, columnName, idDataStreamMetadata, sizeOrNullabilityBuffer, idWithinMaxSafeInteger = false) {
  const idDataType = columnMetadata.scalarType?.longID ? ScalarType.UINT_64 : ScalarType.UINT_32;
  const nullabilityBuffer = typeof sizeOrNullabilityBuffer === "number" ? void 0 : sizeOrNullabilityBuffer;
  const vectorType = getVectorType(idDataStreamMetadata, sizeOrNullabilityBuffer, tile, offset, idDataType === ScalarType.UINT_64 ? "int64" : "int32");
  if (idDataType === ScalarType.UINT_32) {
    switch (vectorType) {
      case VectorType.FLAT: {
        const id = decodeUnsignedInt32Stream(tile, offset, idDataStreamMetadata, void 0, nullabilityBuffer);
        return new Int32FlatVector(columnName, id, sizeOrNullabilityBuffer);
      }
      case VectorType.SEQUENCE: {
        const id = decodeSequenceInt32Stream(tile, offset, idDataStreamMetadata);
        return new Int32SequenceVector(columnName, id[0], id[1], idDataStreamMetadata.numRleValues, false);
      }
      case VectorType.CONST: {
        const id = decodeUnsignedConstInt32Stream(tile, offset, idDataStreamMetadata);
        return new Int32ConstVector(columnName, id, sizeOrNullabilityBuffer, false);
      }
    }
  }
  switch (vectorType) {
    case VectorType.FLAT: {
      if (idWithinMaxSafeInteger) {
        const id2 = decodeUnsignedInt64AsFloat64Stream(tile, offset, idDataStreamMetadata, nullabilityBuffer);
        return new DoubleFlatVector(columnName, id2, sizeOrNullabilityBuffer);
      }
      const id = decodeUnsignedInt64Stream(tile, offset, idDataStreamMetadata, nullabilityBuffer);
      return new Int64FlatVector(columnName, id, sizeOrNullabilityBuffer);
    }
    case VectorType.SEQUENCE: {
      const id = decodeSequenceInt64Stream(tile, offset, idDataStreamMetadata);
      return new Int64SequenceVector(columnName, id[0], id[1], idDataStreamMetadata.numRleValues, false);
    }
    case VectorType.CONST: {
      const id = decodeUnsignedConstInt64Stream(tile, offset, idDataStreamMetadata);
      return new Int64ConstVector(columnName, id, sizeOrNullabilityBuffer, false);
    }
  }
  throw new Error("Vector type not supported for id column.");
}

// node_modules/@maplibre/mlt/dist/encoding/fastPforEncoder.js
var MAX_BIT_WIDTH2 = 32;
var BIT_WIDTH_SLOTS2 = MAX_BIT_WIDTH2 + 1;
var PAGE_SIZE2 = normalizePageSize(DEFAULT_PAGE_SIZE);
var INITIAL_PACKED_BUFFER_SIZE_WORDS = PAGE_SIZE2 / 32 * 4;
var BYTE_CONTAINER_SIZE2 = 3 * PAGE_SIZE2 / BLOCK_SIZE + PAGE_SIZE2 | 0;

// node_modules/@maplibre/mlt/dist/encoding/mapPropertyEncoder.js
var INT32_MIN = -(2 ** 31);
var INT32_MAX = 2 ** 31 - 1;
var UINT32_MAX = 2 ** 32 - 1;
var INT64_MAX = 2n ** 63n - 1n;

// node_modules/@maplibre/mlt/dist/encoding/mltEncoder.js
var INT32_MIN2 = -(2 ** 31);
var INT32_MAX2 = 2 ** 31 - 1;
var UINT32_MAX2 = 2 ** 32 - 1;
var INT64_MAX2 = 2n ** 63n - 1n;

// converter/mlt-convert.src.js
var import_vt_pbf = __toESM(require_vt_pbf(), 1);

// node_modules/@mapbox/vector-tile/index.js
var VectorTileFeature = class {
  /**
   * @param {Pbf} pbf
   * @param {number} end
   * @param {number} extent
   * @param {string[]} keys
   * @param {(number | string | boolean)[]} values
   */
  constructor(pbf, end, extent, keys, values) {
    this.properties = /* @__PURE__ */ Object.create(null);
    this.extent = extent;
    this.type = 0;
    this.id = void 0;
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 8) this.id = pbf.readVarint();
      else if (tag === 18) {
        const tagsEnd = pbf.readVarint() + pbf.pos;
        while (pbf.pos < tagsEnd) {
          const key = keys[pbf.readVarint()];
          const value = values[pbf.readVarint()];
          this.properties[key] = value;
        }
      } else if (tag === 24) this.type = /** @type {0 | 1 | 2 | 3} */
      pbf.readVarint();
      else if (tag === 34) {
        this._geometry = pbf.pos;
        pbf.skip(tag);
      } else pbf.skip(tag);
    }
  }
  loadGeometry() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    const lines = [];
    let line;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (line) lines.push(line);
        line = [new Point(x, y)];
      } else if (cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (line) line.push(new Point(x, y));
      } else if (cmd === 7) {
        if (line) {
          line.push(line[0].clone());
        }
      } else {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  bbox() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1, length = 0, x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1 || cmd === 2) {
        x += pbf.readSVarint();
        y += pbf.readSVarint();
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      } else if (cmd !== 7) {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    return [x1, y1, x2, y2];
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {Feature}
   */
  toGeoJSON(x, y, z) {
    const size = this.extent * Math.pow(2, z), x0 = this.extent * x, y0 = this.extent * y, vtCoords = this.loadGeometry();
    function projectPoint(p) {
      return [
        (p.x + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
      ];
    }
    function projectLine(line) {
      return line.map(projectPoint);
    }
    let geometry;
    if (this.type === 1) {
      const points = [];
      for (const line of vtCoords) {
        points.push(line[0]);
      }
      const coordinates = projectLine(points);
      geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
    } else if (this.type === 2) {
      const coordinates = vtCoords.map(projectLine);
      geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
    } else if (this.type === 3) {
      const polygons = classifyRings(vtCoords);
      const coordinates = [];
      for (const polygon of polygons) {
        coordinates.push(polygon.map(projectLine));
      }
      geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
    } else {
      throw new Error("unknown feature type");
    }
    const result = {
      type: "Feature",
      geometry,
      properties: this.properties
    };
    if (this.id != null) {
      result.id = this.id;
    }
    return result;
  }
};
VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
function classifyRings(rings) {
  const len = rings.length;
  if (len <= 1) return [rings];
  const polygons = [];
  let polygon, ccw;
  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;
    if (ccw === void 0) ccw = area < 0;
    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else if (polygon) {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);
  return polygons;
}
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}
var VectorTileLayer = class {
  /**
   * @param {Pbf} pbf
   * @param {number} [end]
   */
  constructor(pbf, end) {
    this.version = 1;
    this.name = "";
    this.extent = 4096;
    this.length = 0;
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];
    if (end === void 0) end = pbf.length;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 10) this.name = pbf.readString();
      else if (tag === 18) {
        this._features.push(pbf.pos);
        pbf.skip(tag);
      } else if (tag === 26) this._keys.push(pbf.readString());
      else if (tag === 34) this._values.push(readValueMessage(pbf));
      else if (tag === 40) this.extent = pbf.readVarint();
      else if (tag === 120) this.version = pbf.readVarint();
      else pbf.skip(tag);
    }
    this.length = this._features.length;
  }
  /** return feature `i` from this layer as a `VectorTileFeature`
   * @param {number} i
   */
  feature(i) {
    if (i < 0 || i >= this._features.length) throw new Error("feature index out of bounds");
    this._pbf.pos = this._features[i];
    const end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
  }
};
function readValueMessage(pbf) {
  let value = null;
  const end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    const tag = pbf.readVarint();
    value = tag === 10 ? pbf.readString() : tag === 21 ? pbf.readFloat() : tag === 25 ? pbf.readDouble() : tag === 32 ? pbf.readVarint64() : tag === 40 ? pbf.readVarint() : tag === 48 ? pbf.readSVarint() : tag === 56 ? pbf.readBoolean() : (pbf.skip(tag), null);
  }
  if (value == null) {
    throw new Error("unknown feature value");
  }
  return value;
}
var VectorTile = class {
  /**
   * @param {Pbf} pbf
   * @param {number} [end]
   */
  constructor(pbf, end = pbf.length) {
    const layers = /* @__PURE__ */ Object.create(null);
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 26) {
        const layer = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
        if (layer.length) layers[layer.name] = layer;
      } else pbf.skip(tag);
    }
    this.layers = layers;
  }
};

// node_modules/pbf/index.js
var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
var TEXT_DECODER_MIN_LENGTH2 = 12;
var utf8TextDecoder2 = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");
var PBF_VARINT = 0;
var PBF_FIXED64 = 1;
var PBF_BYTES = 2;
var PBF_FIXED32 = 5;
var Pbf = class {
  /**
   * @param {Uint8Array | ArrayBuffer} [buf]
   */
  constructor(buf = new Uint8Array(16)) {
    this.buf = ArrayBuffer.isView(buf) ? buf : new Uint8Array(buf);
    this.dataView = new DataView(this.buf.buffer);
    this.pos = 0;
    this.type = 0;
    this.length = this.buf.length;
  }
  // === READING =================================================================
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   * @param {number} [end]
   */
  readFields(readField, result, end = this.length) {
    while (this.pos < end) {
      const val = this.readVarint(), tag = val >> 3, startPos = this.pos;
      this.type = val & 7;
      readField(tag, result, this);
      if (this.pos === startPos) this.skip(val);
    }
    return result;
  }
  /**
   * @template T
   * @param {(tag: number, result: T, pbf: Pbf) => void} readField
   * @param {T} result
   */
  readMessage(readField, result) {
    return this.readFields(readField, result, this.readVarint() + this.pos);
  }
  readFixed32() {
    const val = this.dataView.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readSFixed32() {
    const val = this.dataView.getInt32(this.pos, true);
    this.pos += 4;
    return val;
  }
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getUint32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readSFixed64() {
    const val = this.dataView.getUint32(this.pos, true) + this.dataView.getInt32(this.pos + 4, true) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }
  readFloat() {
    const val = this.dataView.getFloat32(this.pos, true);
    this.pos += 4;
    return val;
  }
  readDouble() {
    const val = this.dataView.getFloat64(this.pos, true);
    this.pos += 8;
    return val;
  }
  /**
   * @param {boolean} [isSigned]
   */
  readVarint(isSigned) {
    const buf = this.buf;
    let val, b;
    b = buf[this.pos++];
    val = b & 127;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 7;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 14;
    if (b < 128) return val;
    b = buf[this.pos++];
    val |= (b & 127) << 21;
    if (b < 128) return val;
    b = buf[this.pos];
    val |= (b & 15) << 28;
    return readVarintRemainder(val, isSigned, this);
  }
  readVarint64() {
    return this.readVarint(true);
  }
  readSVarint() {
    const num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2;
  }
  readBoolean() {
    return Boolean(this.readVarint());
  }
  readString() {
    const end = this.readVarint() + this.pos;
    const pos = this.pos;
    this.pos = end;
    if (end - pos >= TEXT_DECODER_MIN_LENGTH2 && utf8TextDecoder2) {
      return utf8TextDecoder2.decode(this.buf.subarray(pos, end));
    }
    return readUtf82(this.buf, pos, end);
  }
  readBytes() {
    const end = this.readVarint() + this.pos, buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  }
  // verbose for performance reasons; doesn't affect gzipped size
  /**
   * @param {number[]} [arr]
   * @param {boolean} [isSigned]
   */
  readPackedVarint(arr = [], isSigned) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readVarint(isSigned));
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSVarint(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSVarint());
    return arr;
  }
  /** @param {boolean[]} [arr] */
  readPackedBoolean(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readBoolean());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFloat(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFloat());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedDouble(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readDouble());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed32(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed32());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readFixed64());
    return arr;
  }
  /** @param {number[]} [arr] */
  readPackedSFixed64(arr = []) {
    const end = this.readPackedEnd();
    while (this.pos < end) arr.push(this.readSFixed64());
    return arr;
  }
  readPackedEnd() {
    return this.type === PBF_BYTES ? this.readVarint() + this.pos : this.pos + 1;
  }
  /** @param {number} val */
  skip(val) {
    const type = val & 7;
    if (type === PBF_VARINT) while (this.buf[this.pos++] > 127) {
    }
    else if (type === PBF_BYTES) this.pos = this.readVarint() + this.pos;
    else if (type === PBF_FIXED32) this.pos += 4;
    else if (type === PBF_FIXED64) this.pos += 8;
    else throw new Error(`Unimplemented type: ${type}`);
  }
  // === WRITING =================================================================
  /**
   * @param {number} tag
   * @param {number} type
   */
  writeTag(tag, type) {
    this.writeVarint(tag << 3 | type);
  }
  /** @param {number} min */
  realloc(min) {
    let length = this.length || 16;
    while (length < this.pos + min) length *= 2;
    if (length !== this.length) {
      const buf = new Uint8Array(length);
      buf.set(this.buf);
      this.buf = buf;
      this.dataView = new DataView(buf.buffer);
      this.length = length;
    }
  }
  finish() {
    this.length = this.pos;
    this.pos = 0;
    return this.buf.subarray(0, this.length);
  }
  /** @param {number} val */
  writeFixed32(val) {
    this.realloc(4);
    this.dataView.setInt32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeSFixed32(val) {
    this.realloc(4);
    this.dataView.setInt32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeFixed64(val) {
    this.realloc(8);
    this.dataView.setInt32(this.pos, val & -1, true);
    this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
    this.pos += 8;
  }
  /** @param {number} val */
  writeSFixed64(val) {
    this.realloc(8);
    this.dataView.setInt32(this.pos, val & -1, true);
    this.dataView.setInt32(this.pos + 4, Math.floor(val * SHIFT_RIGHT_32), true);
    this.pos += 8;
  }
  /** @param {number} val */
  writeVarint(val) {
    val = +val || 0;
    if (val > 268435455 || val < 0) {
      writeBigVarint(val, this);
      return;
    }
    this.realloc(4);
    this.buf[this.pos++] = val & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = (val >>>= 7) & 127 | (val > 127 ? 128 : 0);
    if (val <= 127) return;
    this.buf[this.pos++] = val >>> 7 & 127;
  }
  /** @param {number} val */
  writeSVarint(val) {
    this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
  }
  /** @param {boolean} val */
  writeBoolean(val) {
    this.writeVarint(+val);
  }
  /** @param {string} str */
  writeString(str) {
    str = String(str);
    this.realloc(str.length * 4);
    this.pos++;
    const startPos = this.pos;
    this.pos = writeUtf8(this.buf, str, this.pos);
    const len = this.pos - startPos;
    if (len >= 128) makeRoomForExtraLength(startPos, len, this);
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }
  /** @param {number} val */
  writeFloat(val) {
    this.realloc(4);
    this.dataView.setFloat32(this.pos, val, true);
    this.pos += 4;
  }
  /** @param {number} val */
  writeDouble(val) {
    this.realloc(8);
    this.dataView.setFloat64(this.pos, val, true);
    this.pos += 8;
  }
  /** @param {Uint8Array} buffer */
  writeBytes(buffer) {
    const len = buffer.length;
    this.writeVarint(len);
    this.realloc(len);
    for (let i = 0; i < len; i++) this.buf[this.pos++] = buffer[i];
  }
  /**
   * @template T
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeRawMessage(fn, obj) {
    this.pos++;
    const startPos = this.pos;
    fn(obj, this);
    const len = this.pos - startPos;
    if (len >= 128) makeRoomForExtraLength(startPos, len, this);
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }
  /**
   * @template T
   * @param {number} tag
   * @param {(obj: T, pbf: Pbf) => void} fn
   * @param {T} obj
   */
  writeMessage(tag, fn, obj) {
    this.writeTag(tag, PBF_BYTES);
    this.writeRawMessage(fn, obj);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedVarint(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedVarint, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSVarint(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSVarint, arr);
  }
  /**
   * @param {number} tag
   * @param {boolean[]} arr
   */
  writePackedBoolean(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedBoolean, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFloat(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFloat, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedDouble(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedDouble, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed32(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFixed32, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed32(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSFixed32, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedFixed64(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedFixed64, arr);
  }
  /**
   * @param {number} tag
   * @param {number[]} arr
   */
  writePackedSFixed64(tag, arr) {
    if (arr.length) this.writeMessage(tag, writePackedSFixed64, arr);
  }
  /**
   * @param {number} tag
   * @param {Uint8Array} buffer
   */
  writeBytesField(tag, buffer) {
    this.writeTag(tag, PBF_BYTES);
    this.writeBytes(buffer);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed32Field(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeFixed32(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed32Field(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeSFixed32(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFixed64Field(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeFixed64(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSFixed64Field(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeSFixed64(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeVarintField(tag, val) {
    this.writeTag(tag, PBF_VARINT);
    this.writeVarint(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeSVarintField(tag, val) {
    this.writeTag(tag, PBF_VARINT);
    this.writeSVarint(val);
  }
  /**
   * @param {number} tag
   * @param {string} str
   */
  writeStringField(tag, str) {
    this.writeTag(tag, PBF_BYTES);
    this.writeString(str);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeFloatField(tag, val) {
    this.writeTag(tag, PBF_FIXED32);
    this.writeFloat(val);
  }
  /**
   * @param {number} tag
   * @param {number} val
   */
  writeDoubleField(tag, val) {
    this.writeTag(tag, PBF_FIXED64);
    this.writeDouble(val);
  }
  /**
   * @param {number} tag
   * @param {boolean} val
   */
  writeBooleanField(tag, val) {
    this.writeVarintField(tag, +val);
  }
};
function readVarintRemainder(l, s, p) {
  const buf = p.buf;
  let h, b;
  b = buf[p.pos++];
  h = (b & 112) >> 4;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 3;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 10;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 17;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 127) << 24;
  if (b < 128) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 1) << 31;
  if (b < 128) return toNum(l, h, s);
  throw new Error("Expected varint not more than 10 bytes");
}
function toNum(low, high, isSigned) {
  return isSigned ? high * 4294967296 + (low >>> 0) : (high >>> 0) * 4294967296 + (low >>> 0);
}
function writeBigVarint(val, pbf) {
  let low, high;
  if (val >= 0) {
    low = val % 4294967296 | 0;
    high = val / 4294967296 | 0;
  } else {
    low = ~(-val % 4294967296);
    high = ~(-val / 4294967296);
    if (low ^ 4294967295) {
      low = low + 1 | 0;
    } else {
      low = 0;
      high = high + 1 | 0;
    }
  }
  if (val >= 18446744073709552e3 || val < -18446744073709552e3) {
    throw new Error("Given varint doesn't fit into 10 bytes");
  }
  pbf.realloc(10);
  writeBigVarintLow(low, high, pbf);
  writeBigVarintHigh(high, pbf);
}
function writeBigVarintLow(low, high, pbf) {
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos++] = low & 127 | 128;
  low >>>= 7;
  pbf.buf[pbf.pos] = low & 127;
}
function writeBigVarintHigh(high, pbf) {
  const lsb = (high & 7) << 4;
  pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127 | ((high >>>= 7) ? 128 : 0);
  if (!high) return;
  pbf.buf[pbf.pos++] = high & 127;
}
function makeRoomForExtraLength(startPos, len, pbf) {
  const extraLen = len <= 16383 ? 1 : len <= 2097151 ? 2 : len <= 268435455 ? 3 : Math.floor(Math.log(len) / (Math.LN2 * 7));
  pbf.realloc(extraLen);
  for (let i = pbf.pos - 1; i >= startPos; i--) pbf.buf[i + extraLen] = pbf.buf[i];
}
function writePackedVarint(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
function writePackedSVarint(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
function writePackedFloat(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
function writePackedDouble(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
function writePackedBoolean(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
function writePackedFixed32(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
function writePackedSFixed32(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
function writePackedFixed64(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
function writePackedSFixed64(arr, pbf) {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}
function readUtf82(buf, pos, end) {
  let str = "";
  let i = pos;
  while (i < end) {
    const b0 = buf[i];
    let c = null;
    let bytesPerSequence = b0 > 239 ? 4 : b0 > 223 ? 3 : b0 > 191 ? 2 : 1;
    if (i + bytesPerSequence > end) break;
    let b1, b2, b3;
    if (bytesPerSequence === 1) {
      if (b0 < 128) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 192) === 128) {
        c = (b0 & 31) << 6 | b1 & 63;
        if (c <= 127) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 192) === 128 && (b2 & 192) === 128) {
        c = (b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63;
        if (c <= 2047 || c >= 55296 && c <= 57343) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if ((b1 & 192) === 128 && (b2 & 192) === 128 && (b3 & 192) === 128) {
        c = (b0 & 15) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        if (c <= 65535 || c >= 1114112) {
          c = null;
        }
      }
    }
    if (c === null) {
      c = 65533;
      bytesPerSequence = 1;
    } else if (c > 65535) {
      c -= 65536;
      str += String.fromCharCode(c >>> 10 & 1023 | 55296);
      c = 56320 | c & 1023;
    }
    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }
  return str;
}
function writeUtf8(buf, str, pos) {
  for (let i = 0, c, lead; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c > 55295 && c < 57344) {
      if (lead) {
        if (c < 56320) {
          buf[pos++] = 239;
          buf[pos++] = 191;
          buf[pos++] = 189;
          lead = c;
          continue;
        } else {
          c = lead - 55296 << 10 | c - 56320 | 65536;
          lead = null;
        }
      } else {
        if (c > 56319 || i + 1 === str.length) {
          buf[pos++] = 239;
          buf[pos++] = 191;
          buf[pos++] = 189;
        } else {
          lead = c;
        }
        continue;
      }
    } else if (lead) {
      buf[pos++] = 239;
      buf[pos++] = 191;
      buf[pos++] = 189;
      lead = null;
    }
    if (c < 128) {
      buf[pos++] = c;
    } else {
      if (c < 2048) {
        buf[pos++] = c >> 6 | 192;
      } else {
        if (c < 65536) {
          buf[pos++] = c >> 12 | 224;
        } else {
          buf[pos++] = c >> 18 | 240;
          buf[pos++] = c >> 12 & 63 | 128;
        }
        buf[pos++] = c >> 6 & 63 | 128;
      }
      buf[pos++] = c & 63 | 128;
    }
  }
  return pos;
}

// converter/mlt-convert.src.js
var MVT_TYPE = { 0: 1, 1: 2, 2: 3, 3: 1, 4: 2, 5: 3 };
function mvtValue(value) {
  if (value === null || value === void 0) return void 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  try {
    return JSON.stringify(value, (_key, inner) => typeof inner === "bigint" ? Number(inner) : inner);
  } catch {
    return void 0;
  }
}
function mvtId(id) {
  if (id === void 0 || id === null) return void 0;
  const number = typeof id === "bigint" ? Number(id) : id;
  return Number.isSafeInteger(number) && number >= 0 ? number : void 0;
}
function looksLikeMvt(bytes) {
  return !bytes || bytes.length === 0 || bytes[0] === 26;
}
function mltToMvt(bytes) {
  const tables = decodeTile(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const layers = {};
  for (const table of tables) {
    const features = table.getFeatures().map((feature) => {
      const properties = {};
      for (const [key, value] of Object.entries(feature.properties || {})) {
        const converted = mvtValue(value);
        if (converted !== void 0) properties[key] = converted;
      }
      const rings = feature.geometry.coordinates.map((ring) => ring.map((point) => ({ x: point.x, y: point.y })));
      return {
        id: mvtId(feature.id),
        type: MVT_TYPE[feature.geometry.type] ?? 1,
        properties,
        loadGeometry: () => rings
      };
    });
    layers[table.name] = {
      name: table.name,
      version: 2,
      extent: table.extent || 4096,
      length: features.length,
      feature: (index) => features[index]
    };
  }
  return Buffer.from(import_vt_pbf.default.fromVectorTileJs({ layers }));
}
var TARGET_EXTENT = 4096;
var MARGIN = 256;
function composeTile(parts) {
  const merged = /* @__PURE__ */ new Map();
  for (const part of parts) {
    let tile;
    try {
      tile = new VectorTile(new Pbf(part.bytes));
    } catch {
      continue;
    }
    for (const [name, layer] of Object.entries(tile.layers)) {
      const norm = TARGET_EXTENT / (layer.extent || TARGET_EXTENT);
      const scale = part.scale * norm;
      let out = merged.get(name);
      if (!out) {
        out = [];
        merged.set(name, out);
      }
      for (let i = 0; i < layer.length; i += 1) {
        const feature = layer.feature(i);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const rings = feature.loadGeometry().map((ring) => ring.map((point) => {
          const x = Math.round(point.x * scale + part.dx);
          const y = Math.round(point.y * scale + part.dy);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          return { x, y };
        }));
        if (maxX < -MARGIN || maxY < -MARGIN || minX > TARGET_EXTENT + MARGIN || minY > TARGET_EXTENT + MARGIN) continue;
        out.push({
          id: feature.id,
          type: feature.type,
          properties: { ...feature.properties },
          loadGeometry: () => rings
        });
      }
    }
  }
  const layers = {};
  for (const [name, features] of merged) {
    if (!features.length) continue;
    layers[name] = { name, version: 2, extent: TARGET_EXTENT, length: features.length, feature: (index) => features[index] };
  }
  if (!Object.keys(layers).length) return null;
  return Buffer.from(import_vt_pbf.default.fromVectorTileJs({ layers }));
}
function summarizeMvt(bytes) {
  if (!bytes || !bytes.length) return {};
  try {
    const tile = new VectorTile(new Pbf(bytes));
    const counts = {};
    for (const [name, layer] of Object.entries(tile.layers)) counts[name] = layer.length;
    return counts;
  } catch {
    return null;
  }
}
export {
  composeTile,
  looksLikeMvt,
  mltToMvt,
  summarizeMvt
};
