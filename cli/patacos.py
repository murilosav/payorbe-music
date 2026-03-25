#!/usr/bin/env python3
"""
Patacos — Upload de músicas e ZIP pro R2.

Uso:
    python cli/patacos.py upload <playlist> <pasta>
    python cli/patacos.py upload <playlist> <pasta> --skip-zip
    python cli/patacos.py zip <playlist> <pasta>
    python cli/patacos.py list
    python cli/patacos.py gui

Zero dependências externas — só Python 3.10+.
"""

import os, sys, json, hashlib, hmac, struct, time, zipfile, threading, tempfile
from pathlib import Path
from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.request import Request, urlopen
from urllib.parse import quote, urlparse, parse_qsl
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed
from xml.etree import ElementTree
import http.server
import subprocess

# ─── Config ───────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

def load_env():
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                value = value.strip().strip("\"'")
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = value

load_env()

try:
    wrangler = json.loads((PROJECT_ROOT / "wrangler.json").read_text())
    _bucket = wrangler.get("r2_buckets", [{}])[0].get("bucket_name", "payorbe-music")
except Exception:
    _bucket = "payorbe-music"

CFG = SimpleNamespace(
    r2_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
    r2_secret=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
    cf_account=os.environ.get("CF_ACCOUNT_ID", ""),
    bucket=os.environ.get("R2_BUCKET_NAME", _bucket),
    api_base=os.environ.get("API_BASE", "https://patacos.com.br"),
    admin_key=os.environ.get("ADMIN_KEY", ""),
)

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".wma", ".opus"}

# ─── AWS SigV4 ────────────────────────────────────────────────────────

def _sha256(data):
    if isinstance(data, str): data = data.encode()
    return hashlib.sha256(data).hexdigest()

def _hmac(key, msg):
    if isinstance(key, str): key = key.encode()
    if isinstance(msg, str): msg = msg.encode()
    return hmac.new(key, msg, hashlib.sha256).digest()

def _signing_key(date_stamp):
    k = _hmac(f"AWS4{CFG.r2_secret}", date_stamp)
    k = _hmac(k, "auto")
    k = _hmac(k, "s3")
    return _hmac(k, "aws4_request")

def s3_request(method, path, body=None, extra_headers=None):
    """Signed S3 request. `path` pode incluir query string (ex: 'key?uploads=')."""
    host = f"{CFG.cf_account}.r2.cloudflarestorage.com"
    url = f"https://{host}/{CFG.bucket}/{path}"
    parsed = urlparse(url)

    now = datetime.now(timezone.utc)
    ds = now.strftime("%Y%m%d")
    amz = now.strftime("%Y%m%dT%H%M%SZ")

    if isinstance(body, str): body = body.encode()
    ph = _sha256(body) if body else "UNSIGNED-PAYLOAD"

    hdrs = {"host": host, "x-amz-date": amz, "x-amz-content-sha256": ph}
    if extra_headers: hdrs.update(extra_headers)

    skeys = sorted(hdrs)
    signed_h = ";".join(skeys)
    canon_h = "".join(f"{k}:{hdrs[k]}\n" for k in skeys)

    qs = parse_qsl(parsed.query, keep_blank_values=True)
    canon_qs = "&".join(f"{quote(k, safe='')}={quote(v, safe='')}" for k, v in sorted(qs))

    canon_req = "\n".join([method, parsed.path, canon_qs, canon_h, signed_h, ph])
    sts = "\n".join(["AWS4-HMAC-SHA256", amz, f"{ds}/auto/s3/aws4_request", _sha256(canon_req)])
    sig = hmac.new(_signing_key(ds), sts.encode(), hashlib.sha256).hexdigest()

    auth = (f"AWS4-HMAC-SHA256 Credential={CFG.r2_key_id}/{ds}/auto/s3/aws4_request, "
            f"SignedHeaders={signed_h}, Signature={sig}")

    fetch_h = {k: v for k, v in hdrs.items() if k != "host"}
    fetch_h["Authorization"] = auth

    req = Request(url, data=body, headers=fetch_h, method=method)
    try:
        r = urlopen(req, timeout=300)
        return SimpleNamespace(ok=True, status=r.status, headers=r.headers, read=r.read)
    except HTTPError as e:
        return SimpleNamespace(ok=False, status=e.code, headers=e.headers, read=e.read)

