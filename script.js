"use strict";

const DB_NAME = "little-forever-memories";
const STORE = "memories";
const CLOUD = window.MEMORY_CLOUD_CONFIG || {};
const cloudEnabled = Boolean(CLOUD.url && CLOUD.anonKey && CLOUD.bucket);
const state = { items: [], filter: "all", urls: new Map(), thumbUrls: new Map(), pendingFiles: [], editingItem: null, reel: [], reelIndex: 0 };
const $ = selector => document.querySelector(selector);
const grid = $("#memory-grid");

const anniversaryGate = $("#anniversary-gate");
const anniversaryForm = $("#anniversary-form");
const anniversaryAnswer = $("#anniversary-answer");
const anniversaryError = $("#anniversary-error");
const lovePopup = $("#love-popup");
const loveHeading = $("#love-heading");
const loveMessage = $("#love-message");
const loveActions = $("#love-actions");
const loveYes = $("#love-yes");
const loveNo = $("#love-no");
let noAttempts = 0;
const noJokes = [
  "REALLY?? 😭 The No button is offended!",
  "Nice try 😤💨 Catch me if you can!",
  "Buwag nata? Absolutely not 😭💔",
  "Stop ragebaiting me 😭 The committee is watching!"
];
anniversaryAnswer.focus();
anniversaryForm.addEventListener("submit", event => {
  event.preventDefault();
  if (anniversaryAnswer.value.trim() === "11/15/23") {
    anniversaryGate.hidden = true;
    lovePopup.hidden = false;
    anniversaryAnswer.value = "";
    anniversaryError.textContent = "";
    return;
  }
  anniversaryError.textContent = "That date is not quite right. Try again.";
  anniversaryAnswer.select();
});
loveYes.addEventListener("click", () => {
  lovePopup.hidden = true;
});
loveNo.addEventListener("click", () => {
  loveMessage.textContent = noJokes[noAttempts % noJokes.length];
  noAttempts += 1;
  loveNo.style.position = "fixed";
  loveNo.style.zIndex = "91";
  const horizontalSpace = Math.max(0, window.innerWidth - loveNo.offsetWidth - 24);
  const verticalSpace = Math.max(0, window.innerHeight - loveNo.offsetHeight - 24);
  loveNo.style.left = `${12 + Math.random() * horizontalSpace}px`;
  loveNo.style.top = `${12 + Math.random() * verticalSpace}px`;
});

