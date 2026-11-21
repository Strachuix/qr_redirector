"use strict";

(function () {
  const BLOCKS = {
    L: [
      [[1, 26, 19]], [[1, 44, 34]], [[1, 70, 55]], [[1, 100, 80]], [[1, 134, 108]],
      [[2, 86, 68]], [[2, 98, 78]], [[2, 121, 97]], [[2, 146, 116]], [[2, 86, 68], [2, 87, 69]]
    ],
    M: [
      [[1, 26, 16]], [[1, 44, 28]], [[1, 70, 44]], [[2, 50, 32]], [[2, 67, 43]],
      [[4, 43, 27]], [[4, 49, 31]], [[2, 60, 38], [2, 61, 39]], [[3, 58, 36], [2, 59, 37]],
      [[4, 69, 43], [1, 70, 44]]
    ],
    Q: [
      [[1, 26, 13]], [[1, 44, 22]], [[2, 35, 17]], [[2, 50, 24]], [[2, 33, 15], [2, 34, 16]],
      [[4, 43, 19]], [[2, 32, 14], [4, 33, 15]], [[4, 40, 18], [2, 41, 19]],
      [[4, 36, 16], [4, 37, 17]], [[6, 43, 19], [2, 44, 20]]
    ],
    H: [
      [[1, 26, 9]], [[1, 44, 16]], [[2, 35, 13]], [[4, 25, 9]], [[2, 33, 11], [2, 34, 12]],
      [[4, 43, 15], [1, 44, 16]], [[4, 39, 13], [1, 40, 14]], [[4, 40, 14], [2, 41, 15]],
      [[4, 36, 12], [4, 37, 13]], [[6, 43, 15], [2, 44, 16]]
    ]
  };
  const ALIGNMENT = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function appendBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) {
      bits.push((value >>> i) & 1);
    }
  }

  function makeData(bytes, version, level) {
    const blocks = BLOCKS[level][version - 1].flatMap(([count, total, data]) =>
      Array.from({ length: count }, () => ({ total, data }))
    );
    const dataCapacity = blocks.reduce((sum, block) => sum + block.data, 0);
    const bits = [];
    appendBits(bits, 0b0100, 4);
    appendBits(bits, bytes.length, version < 10 ? 8 : 16);
    for (const byte of bytes) appendBits(bits, byte, 8);

    const capacityBits = dataCapacity * 8;
    appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
    while (bits.length % 8) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    for (let pad = 0xec; data.length < dataCapacity; pad ^= 0xec ^ 0x11) data.push(pad);

    const divisorCache = new Map();
    const gfMultiply = (x, y) => {
      let result = 0;
      for (let i = 7; i >= 0; i -= 1) {
        result = (result << 1) ^ ((result >>> 7) * 0x11d);
        result ^= ((y >>> i) & 1) * x;
      }
      return result;
    };
    const divisor = degree => {
      if (divisorCache.has(degree)) return divisorCache.get(degree);
      const result = Array(degree).fill(0);
      result[degree - 1] = 1;
      let root = 1;
      for (let i = 0; i < degree; i += 1) {
        for (let j = 0; j < result.length; j += 1) {
          result[j] = gfMultiply(result[j], root);
          if (j + 1 < result.length) result[j] ^= result[j + 1];
        }
        root = gfMultiply(root, 2);
      }
      divisorCache.set(degree, result);
      return result;
    };
    const remainder = (message, degree) => {
      const polynomial = divisor(degree);
      const result = Array(degree).fill(0);
      for (const byte of message) {
        const factor = byte ^ result.shift();
        result.push(0);
        for (let i = 0; i < degree; i += 1) result[i] ^= gfMultiply(polynomial[i], factor);
      }
      return result;
    };

    const dataBlocks = [];
    const errorBlocks = [];
    let offset = 0;
    for (const block of blocks) {
      const blockData = data.slice(offset, offset + block.data);
      offset += block.data;
      dataBlocks.push(blockData);
      errorBlocks.push(remainder(blockData, block.total - block.data));
    }

    const interleaved = [];
    const maxData = Math.max(...dataBlocks.map(block => block.length));
    const maxError = Math.max(...errorBlocks.map(block => block.length));
    for (let i = 0; i < maxData; i += 1) {
      for (const block of dataBlocks) if (i < block.length) interleaved.push(block[i]);
    }
    for (let i = 0; i < maxError; i += 1) {
      for (const block of errorBlocks) if (i < block.length) interleaved.push(block[i]);
    }
    return interleaved;
  }

  function makeMatrix(codewords, version, level) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const functions = Array.from({ length: size }, () => Array(size).fill(false));
    const setFunction = (x, y, dark) => {
      modules[y][x] = dark;
      functions[y][x] = true;
    };

    const finder = (centerX, centerY) => {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const distance = Math.max(Math.abs(dx), Math.abs(dy));
            setFunction(x, y, distance !== 2 && distance !== 4);
          }
        }
      }
    };

    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    for (let i = 0; i < size; i += 1) {
      if (!functions[6][i]) setFunction(i, 6, i % 2 === 0);
      if (!functions[i][6]) setFunction(6, i, i % 2 === 0);
    }

    for (const y of ALIGNMENT[version - 1]) {
      for (const x of ALIGNMENT[version - 1]) {
        if ((x === 6 && y === 6) || (x === size - 7 && y === 6) || (x === 6 && y === size - 7)) continue;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    const bch = (value, polynomial) => {
      let result = value;
      const degree = polynomial === 0x537 ? 10 : 12;
      while (result >>> degree) {
        result ^= polynomial << (31 - Math.clz32(result));
      }
      return result;
    };

    const format = (mask) => {
      const data = (ECL_BITS[level] << 3) | mask;
      const bits = ((data << 10) | bch(data << 10, 0x537)) ^ 0x5412;
      const bit = index => ((bits >>> index) & 1) !== 0;
      for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
      setFunction(8, 7, bit(6));
      setFunction(8, 8, bit(7));
      setFunction(7, 8, bit(8));
      for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, bit(i));
      setFunction(8, size - 8, true);
    };

    if (version >= 7) {
      const versionBits = (version << 12) | bch(version << 12, 0x1f25);
      for (let i = 0; i < 18; i += 1) {
        const dark = ((versionBits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunction(a, b, dark);
        setFunction(b, a, dark);
      }
    }

    format(0);
    let bitIndex = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        const y = upward ? size - 1 - vertical : vertical;
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          if (functions[y][x]) continue;
          const byte = codewords[bitIndex >>> 3] || 0;
          modules[y][x] = ((byte >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
        }
      }
      upward = !upward;
    }

    const maskCondition = (mask, x, y) => {
      switch (mask) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
        case 5: return (x * y) % 2 + (x * y) % 3 === 0;
        case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
        default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      }
    };

    const score = matrix => {
      let penalty = 0;
      const lines = [...matrix, ...matrix.map((_, x) => matrix.map(row => row[x]))];
      for (const line of lines) {
        let runColor = line[0];
        let runLength = 1;
        for (let i = 1; i <= line.length; i += 1) {
          if (i < line.length && line[i] === runColor) {
            runLength += 1;
          } else {
            if (runLength >= 5) penalty += 3 + runLength - 5;
            runColor = line[i];
            runLength = 1;
          }
        }
        for (let i = 0; i <= line.length - 11; i += 1) {
          const sequence = line.slice(i, i + 11).map(value => value ? "1" : "0").join("");
          if (sequence === "00001011101" || sequence === "10111010000") penalty += 40;
        }
      }
      for (let y = 0; y < size - 1; y += 1) {
        for (let x = 0; x < size - 1; x += 1) {
          const color = matrix[y][x];
          if (matrix[y][x + 1] === color && matrix[y + 1][x] === color && matrix[y + 1][x + 1] === color) penalty += 3;
        }
      }
      const dark = matrix.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
      penalty += Math.floor(Math.abs((dark * 100 / (size * size)) - 50) / 5) * 10;
      return penalty;
    };

    let bestMatrix;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
      const candidate = modules.map(row => row.slice());
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (!functions[y][x] && maskCondition(mask, x, y)) candidate[y][x] = !candidate[y][x];
        }
      }
      format(mask);
      const result = candidate.map(row => row.slice());
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (functions[y][x]) result[y][x] = modules[y][x];
        }
      }
      const candidateScore = score(result);
      if (candidateScore < bestScore) {
        bestScore = candidateScore;
        bestMatrix = result;
      }
    }

    return bestMatrix;
  }

  function encode(text, level) {
    if (typeof text !== "string" || !text.length) throw new Error("Tekst kodu QR nie może być pusty.");
    if (!Object.hasOwn(BLOCKS, level)) throw new Error("Nieobsługiwany poziom korekcji błędów.");
    const bytes = Array.from(new TextEncoder().encode(text));
    let version = 0;
    for (let candidate = 1; candidate <= 10; candidate += 1) {
      const blocks = BLOCKS[level][candidate - 1].flatMap(([count, total, data]) =>
        Array.from({ length: count }, () => ({ total, data }))
      );
      const capacity = blocks.reduce((sum, block) => sum + block.data, 0) * 8;
      if (4 + (candidate < 10 ? 8 : 16) + bytes.length * 8 <= capacity) {
        version = candidate;
        break;
      }
    }
    if (!version) throw new Error("Adres jest zbyt długi dla generatora QR (maksymalnie wersja 10).");
    return makeMatrix(makeData(bytes, version, level), version, level);
  }

  window.QRCodeEncoder = Object.freeze({ encode });
})();