# ─── API ──────────────────────────────────────────────────────────────

def api(method, path, body=None):
    hdrs = {"Authorization": f"Bearer {CFG.admin_key}"}
    data = None
    if body:
        hdrs["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = Request(f"{CFG.api_base}{path}", data=data, headers=hdrs, method=method)
    try:
        return json.loads(urlopen(req, timeout=30).read())
    except HTTPError as e:
        raise Exception(f"API {method} {path}: {e.code} {e.read().decode()[:200]}")

def http_put(url, data, content_type):
    """PUT raw bytes to a URL (presigned)."""
    req = Request(url, data=data, headers={"Content-Type": content_type}, method="PUT")
    try:
        r = urlopen(req, timeout=300)
        return SimpleNamespace(ok=True, status=r.status)
    except HTTPError as e:
        return SimpleNamespace(ok=False, status=e.code)

# ─── Scan & ID3 ──────────────────────────────────────────────────────

def scan_dir(dir_path):
    base = Path(dir_path)
    results = []
    for p in sorted(base.rglob("*")):
        if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in AUDIO_EXTS:
            rel = p.relative_to(base)
            folder = str(rel.parent) if str(rel.parent) != "." else ""
            results.append({"path": str(p), "name": p.name, "folder": folder, "size": p.stat().st_size})
    return results

def parse_id3(filepath):
    meta = {"title": "", "artist": "", "album": "", "track_number": 0}
    try:
        with open(filepath, "rb") as f: buf = f.read(4096)
    except Exception:
        meta["title"] = Path(filepath).stem; return meta

    if len(buf) >= 10 and buf[:3] == b"ID3":
        ver = buf[3]
        hsize = (buf[6]&0x7f)<<21 | (buf[7]&0x7f)<<14 | (buf[8]&0x7f)<<7 | (buf[9]&0x7f)
        pos, end = 10, min(10 + hsize, len(buf) - 10)
        while pos < end and pos + 10 <= len(buf):
            fid = buf[pos:pos+4].decode("ascii", errors="replace")
            if fid[0] == "\x00": break
            if ver == 4:
                fsz = (buf[pos+4]&0x7f)<<21|(buf[pos+5]&0x7f)<<14|(buf[pos+6]&0x7f)<<7|(buf[pos+7]&0x7f)
            else:
                fsz = struct.unpack(">I", buf[pos+4:pos+8])[0]
            if fsz <= 0 or fsz > end - pos: break
            d = buf[pos+10:pos+10+fsz]
            if fid == "TIT2": meta["title"] = _text(d)
            elif fid == "TPE1": meta["artist"] = _text(d)
            elif fid == "TALB": meta["album"] = _text(d)
            elif fid == "TRCK":
                try: meta["track_number"] = int(_text(d).split("/")[0])
                except: pass
            pos += 10 + fsz

    if not meta["title"]: meta["title"] = Path(filepath).stem
    return meta

def _text(d):
    if len(d) < 2: return ""
    e, t = d[0], d[1:]
    try:
        if e == 0: return t.decode("latin-1").replace("\x00","")
        if e in (1,2):
            if t[:2] == b"\xff\xfe": return t[2:].decode("utf-16-le").replace("\x00","")
            if t[:2] == b"\xfe\xff": return t[2:].decode("utf-16-be").replace("\x00","")
            return t.decode("utf-16-le").replace("\x00","")
        if e == 3: return t.decode("utf-8").replace("\x00","")
    except: pass
    return t.decode("latin-1", errors="replace").replace("\x00","")

# ─── Helpers ──────────────────────────────────────────────────────────

def fmt(b):
    if b < 1024**2: return f"{b/1024:.0f} KB"
    if b < 1024**3: return f"{b/1024**2:.1f} MB"
    return f"{b/1024**3:.2f} GB"

def bar(cur, tot, label="", t0=None):
    pct = round(cur/tot*100) if tot else 0
    f = round(pct/2.5)
    elapsed = f"{time.time()-t0:.0f}s" if t0 else ""
    sys.stdout.write(f"\r  {'█'*f}{'░'*(40-f)} {pct}% | {cur}/{tot} | {elapsed} | {label[:35]:<35}")
    sys.stdout.flush()

def content_type(name):
    ext = Path(name).suffix.lower()
    return {".mp3":"audio/mpeg",".flac":"audio/flac",".wav":"audio/wav",".m4a":"audio/mp4",".ogg":"audio/ogg"}.get(ext, "audio/mpeg")

# ─── Core: upload songs ──────────────────────────────────────────────

def upload_songs(playlist, files, on_event=None):
    """Upload files to R2 via presigned URLs. Returns list of registered files."""
    emit = on_event or (lambda *a: None)
    registered = []
    lock = threading.Lock()
    idx = [0]
    stats = {"done": 0, "skip": 0, "err": 0, "bytes": 0}
    t0 = time.time()

    def do_one():
        while True:
            with lock:
                i = idx[0]; idx[0] += 1
            if i >= len(files): break
            f = files[i]
            try:
                presign = api("POST", "/api/presign/upload", {
                    "playlist_id": str(playlist["id"]),
                    "filename": f["name"],
                    "folder": f["folder"],
                    "content_type": content_type(f["name"]),
                })
                data = Path(f["path"]).read_bytes()
                last_err = None
                for attempt in range(3):
                    if attempt: time.sleep(2 * attempt)
                    r = http_put(presign["url"], data, presign["contentType"])
                    if r.ok:
                        api("POST", "/api/songs/register", {
                            "playlist_id": str(playlist["id"]),
                            "r2_key": presign["r2Key"],
                            "title": f["title"], "artist": f.get("artist") or "Desconhecido",
                            "album": f.get("album",""), "folder": f["folder"],
                            "duration": 0, "track_number": f.get("track_number",0),
                            "file_size": f["size"],
                        })
                        with lock:
                            registered.append(f)
                            stats["done"] += 1; stats["bytes"] += f["size"]
                        last_err = None; break
                    last_err = f"R2 PUT {r.status}"
                    if r.status < 500: raise Exception(last_err)
                if last_err: raise Exception(last_err)
            except Exception as e:
                if "409" in str(e):
                    with lock:
                        registered.append(f); stats["skip"] += 1; stats["bytes"] += f["size"]
                else:
                    with lock: stats["err"] += 1
                    emit("error", f"{f['name']}: {e}")
            total_done = stats["done"] + stats["skip"] + stats["err"]
            emit("progress", json.dumps({
                "phase": "upload", "current": total_done, "total": len(files),
                "pct": round(total_done/len(files)*100),
                "speed": f"{fmt(stats['bytes']/(time.time()-t0+0.1))}/s",
                "file": f["name"],
            }))

    avg = sum(f["size"] for f in files) / max(len(files),1)
    conc = 4 if avg > 50*1024*1024 else 8 if avg > 20*1024*1024 else 20
    with ThreadPoolExecutor(max_workers=min(conc, len(files))) as pool:
        futs = [pool.submit(do_one) for _ in range(min(conc, len(files)))]
        for fu in as_completed(futs): fu.result()

    elapsed = time.time() - t0
    emit("info", f"Upload: {stats['done']} novas, {stats['skip']} já existiam, {stats['err']} erros — {elapsed:.1f}s")
    return registered

# ─── Core: generate ZIP ──────────────────────────────────────────────

def generate_zip(files, zip_path, on_event=None):
    """Gera ZIP no disco usando zipfile (ZIP64, sem compressão)."""
    emit = on_event or (lambda *a: None)
    t0 = time.time()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED, allowZip64=True) as zf:
        for i, f in enumerate(files):
            ext = Path(f["name"]).suffix
            artist = f.get("artist") or "Desconhecido"
            name = f"{artist} - {f['title']}{ext}"
            if f["folder"]:
                name = f"{f['folder']}/{name}"
            zf.write(f["path"], name)
            if i % 10 == 0:
                emit("progress", json.dumps({
                    "phase": "zip-build", "current": i+1, "total": len(files),
                    "pct": round((i+1)/len(files)*50),
                }))
    size = os.path.getsize(zip_path)
    emit("info", f"ZIP gerado: {fmt(size)} em {time.time()-t0:.1f}s")
    return size