function dbAction(mode, action) { return new Promise((resolve, reject) => { const open = indexedDB.open(DB_NAME, 1); open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true }); open.onerror = () => reject(open.error); open.onsuccess = () => { const request = action(open.result.transaction(STORE, mode).objectStore(STORE)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }; }); }
const getAll = () => dbAction("readonly", store => store.getAll());
const addItem = item => dbAction("readwrite", store => store.add(item));
const updateItem = item => dbAction("readwrite", store => store.put(item));
const removeItem = id => dbAction("readwrite", store => store.delete(id));
function cloudHeaders(json = false) { return { apikey: CLOUD.anonKey, Authorization: `Bearer ${CLOUD.anonKey}`, ...(json ? { "Content-Type": "application/json" } : {}) }; }
async function cloudRequest(path, options = {}) { const response = await fetch(`${CLOUD.url.replace(/\/$/, "")}${path}`, { ...options, headers: { ...cloudHeaders(Boolean(options.body)), ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Cloud request failed: ${response.status}`); return response.status === 204 ? null : response.json(); }
async function cloudUpload(file, path) { const response = await fetch(`${CLOUD.url.replace(/\/$/, "")}/storage/v1/object/${CLOUD.bucket}/${path}`, { method: "POST", headers: cloudHeaders(), body: file }); if (!response.ok) throw new Error(`Cloud upload failed: ${response.status}`); return path; }
async function cloudSignedUrl(path) { const response = await cloudRequest(`/storage/v1/object/sign/${CLOUD.bucket}/${encodeURIComponent(path)}`, { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) }); return `${CLOUD.url.replace(/\/$/, "")}/storage/v1${response.signedURL}`; }
async function cloudAdd(item) { const path = `${crypto.randomUUID()}-${item.file.name.replace(/[^a-z0-9._-]/gi, "-")}`; await cloudUpload(item.file, path); const publicUrl = await cloudSignedUrl(path); const remote = await cloudRequest("/rest/v1/memories", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ title: item.title, type: item.type, favorite: false, added_at: item.addedAt, storage_path: path, public_url: publicUrl }) }); return { ...item, cloudId: remote[0].id, publicUrl, storagePath: path }; }
async function cloudItems() { if (!cloudEnabled) return []; const rows = await cloudRequest("/rest/v1/memories?select=*&order=added_at.desc"); return Promise.all(rows.map(async row => ({ id: `cloud-${row.id}`, cloudId: row.id, title: row.title, type: row.type, favorite: row.favorite, addedAt: row.added_at, publicUrl: await cloudSignedUrl(row.storage_path).catch(() => row.public_url), storagePath: row.storage_path }))); }
async function cloudUpdate(item) { if (!cloudEnabled || !item.cloudId) return; await cloudRequest(`/rest/v1/memories?id=eq.${encodeURIComponent(item.cloudId)}`, { method: "PATCH", body: JSON.stringify({ title: item.title, favorite: item.favorite }) }); }
async function cloudDelete(item) { if (!cloudEnabled || !item.cloudId) return; await cloudRequest(`/rest/v1/memories?id=eq.${encodeURIComponent(item.cloudId)}`, { method: "DELETE" }); if (item.storagePath) await cloudRequest(`/storage/v1/object/remove/${CLOUD.bucket}`, { method: "POST", body: JSON.stringify({ prefixes: [item.storagePath] }) }); }
function showToast(text) { const toast = $("#toast"); toast.textContent = text; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500); }
function fileUrl(item) { if (item.publicUrl) return item.publicUrl; if (!item.file) return ""; if (!state.urls.has(item.id)) state.urls.set(item.id, URL.createObjectURL(item.file)); return state.urls.get(item.id); }
function thumbUrl(item) { if (item.publicUrl) return item.publicUrl; if (!item.thumbnail) return ""; if (!state.thumbUrls.has(item.id)) state.thumbUrls.set(item.id, URL.createObjectURL(item.thumbnail)); return state.thumbUrls.get(item.id); }
function revokeItemUrls(id) { [state.urls, state.thumbUrls].forEach(map => { if (map.has(id)) { URL.revokeObjectURL(map.get(id)); map.delete(id); } }); }
function filtered() { return state.items.filter(item => state.filter === "all" || item.type === state.filter || state.filter === "favorite" && item.favorite); }
function render() {
  const photos = state.items.filter(item => item.type === "photo").length; const videos = state.items.filter(item => item.type === "video").length;
  $("#memory-total").textContent = state.items.length; $("#video-total").textContent = videos; $("#collection-label").textContent = `${state.items.length ? "Your private collection" : "A blank page for your story"}`;
  grid.innerHTML = ""; const items = filtered(); $("#empty-memory").hidden = items.length > 0;
  items.forEach(item => grid.appendChild(createCard(item)));
  renderHeroCover();
}
function renderHeroCover() {
  let coverId = localStorage.getItem("hero-cover-id");
  let cover = state.items.find(item => String(item.id) === coverId && (item.type === "photo" || item.type === "video"));

  if (!cover) {
    cover = state.items.find(item => item.type === "photo" || item.type === "video");
    if (cover) {
      localStorage.setItem("hero-cover-id", String(cover.id));
    }
  }

  const image = $("#hero-cover-image");
  const video = $("#hero-cover-video");
  const placeholder = $("#hero-cover-placeholder");
  image.hidden = true;
  video.hidden = true;
  video.pause();
  if (cover?.type === "video") {
    video.src = fileUrl(cover);
    video.hidden = false;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => showToast("Tap the hero video to start it."));
    placeholder.hidden = true;
  } else if (cover?.type === "photo") {
    image.src = fileUrl(cover);
    image.loading = "eager";
    image.decoding = "sync";
    image.fetchPriority = "high";
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    placeholder.hidden = false;
  }
  renderCollageDetails(cover);
}
function renderCollageDetails(hero) {
  const slots = [...document.querySelectorAll(".collage-slot")];
  const items = state.items.filter(item => item !== hero).slice(0, slots.length);
  slots.forEach((slot, index) => {
    if (!slot) return;
    const fallback = slot.querySelector("span");
    slot.querySelectorAll(".collage-media, .collage-audio").forEach(media => media.remove());
    const item = items[index];
    if (!item) {
      if (fallback) fallback.hidden = false;
      return;
    }
    if (fallback) fallback.hidden = true;
    if (item.type === "audio") {
      const marker = document.createElement("span");
      marker.className = "collage-audio";
      marker.textContent = "♫";
      marker.title = item.title;
      slot.appendChild(marker);
      return;
    }
    const media = document.createElement(item.type === "video" ? "video" : "img");
    media.className = "collage-media";
    media.alt = item.title;
    media.title = item.title;
    media.loading = "eager";
    media.decoding = "sync";
    media.fetchPriority = "high";
    media.src = fileUrl(item);
    if (item.type === "video") {
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = "auto";
      media.autoplay = false;
    }
    slot.appendChild(media);
  });
}
function createCard(item) {
  const card = document.createElement("article"); card.className = `memory-card memory-${item.type}`; card.dataset.id = item.id;
  const thumb = document.createElement("div"); thumb.className = "memory-thumb";
  if (item.type === "photo") { const image = document.createElement("img"); image.src = fileUrl(item); image.alt = item.title; image.loading = "eager"; image.decoding = "sync"; image.fetchPriority = "high"; thumb.appendChild(image); } else if (item.type === "video") { if (item.thumbnail || item.thumbnailUrl) { const image = document.createElement("img"); image.src = item.thumbnailUrl || thumbUrl(item); image.alt = `${item.title} video still`; image.loading = "eager"; image.decoding = "sync"; image.fetchPriority = "high"; thumb.appendChild(image); } else { const preview = document.createElement("video"); preview.className = "memory-video-preview"; preview.src = fileUrl(item); preview.muted = true; preview.playsInline = true; preview.preload = "auto"; preview.loading = "eager"; preview.setAttribute("aria-label", `${item.title} video preview`); preview.addEventListener("loadeddata", () => { preview.currentTime = Math.min(0.1, preview.duration || 0); }, { once: true }); preview.addEventListener("error", () => { preview.remove(); thumb.insertAdjacentHTML("afterbegin", '<span class="visual-placeholder">a moving<br>memory</span>'); }, { once: true }); thumb.appendChild(preview); } } else { thumb.innerHTML = `<span class="visual-placeholder">${item.type === "audio" ? "♫" : "a moving<br>memory"}</span>`; }
  if (item.type === "video") { const play = document.createElement("span"); play.className = "memory-play"; play.textContent = "▶"; thumb.appendChild(play); } else if (item.type === "audio") { const music = document.createElement("span"); music.className = "memory-play"; music.textContent = "♫"; thumb.appendChild(music); }
  const copy = document.createElement("div"); copy.className = "memory-copy"; copy.innerHTML = "<h3></h3><p></p>"; copy.querySelector("h3").textContent = item.title; copy.querySelector("p").textContent = `${item.type === "video" ? "moving moment" : item.type === "audio" ? "music memory" : "photograph"} · ${new Date(item.addedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
  const menu = document.createElement("button"); menu.className = "memory-menu"; menu.type = "button"; menu.textContent = "···"; menu.setAttribute("aria-label", `Options for ${item.title}`);
  const actions = document.createElement("div"); actions.className = "memory-actions"; actions.hidden = true;
  [["Rename", "rename"], [item.favorite ? "Remove favorite" : "Make a favorite", "favorite"], ...(item.type === "photo" || item.type === "video" ? [["Set as hero", "hero"]] : []), ["Delete", "delete"]].forEach(([label, action]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.action = action; actions.appendChild(button); });
  menu.addEventListener("click", event => { event.stopPropagation(); actions.hidden = !actions.hidden; }); actions.addEventListener("click", event => { event.stopPropagation(); manageCard(event, item); }); card.append(thumb, copy, menu, actions); card.addEventListener("click", () => openViewer(item)); return card;
}
async function manageCard(event, item) { const action = event.target.dataset.action; if (!action) return; if (action === "rename") { state.editingItem = item; state.pendingFiles = []; $("#dialog-heading").textContent = "Give it a new title."; $("#dialog-file").textContent = `Renaming “${item.title}”`; $("#memory-title").value = item.title; $("#title-dialog").hidden = false; $("#memory-title").focus(); } if (action === "favorite") { item.favorite = !item.favorite; await updateItem(item); await cloudUpdate(item); await refresh(); } if (action === "hero") { localStorage.setItem("hero-cover-id", item.id); renderHeroCover(); showToast("This photo is now your favorite chapter."); } if (action === "delete" && confirm("Delete this memory?")) { state.items = state.items.filter(candidate => candidate !== item); revokeItemUrls(item.id); if (String(localStorage.getItem("hero-cover-id")) === String(item.id)) localStorage.removeItem("hero-cover-id"); render(); try { await removeItem(item.id); await cloudDelete(item); await refresh(); } catch { showToast("It disappeared here, but cloud deletion needs another try."); } } }
function openViewer(item) { const viewer = $("#viewer"); const content = $("#viewer-content"); content.innerHTML = ""; $("#viewer-title").textContent = item.title; if (item.type === "video") { const video = document.createElement("video"); video.controls = true; video.autoplay = true; video.muted = false; video.volume = 1; video.src = fileUrl(item); video.addEventListener("ended", playNextReel); content.appendChild(video); viewer.hidden = false; video.play().catch(() => showToast("Press play to hear this memory.")); } else if (item.type === "audio") { const audio = document.createElement("audio"); audio.controls = true; audio.autoplay = true; audio.volume = 1; audio.src = fileUrl(item); content.appendChild(audio); viewer.hidden = false; audio.play().catch(() => showToast("Press play to hear this memory.")); } else { const image = document.createElement("img"); image.src = fileUrl(item); image.alt = item.title; content.appendChild(image); viewer.hidden = false; } }
function closeViewer() { $("#viewer").hidden = true; $("#viewer-content").innerHTML = ""; state.reel = []; }
function playReel() { state.reel = state.items.filter(item => item.type === "video"); state.reelIndex = 0; if (!state.reel.length) { showToast("Add a video to make your little reel."); return; } openViewer(state.reel[0]); }
function playNextReel() { if (state.reelIndex < state.reel.length - 1) { state.reelIndex += 1; openViewer(state.reel[state.reelIndex]); } }
function generateThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let finished = false;
    let timer;
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    function finish(error, blob) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(blob);
    }

    function captureFrame() {
      if (finished || !video.videoWidth || !video.videoHeight) return;
      const width = Math.min(video.videoWidth, 900);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round(width * video.videoHeight / video.videoWidth);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => blob ? finish(null, blob) : finish(new Error("Thumbnail failed")), "image/jpeg", .82);
    }

    video.onerror = () => finish(new Error("Unreadable video"));
    video.onloadedmetadata = () => {
      const target = Number.isFinite(video.duration) ? Math.max(0, video.duration * .1) : 0;
      try { video.currentTime = target; } catch { captureFrame(); }
    };
    video.onloadeddata = () => { if (video.currentTime === 0) captureFrame(); };
    video.onseeked = captureFrame;
    timer = setTimeout(() => {
      if (video.videoWidth && video.videoHeight) captureFrame();
      else finish(new Error("Video preview timed out"));
    }, 8000);
    video.src = url;
    video.load();
  });
}
async function addSelectedFiles(files) { for (const file of files) { const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "photo" : null; if (!type) { showToast(`${file.name} is not a supported photo, video, or audio file.`); continue; } state.pendingFiles = [file]; $("#dialog-file").textContent = file.name; $("#memory-title").value = file.name.replace(/\.[^/.]+$/, ""); $("#title-dialog").hidden = false; $("#memory-title").focus(); await new Promise(resolve => { state.resolveTitle = resolve; }); }
  await refresh(); }
