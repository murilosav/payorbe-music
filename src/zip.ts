// Minimal streaming ZIP generator (STORE method, no compression)
// Works within Cloudflare Workers constraints

interface ZipEntry {
	name: string;
	data: ReadableStream<Uint8Array>;
	size: number;
}

export function createZipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
	let controller: ReadableStreamDefaultController<Uint8Array>;
	const centralDirectory: Uint8Array[] = [];
	let offset = 0;

	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;

			for (const entry of entries) {
				const nameBytes = new TextEncoder().encode(entry.name);
				const crc = 0; // We'll use data descriptor with 0 CRC (zip readers handle this)

				// Local file header
				const header = new Uint8Array(30 + nameBytes.length);
				const view = new DataView(header.buffer);
				view.setUint32(0, 0x04034b50, true); // signature
				view.setUint16(4, 20, true); // version needed
				view.setUint16(6, 0x0008, true); // flags: data descriptor
				view.setUint16(8, 0, true); // compression: STORE
				view.setUint16(10, 0, true); // mod time
				view.setUint16(12, 0, true); // mod date
				view.setUint32(14, crc, true); // crc32
				view.setUint32(18, 0, true); // compressed size (in data descriptor)
				view.setUint32(22, 0, true); // uncompressed size (in data descriptor)
				view.setUint16(26, nameBytes.length, true); // filename length
				view.setUint16(28, 0, true); // extra field length
				header.set(nameBytes, 30);

				const headerOffset = offset;
				controller.enqueue(header);
				offset += header.length;

				// File data + compute CRC
				let actualCrc = 0;
				let actualSize = 0;
				const reader = entry.data.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					controller.enqueue(value);
					actualCrc = crc32(value, actualCrc);
					actualSize += value.length;
					offset += value.length;
				}

				// Data descriptor
				const descriptor = new Uint8Array(16);
				const descView = new DataView(descriptor.buffer);
				descView.setUint32(0, 0x08074b50, true); // signature
				descView.setUint32(4, actualCrc >>> 0, true);
				descView.setUint32(8, actualSize, true); // compressed
				descView.setUint32(12, actualSize, true); // uncompressed
				controller.enqueue(descriptor);
				offset += 16;

				// Build central directory entry
				const cdEntry = new Uint8Array(46 + nameBytes.length);
				const cdView = new DataView(cdEntry.buffer);
				cdView.setUint32(0, 0x02014b50, true); // signature
				cdView.setUint16(4, 20, true); // version made by
				cdView.setUint16(6, 20, true); // version needed
				cdView.setUint16(8, 0x0008, true); // flags
				cdView.setUint16(10, 0, true); // compression
				cdView.setUint16(12, 0, true); // mod time
				cdView.setUint16(14, 0, true); // mod date
				cdView.setUint32(16, actualCrc >>> 0, true);
				cdView.setUint32(20, actualSize, true);
				cdView.setUint32(24, actualSize, true);
				cdView.setUint16(28, nameBytes.length, true);
				cdView.setUint16(30, 0, true); // extra
				cdView.setUint16(32, 0, true); // comment
				cdView.setUint16(34, 0, true); // disk
				cdView.setUint16(36, 0, true); // internal attrs
				cdView.setUint32(38, 0, true); // external attrs
				cdView.setUint32(42, headerOffset, true); // local header offset
				cdEntry.set(nameBytes, 46);
				centralDirectory.push(cdEntry);
			}

			// Write central directory
			const cdOffset = offset;
			let cdSize = 0;
			for (const cd of centralDirectory) {
				controller.enqueue(cd);
				cdSize += cd.length;
			}

			// End of central directory
			const eocd = new Uint8Array(22);
			const eocdView = new DataView(eocd.buffer);
			eocdView.setUint32(0, 0x06054b50, true);
			eocdView.setUint16(4, 0, true);
			eocdView.setUint16(6, 0, true);
			eocdView.setUint16(8, entries.length, true);
			eocdView.setUint16(10, entries.length, true);
			eocdView.setUint32(12, cdSize, true);
			eocdView.setUint32(16, cdOffset, true);
			eocdView.setUint16(20, 0, true);
			controller.enqueue(eocd);

			controller.close();
		},
	});

	return stream;
}

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let j = 0; j < 8; j++) {
		c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
	}
	crcTable[i] = c;
}

function crc32(data: Uint8Array, prev: number = 0): number {
	let crc = prev ^ 0xFFFFFFFF;
	for (let i = 0; i < data.length; i++) {
		crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
	}
	return crc ^ 0xFFFFFFFF;
}