# ─── Core: upload ZIP to R2 ──────────────────────────────────────────

def upload_zip(zip_path, total_size, r2_key, on_event=None):
    """Upload ZIP via S3 multipart — 10 conexões paralelas, partes de 50MB."""
    emit = on_event or (lambda *a: None)

    # Start multipart
    r = s3_request("POST", f"{r2_key}?uploads=", None, {"content-type": "application/zip"})
    xml = r.read().decode()
    root = ElementTree.fromstring(xml)
    ns = root.tag.split("}")[0] + "}" if root.tag.startswith("{") else ""
    upload_id = root.find(f"{ns}UploadId").text

    PART_SIZE = 50 * 1024 * 1024
    CONC = 10
    n_parts = (total_size + PART_SIZE - 1) // PART_SIZE
    results = [None] * n_parts
    lock = threading.Lock()
    done = [0]
    t0 = time.time()

    def do_part(idx):
        pnum = idx + 1
        offset = idx * PART_SIZE
        length = min(PART_SIZE, total_size - offset)
        with open(zip_path, "rb") as f:
            f.seek(offset)
            data = f.read(length)

        for attempt in range(3):
            if attempt: time.sleep(2 * attempt)
            r = s3_request(
                "PUT",
                f"{r2_key}?partNumber={pnum}&uploadId={quote(upload_id, safe='')}",
                data,
                {"content-length": str(len(data))},
            )
            if r.ok:
                etag = r.headers.get("ETag") or r.headers.get("etag")
                r.read()  # drain
                results[idx] = {"partNumber": pnum, "etag": etag}
                with lock:
                    done[0] += 1
                    emit("progress", json.dumps({
                        "phase": "zip-upload", "current": done[0], "total": n_parts,
                        "pct": 50 + round(done[0]/n_parts*50),
                    }))
                return
            try: r.read()
            except: pass
        raise Exception(f"Part {pnum} failed after 3 attempts")

    with ThreadPoolExecutor(max_workers=min(CONC, n_parts)) as pool:
        futs = {pool.submit(do_part, i): i for i in range(n_parts)}
        for fu in as_completed(futs): fu.result()

    # Complete
    xml_parts = "".join(
        f"<Part><PartNumber>{p['partNumber']}</PartNumber><ETag>{p['etag']}</ETag></Part>"
        for p in results
    )
    r = s3_request(
        "POST", f"{r2_key}?uploadId={quote(upload_id, safe='')}",
        f"<CompleteMultipartUpload>{xml_parts}</CompleteMultipartUpload>",
        {"content-type": "application/xml"},
    )
    if not r.ok:
        raise Exception(f"Complete multipart failed: {r.status}")
    r.read()

    elapsed = time.time() - t0
    emit("info", f"ZIP enviado ({n_parts} partes, {fmt(total_size)}) em {elapsed:.1f}s")
    return n_parts

