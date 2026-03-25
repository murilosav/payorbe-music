export function id3ParserScript(): string {
	return `
	async function parseID3(file) {
		var meta = { title: '', artist: '', album: '', cover: null, duration: 0, trackNumber: 0 };
		try {
			var buffer = await file.slice(0, 131072).arrayBuffer();
			var view = new DataView(buffer);
			if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) return meta;

			var version = view.getUint8(3);
			var tagSize = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
			var offset = 10;
			var end = Math.min(10 + tagSize, buffer.byteLength);

			while (offset < end - 10) {
				var frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
				if (frameId.charCodeAt(0) === 0) break;

				var frameSize;
				if (version === 4) {
					frameSize = (view.getUint8(offset+4) << 21) | (view.getUint8(offset+5) << 14) | (view.getUint8(offset+6) << 7) | view.getUint8(offset+7);
				} else {
					frameSize = (view.getUint8(offset+4) << 24) | (view.getUint8(offset+5) << 16) | (view.getUint8(offset+6) << 8) | view.getUint8(offset+7);
				}

				if (frameSize <= 0 || offset + 10 + frameSize > end) break;
				var frameData = new Uint8Array(buffer, offset + 10, frameSize);

				if (frameId === 'TIT2' || frameId === 'TPE1' || frameId === 'TALB') {
					var text = decodeID3Text(frameData);
					if (frameId === 'TIT2') meta.title = text;
					else if (frameId === 'TPE1') meta.artist = text;
					else if (frameId === 'TALB') meta.album = text;
				}

				if (frameId === 'TRCK') {
				var trackText = decodeID3Text(frameData);
				var trackNum = parseInt(trackText);
				if (!isNaN(trackNum) && trackNum > 0) meta.trackNumber = trackNum;
			}

			if (frameId === 'APIC') {
					var enc = frameData[0];
					var idx = 1;
					var mime = '';
					while (idx < frameData.length && frameData[idx] !== 0) { mime += String.fromCharCode(frameData[idx]); idx++; }
					idx++; idx++;
					if (enc === 1 || enc === 2) {
						while (idx < frameData.length - 1 && !(frameData[idx] === 0 && frameData[idx+1] === 0)) idx++;
						idx += 2;
					} else {
						while (idx < frameData.length && frameData[idx] !== 0) idx++;
						idx++;
					}
					if (idx < frameData.length) {
						meta.cover = new Blob([frameData.slice(idx)], { type: mime || 'image/jpeg' });
					}
				}
				offset += 10 + frameSize;
			}
		} catch (e) {}
		return meta;
	}

	function decodeID3Text(data) {
		var enc = data[0];
		var textBytes = data.slice(1);
		if (enc === 1 || enc === 2) {
			var arr = [];
			var bigEndian = enc === 2;
			var start = 0;
			if (enc === 1 && textBytes.length >= 2) {
				if (textBytes[0] === 0xFE && textBytes[1] === 0xFF) { bigEndian = true; start = 2; }
				else if (textBytes[0] === 0xFF && textBytes[1] === 0xFE) { bigEndian = false; start = 2; }
			}
			for (var i = start; i < textBytes.length - 1; i += 2) {
				var code = bigEndian
					? (textBytes[i] << 8) | textBytes[i+1]
					: textBytes[i] | (textBytes[i+1] << 8);
				if (code === 0) break;
				arr.push(code);
			}
			return String.fromCharCode.apply(null, arr);
		}
		var bytes = [];
		for (var i = 0; i < textBytes.length; i++) {
			if (textBytes[i] === 0) break;
			bytes.push(textBytes[i]);
		}
		if (enc === 3) return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
		return new TextDecoder('iso-8859-1').decode(new Uint8Array(bytes));
	}
	`;
}
