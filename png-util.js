const PNGUtil = (() => {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function readUint32BE(data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  }

  function writeUint32BE(val) {
    return [(val >>> 24) & 0xFF, (val >>> 16) & 0xFF, (val >>> 8) & 0xFF, val & 0xFF];
  }

  function parseChunks(data) {
    const sig = data.slice(0, 8);
    const chunks = [];
    let pos = 8;
    while (pos < data.length - 12) {
      const len = readUint32BE(data, pos);
      const name = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
      const chunkData = data.slice(pos + 8, pos + 8 + len);
      const crc = readUint32BE(data, pos + 8 + len);
      chunks.push({ name, data: chunkData, crc });
      pos += 12 + len;
      if (name === 'IEND') break;
    }
    return { sig, chunks };
  }

  function buildChunk(name, data) {
    const nameBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) nameBytes[i] = name.charCodeAt(i);
    const lenBytes = writeUint32BE(data.length);
    const crcInput = new Uint8Array(nameBytes.length + data.length);
    crcInput.set(nameBytes, 0);
    crcInput.set(data, nameBytes.length);
    const crcVal = crc32(crcInput);
    const crcBytes = writeUint32BE(crcVal);
    const result = new Uint8Array(12 + data.length);
    result.set(lenBytes, 0);
    result.set(nameBytes, 4);
    result.set(data, 8);
    result.set(crcBytes, 8 + data.length);
    return result;
  }

  function buildPNG(parsed) {
    const parts = [parsed.sig];
    for (const chunk of parsed.chunks) {
      parts.push(buildChunk(chunk.name, chunk.data));
    }
    const totalLen = parts.reduce((s, p) => s + p.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }

  function findIENDIndex(chunks) {
    return chunks.findIndex(c => c.name === 'IEND');
  }

  return {
    readCharacterFromPNG(arrayBuffer) {
      const data = new Uint8Array(arrayBuffer);
      const { chunks } = parseChunks(data);
      const textChunks = chunks
        .filter(c => c.name === 'tEXt' || c.name === 'iTXt')
        .map(c => {
          const d = c.data;
          let i = 0;
          let key = '';
          while (i < d.length && d[i] !== 0) key += String.fromCharCode(d[i++]);
          i++;
          let value = '';
          while (i < d.length) value += String.fromCharCode(d[i++]);
          return { keyword: key.toLowerCase(), text: value };
        });

      const ccv3 = textChunks.find(c => c.keyword === 'ccv3');
      if (ccv3) return JSON.parse(atob(ccv3.text));

      const chara = textChunks.find(c => c.keyword === 'chara');
      if (chara) return JSON.parse(atob(chara.text));

      throw new Error('No character metadata found in PNG');
    },

    writeCharacterToPNG(imageBuffer, characterData) {
      const data = new Uint8Array(imageBuffer);
      const parsed = parseChunks(data);

      parsed.chunks = parsed.chunks.filter(c => {
        if (c.name !== 'tEXt' && c.name !== 'iTXt') return true;
        const d = c.data;
        let i = 0;
        let key = '';
        while (i < d.length && d[i] !== 0) key += String.fromCharCode(d[i++]);
        const k = key.toLowerCase();
        return k !== 'chara' && k !== 'ccv3';
      });

      const charaJson = typeof characterData === 'string' ? characterData : JSON.stringify(characterData);
      const charaB64 = btoa(unescape(encodeURIComponent(charaJson)));
      const charaPayload = new Uint8Array(charaB64.length);
      for (let i = 0; i < charaB64.length; i++) charaPayload[i] = charaB64.charCodeAt(i);

      const charaChunk = buildChunk('chara', charaPayload);

      let ccv3Payload = null;
      try {
        const v3Data = JSON.parse(charaJson);
        v3Data.spec = 'chara_card_v3';
        v3Data.spec_version = '3.0';
        const v3Json = JSON.stringify(v3Data);
        const v3B64 = btoa(unescape(encodeURIComponent(v3Json)));
        ccv3Payload = new Uint8Array(v3B64.length);
        for (let i = 0; i < v3B64.length; i++) ccv3Payload[i] = v3B64.charCodeAt(i);
      } catch (e) { /* ignore */ }

      const iendIdx = findIENDIndex(parsed.chunks);
      if (iendIdx === -1) throw new Error('Invalid PNG: no IEND chunk');

      const textChunks = [charaChunk];
      if (ccv3Payload) textChunks.push(buildChunk('ccv3', ccv3Payload));

      const before = parsed.chunks.slice(0, iendIdx);
      const after = parsed.chunks.slice(iendIdx);
      parsed.chunks = [...before, ...textChunks.map(raw => {
        const len = readUint32BE(raw, 0);
        const name = String.fromCharCode(raw[4], raw[5], raw[6], raw[7]);
        const chunkData = raw.slice(8, 8 + len);
        return { name, data: chunkData };
      }), ...after];

      return buildPNG(parsed).buffer;
    },

    createPNGWithCharacter(characterData, width = 256, height = 256) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1a1520');
      gradient.addColorStop(1, '#2a2333');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const letter = (characterData.data?.name || characterData.name || '?')[0].toUpperCase();
      ctx.fillStyle = '#c89b3c';
      ctx.font = 'bold 96px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, width / 2, height / 2);

      return new Promise(resolve => {
        canvas.toBlob(blob => {
          const reader = new FileReader();
          reader.onload = () => {
            const charaJson = JSON.stringify(characterData);
            const charaB64 = btoa(unescape(encodeURIComponent(charaJson)));

            const data = new Uint8Array(reader.result);
            const parsed = parseChunks(data);

            const charaPayload = new Uint8Array(charaB64.length);
            for (let i = 0; i < charaB64.length; i++) charaPayload[i] = charaB64.charCodeAt(i);
            const charaChunk = { name: 'chara', data: charaPayload };

            let ccv3Chunk = null;
            try {
              const v3Data = JSON.parse(charaJson);
              v3Data.spec = 'chara_card_v3';
              v3Data.spec_version = '3.0';
              const v3B64 = btoa(unescape(encodeURIComponent(JSON.stringify(v3Data))));
              const v3Payload = new Uint8Array(v3B64.length);
              for (let i = 0; i < v3B64.length; i++) v3Payload[i] = v3B64.charCodeAt(i);
              ccv3Chunk = { name: 'ccv3', data: v3Payload };
            } catch (e) { /* ignore */ }

            const iendIdx = findIENDIndex(parsed.chunks);
            const insertChunks = ccv3Chunk ? [charaChunk, ccv3Chunk] : [charaChunk];
            const before = parsed.chunks.slice(0, iendIdx);
            const after = parsed.chunks.slice(iendIdx);
            parsed.chunks = [...before, ...insertChunks, ...after];

            const pngBytes = buildPNG(parsed);
            resolve(new Blob([pngBytes], { type: 'image/png' }));
          };
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      });
    }
  };
})();