# ─── Full pipeline ────────────────────────────────────────────────────

def run_pipeline(playlist_slug, dir_path, skip_zip=False, flat_folder=False, on_event=None):
    """Pipeline completo: scan → upload → ZIP → register."""
    emit = on_event or (lambda *a: None)

    # Find playlist
    playlists = api("GET", "/api/playlists")
    playlist = next((p for p in playlists if p["slug"] == playlist_slug or str(p["id"]) == playlist_slug or p["name"] == playlist_slug), None)
    if not playlist: raise Exception(f'Playlist "{playlist_slug}" não encontrada')
    emit("info", f"Playlist: {playlist['name']} ({playlist['slug']})")

    # Scan
    emit("info", f"Escaneando: {dir_path}")
    files = scan_dir(dir_path)
    if not files:
        emit("done", "Nenhum arquivo de áudio encontrado.")
        return

    total_size = sum(f["size"] for f in files)
    emit("info", f"{len(files)} arquivos ({fmt(total_size)})")

    # Flatten + deduplicate
    if flat_folder:
        for f in files: f["folder"] = ""
        seen = {}
        dupes = 0
        for f in files:
            if f["name"] not in seen:
                seen[f["name"]] = f
            else:
                dupes += 1
        if dupes:
            emit("info", f"{dupes} duplicados removidos (mesmo filename em subpastas diferentes)")
        files = list(seen.values())

    # Parse ID3
    for f in files:
        f.update(parse_id3(f["path"]))

    # Upload songs
    emit("phase", "upload")
    registered = upload_songs(playlist, files, on_event)

    # ZIP
    if not skip_zip and registered:
        emit("phase", "zip")
        emit("info", f"Gerando ZIP ({len(registered)} arquivos)...")

        tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False, dir="/tmp", prefix="patacos-")
        tmp.close()
        try:
            zip_size = generate_zip(registered, tmp.name, on_event)

            emit("info", f"Enviando ZIP pro R2 (10 conexões, 50MB/parte)...")
            r2_key = f"zips/playlist-{playlist['id']}/_all_part1.zip"
            upload_zip(tmp.name, zip_size, r2_key, on_event)
        finally:
            try: os.unlink(tmp.name)
            except: pass

        # Register
        try: api("DELETE", f"/api/playlists/{playlist['id']}/zips")
        except: pass
        api("POST", f"/api/playlists/{playlist['id']}/zip/complete", {
            "uploadId": "direct-s3", "key": r2_key, "parts": [],
            "folder": "", "zipPart": 1, "totalParts": 1,
            "fileSize": zip_size, "songCount": len(registered),
        })
        emit("info", f"ZIP registrado! {len(registered)} músicas, {fmt(zip_size)}")

    emit("done", "Tudo pronto!")