async function savePending() { const title = $("#memory-title").value.trim(); if (!title) return; if (state.editingItem) { state.editingItem.title = title; await updateItem(state.editingItem); try { await cloudUpdate(state.editingItem); } catch { showToast("Renamed here, but the shared copy could not be updated."); } state.editingItem = null; $("#title-dialog").hidden = true; $("#dialog-heading").textContent = "Give it a little title."; await refresh(); return; } const file = state.pendingFiles[0]; if (!file) return; const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "photo"; const submit = $("#dialog-submit"); submit.disabled = true; submit.textContent = type === "video" ? "Preparing memory..." : "Saving memory..."; let thumbnail = null; if (type === "video") { try { thumbnail = await generateThumbnail(file); } catch { showToast("Preview unavailable; saving the original video instead."); } } const item = { file, thumbnail, title, type, favorite: false, addedAt: Date.now() }; try { if (cloudEnabled) { try { Object.assign(item, await cloudAdd(item)); } catch { showToast("Shared upload failed; keeping this memory on this device."); } } await addItem(item); } catch { showToast("This memory could not be saved."); } state.pendingFiles = []; $("#title-dialog").hidden = true; $("#dialog-heading").textContent = "Give it a little title."; submit.disabled = false; submit.textContent = "Save memory ↗"; state.resolveTitle?.(); state.resolveTitle = null; await refresh(); }
async function refresh() { const localItems = await getAll(); let sharedItems = []; try { sharedItems = await cloudItems(); } catch { if (cloudEnabled) showToast("Shared memories are temporarily unavailable."); } const sharedIds = new Set(sharedItems.map(item => item.cloudId)); const local = localItems.filter(item => !item.cloudId || !sharedIds.has(item.cloudId)); state.items = [...sharedItems, ...local].sort((a, b) => b.addedAt - a.addedAt); render(); }