# ─── CLI commands ─────────────────────────────────────────────────────

def cmd_list():
    print("\n  PATACOS — Playlists\n")
    for p in api("GET", "/api/playlists"):
        print(f"  {p['id']}. {p['name']} ({p['slug']}) — {p.get('song_count',0)} músicas")
    print()

def cmd_upload(slug, dir_path, skip_zip=False):
    print("\n  PATACOS — Upload\n")
    def on_event(typ, data):
        if typ == "info": print(f"  ℹ {data}")
        elif typ == "error": print(f"  ✗ {data}")
        elif typ == "phase": print(f"\n  ── {data.upper()} ──")
        elif typ == "progress":
            p = json.loads(data)
            bar(p.get("current",0), p.get("total",1), p.get("file",""), time.time())
        elif typ == "done": print(f"\n\n  ✓ {data}\n")
    run_pipeline(slug, dir_path, skip_zip=skip_zip, on_event=on_event)

def cmd_zip(slug, dir_path):
    print("\n  PATACOS — Gerar ZIP\n")
    def on_event(typ, data):
        if typ == "info": print(f"  ℹ {data}")
        elif typ == "error": print(f"  ✗ {data}")
        elif typ == "phase": print(f"\n  ── {data.upper()} ──")
        elif typ == "progress":
            p = json.loads(data)
            bar(p.get("current",0), p.get("total",1), "", time.time())
        elif typ == "done": print(f"\n\n  ✓ {data}\n")

    # For zip-only, we still upload (to handle 409s) then zip
    run_pipeline(slug, dir_path, skip_zip=False, on_event=on_event)

# ─── GUI ──────────────────────────────────────────────────────────────

GUI_HTML = r'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Patacos — Upload Manager</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh}
.container{max-width:720px;margin:0 auto;padding:40px 20px}
h1{font-size:28px;font-weight:700;color:#fff}
.sub{color:#666;font-size:14px;margin-bottom:32px}
.card{background:#141414;border:1px solid #262626;border-radius:12px;padding:24px;margin-bottom:16px}
.card h2{font-size:15px;font-weight:600;color:#a3a3a3;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
label{display:block;font-size:13px;color:#a3a3a3;margin-bottom:6px;font-weight:500}
select,input[type=text]{width:100%;padding:10px 14px;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;font-family:inherit;outline:none}
select:focus,input:focus{border-color:#555}
select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.pi{display:flex;gap:8px;margin-bottom:16px}
.pi input{flex:1}
.bb{padding:10px 16px;background:#262626;border:1px solid #333;border-radius:8px;color:#a3a3a3;font-size:13px;cursor:pointer;white-space:nowrap;font-family:inherit}
.bb:hover{background:#333;color:#fff}
.acts{display:flex;gap:10px;margin-top:8px}
.btn{flex:1;padding:12px 20px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
.bp{background:#fff;color:#000}.bp:hover{background:#e5e5e5}.bp:disabled{background:#333;color:#666;cursor:not-allowed}
.bs{background:#1a1a1a;color:#a3a3a3;border:1px solid #333}.bs:hover{background:#262626;color:#fff}
.chk{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.chk input{accent-color:#fff}.chk label{margin:0;cursor:pointer}
#log{display:none;margin-top:16px}#log.active{display:block}
.lc{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:12px;overflow:hidden}
.lh{padding:16px 20px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center}
.lh h2{margin:0;font-size:14px}
.ls{font-size:12px;padding:4px 10px;border-radius:20px;font-weight:600}
.ls.run{background:#172554;color:#60a5fa}.ls.ok{background:#052e16;color:#4ade80}.ls.err{background:#450a0a;color:#f87171}
.pw{padding:0 20px;padding-top:16px}
.pb{height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden;margin-bottom:4px}
.pf{height:100%;background:#fff;border-radius:3px;transition:width .3s;width:0%}
.pt{font-size:12px;color:#666;display:flex;justify-content:space-between}
.le{max-height:300px;overflow-y:auto;padding:12px 20px;font-family:'SF Mono',Menlo,monospace;font-size:12px;line-height:1.8}
.ll{color:#525252}.ll.i{color:#a3a3a3}.ll.e{color:#f87171}.ll.s{color:#4ade80}
.pi2{display:flex;gap:16px;padding:12px 0;font-size:13px;color:#666}
</style>
</head>
<body>
<div class="container">
<h1>Patacos</h1>
<p class="sub">Upload Manager (Python)</p>
<div class="card">
<h2>Configurar</h2>
<label>Playlist</label>
<select id="pl" style="margin-bottom:12px"><option>Carregando...</option></select>
<div class="pi2" id="pinfo" style="display:none"></div>
<label>Pasta com as músicas</label>
<div class="pi">
<input type="text" id="dir" placeholder="Clique em Selecionar ou cole o caminho">
<button class="bb" onclick="pick()">Selecionar</button>
</div>
<div class="chk"><input type="checkbox" id="flat" checked><label for="flat">Ignorar subpastas (tudo na raiz)</label></div>
<div class="chk"><input type="checkbox" id="nozip"><label for="nozip">Pular ZIP (só upload)</label></div>
<div class="acts">
<button class="btn bp" id="go" onclick="run('upload')">Enviar Músicas + ZIP</button>
<button class="btn bs" onclick="run('zip')">Só ZIP</button>
</div>
</div>
<div id="log">
<div class="lc">
<div class="lh"><h2>Progresso</h2><span class="ls run" id="st">Executando</span></div>
<div class="pw"><div class="pb"><div class="pf" id="pf"></div></div><div class="pt"><span id="pl2">0/0</span><span id="pr"></span></div></div>
<div class="le" id="le"></div>
</div>
</div>
</div>
<script>
let pls=[];
async function load(){
 const r=await fetch('/api/playlists');pls=await r.json();
 const s=document.getElementById('pl');
 s.innerHTML=pls.map(p=>`<option value="${p.slug}">${p.name} (${p.song_count||0} músicas)</option>`).join('');
 s.onchange=info;info();
}
function info(){
 const p=pls.find(x=>x.slug===document.getElementById('pl').value);
 const el=document.getElementById('pinfo');
 if(p){el.style.display='flex';el.innerHTML=`<span>ID: ${p.id}</span><span>Slug: ${p.slug}</span>`;}
}
function log(t,c){
 const el=document.getElementById('le'),d=document.createElement('div');
 d.className='ll '+(c||'');d.textContent=new Date().toLocaleTimeString('pt-BR')+'  '+t;
 el.appendChild(d);el.scrollTop=el.scrollHeight;
}
async function run(mode){
 const slug=document.getElementById('pl').value,dir=document.getElementById('dir').value.trim();
 if(!slug||!dir){alert('Selecione playlist e pasta.');return;}
 document.getElementById('go').disabled=true;
 document.getElementById('log').className='active';
 document.getElementById('le').innerHTML='';
 document.getElementById('st').className='ls run';document.getElementById('st').textContent='Executando';
 document.getElementById('pf').style.width='0%';
 const r=await fetch('/run',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({playlist:slug,dir,skipZip:mode==='zip'?false:document.getElementById('nozip').checked,flat:document.getElementById('flat').checked,mode})});
 const{jobId:jid}=await r.json();
 let idx=0;
 const poll=async()=>{
  const r=await fetch(`/job/${jid}?from=${idx}`);const d=await r.json();
  for(const e of d.events){idx++;
   if(e.type==='info')log(e.data,'i');
   else if(e.type==='error')log(e.data,'e');
   else if(e.type==='progress'){const p=JSON.parse(e.data);document.getElementById('pf').style.width=p.pct+'%';document.getElementById('pl2').textContent=(p.current||0)+'/'+(p.total||'?');document.getElementById('pr').textContent=p.speed||p.phase||'';}
   else if(e.type==='phase')log('── '+e.data.toUpperCase()+' ──','i');
   else if(e.type==='done'){const err=e.data.startsWith('Erro');log(e.data,err?'e':'s');document.getElementById('st').className='ls '+(err?'err':'ok');document.getElementById('st').textContent=err?'Erro':'Concluído';document.getElementById('pf').style.width='100%';document.getElementById('go').disabled=false;load();return;}
  }
  setTimeout(poll,500);
 };poll();
}
async function pick(){
 const r=await fetch('/pick-folder');const d=await r.json();
 if(d.path)document.getElementById('dir').value=d.path;
}
load();
</script>
</body></html>'''

_jobs = {}
_job_id = [0]

class Job:
    def __init__(self):
        self.events = []
        self.done = False
        self._lock = threading.Lock()
    def emit(self, typ, data):
        with self._lock:
            self.events.append({"type": typ, "data": data})
    def get_events(self, fr=0):
        with self._lock:
            return list(self.events[fr:])

def _run_job_thread(job, playlist, dir_path, skip_zip, flat):
    try:
        run_pipeline(playlist, dir_path, skip_zip=skip_zip, flat_folder=flat,
                     on_event=lambda t, d: job.emit(t, d))
    except Exception as e:
        job.emit("error", str(e))
        job.emit("done", f"Erro: {e}")
    job.done = True

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass  # silenciar

    def _json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/":
            body = GUI_HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif path == "/api/playlists":
            try:
                self._json(api("GET", "/api/playlists"))
            except Exception as e:
                self._json({"error": str(e)}, 500)

        elif path == "/pick-folder":
            try:
                result = subprocess.run(
                    ["osascript", "-e", 'POSIX path of (choose folder with prompt "Selecione a pasta com as músicas")'],
                    capture_output=True, text=True, timeout=60)
                self._json({"path": result.stdout.strip()})
            except:
                self._json({"path": ""})

        elif path.startswith("/job/"):
            jid = int(path.split("/")[-1])
            job = _jobs.get(jid)
            if not job:
                self._json({"error": "not found"}, 404); return
            fr = 0
            qs = self.path.split("?")
            if len(qs) > 1:
                for p in qs[1].split("&"):
                    if p.startswith("from="): fr = int(p[5:])
            self._json({"events": job.get_events(fr), "done": job.done})

        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        if self.path == "/run":
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))

            _job_id[0] += 1
            jid = _job_id[0]
            job = Job()
            _jobs[jid] = job

            skip_zip = data.get("skipZip", False)
            if data.get("mode") == "zip":
                skip_zip = False

            t = threading.Thread(target=_run_job_thread, args=(
                job, data["playlist"], data["dir"], skip_zip, data.get("flat", False)
            ), daemon=True)
            t.start()

            self._json({"jobId": jid})
        else:
            self.send_response(404); self.end_headers()

def cmd_gui(port=3456):
    server = http.server.HTTPServer(("", port), Handler)
    print(f"\n  ╔══════════════════════════════════════════╗")
    print(f"  ║  PATACOS — Upload Manager (Python)       ║")
    print(f"  ║  http://localhost:{port}                   ║")
    print(f"  ╚══════════════════════════════════════════╝\n")
    try: subprocess.run(["open", f"http://localhost:{port}"], check=False)
    except: pass
    try: server.serve_forever()
    except KeyboardInterrupt: print("\n  Tchau!")

# ─── Entry point ──────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    cmd = args[0] if args else ""

    if not cmd or cmd in ("help", "--help", "-h"):
        print("""
  PATACOS — Upload de músicas e ZIP pro R2 (Python)

  Uso:
    python cli/patacos.py upload <playlist> <pasta>     Upload + ZIP
    python cli/patacos.py upload <playlist> <pasta> --skip-zip
    python cli/patacos.py zip <playlist> <pasta>        Só gerar/enviar ZIP
    python cli/patacos.py list                          Listar playlists
    python cli/patacos.py gui                           Interface gráfica

  Config (.env na raiz):
    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CF_ACCOUNT_ID, ADMIN_KEY
""")
        return

    if not CFG.r2_key_id or not CFG.r2_secret or not CFG.cf_account:
        print("  ERRO: Configure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CF_ACCOUNT_ID no .env")
        sys.exit(1)

    if cmd == "list":
        cmd_list()
    elif cmd == "upload":
        if len(args) < 3: print("  Uso: patacos.py upload <playlist> <pasta>"); sys.exit(1)
        cmd_upload(args[1], args[2], "--skip-zip" in args)
    elif cmd == "zip":
        if len(args) < 3: print("  Uso: patacos.py zip <playlist> <pasta>"); sys.exit(1)
        cmd_zip(args[1], args[2])
    elif cmd == "gui":
        port = int(args[1]) if len(args) > 1 else 3456
        cmd_gui(port)
    else:
        print(f"  Comando desconhecido: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()