$("#add-media").addEventListener("click", () => $("#file-input").click()); $("#add-memory-secondary").addEventListener("click", () => $("#file-input").click()); $("#empty-add").addEventListener("click", () => $("#file-input").click()); $("#file-input").addEventListener("change", event => { if (event.target.files.length) addSelectedFiles([...event.target.files]); event.target.value = ""; }); $("#dialog-submit").addEventListener("click", savePending); $("#dialog-cancel").addEventListener("click", () => { $("#title-dialog").hidden = true; state.pendingFiles = []; state.editingItem = null; $("#dialog-heading").textContent = "Give it a little title."; state.resolveTitle?.(); state.resolveTitle = null; }); $("#memory-title").addEventListener("keydown", event => { if (event.key === "Enter") savePending(); }); $("#viewer-close").addEventListener("click", closeViewer); $("#play-hero").addEventListener("click", playReel);
document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => { state.filter = button.dataset.filter; document.querySelectorAll(".filter").forEach(tab => tab.classList.toggle("active", tab === button)); render(); }));
document.addEventListener("keydown", event => { if (event.key === "Escape") { closeViewer(); $("#title-dialog").hidden = true; } });
$("#footer-year").textContent = new Date().getFullYear(); refresh().catch(() => showToast("Your browser could not open local memory storage."));