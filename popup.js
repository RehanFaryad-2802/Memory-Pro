// DOM helpers
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* Elements */
const memoryListEl = $("#memoryList");
const addBtn = $("#addBtn");
const newText = $("#newText");
const newTag = $("#newTag");
const pinOnAdd = $("#pinOnAdd");
const clearAllBtn = $("#clearAll");
const searchInput = $("#search");
const exportBtn = $("#exportBtn");
const exportSelBtn = $("#exportSelBtn");
const importBtn = $("#importBtn");
const importFile = $("#importFile");
const duplicateBtn = $("#duplicateBtn");
const mergeBtn = $("#mergeBtn");
const tagBar = $("#tagBar");
const viewToggle = $("#viewToggle");
const groupToggle = $("#groupToggle");
const listContainer = $("#listContainer");
const settingsBtn = $("#settingsBtn");
const settingsModal = $("#settingsModal");
const closeSettings = $("#closeSettings");
const saveSettings = $("#saveSettings");
const themeSelect = $("#themeSelect");
const accentColor = $("#accentColor");
const fontSizeInput = $("#fontSize");
const captureVisible = $("#captureVisible");
const captureFullPage = $("#captureFullPage");
const screenshotFile = $("#screenshotFile");

/* state */
let activeTag = null;
let listView = true; // list by default
let groupBy = null; // 'tag' | 'date' | null
let settings = { theme: "gradient", accent: "#2ea6ff", fontSize: 13 };

/* utils */
function uid(){ return Date.now().toString()+Math.floor(Math.random()*1000); }
function randomColor(){ const h = Math.floor(Math.random()*360); const s = 60+Math.floor(Math.random()*20); const l = 45+Math.floor(Math.random()*10); return `hsl(${h} ${s}% ${l}%)`; }
function formatDate(iso){ return new Date(iso).toLocaleString(); }
function applySettings(){ document.documentElement.style.setProperty('--accent', settings.accent); document.documentElement.style.setProperty('--font-size', settings.fontSize+'px'); if(settings.theme==='light'){ document.body.style.background='linear-gradient(135deg,#f4f7fb,#e9eef7)'; document.body.style.color='#111'; } else if(settings.theme==='dark'){ document.body.style.background='linear-gradient(135deg,#050607,#0b0c0d)'; document.body.style.color='#e6eef6'; } else { document.body.style.background='linear-gradient(135deg,var(--bg1),var(--bg2))'; document.body.style.color='#e6eef6'; } }

/* storage helpers */
function getMemory(cb){ chrome.storage.local.get({ memory: [] , settings:{} }, res => { if(res.settings) settings = Object.assign(settings, res.settings); cb(res.memory || []); }); }
function setMemory(memory, cb){ chrome.storage.local.set({ memory }, ()=> cb && cb()); }
function saveSettingsToStorage(){ chrome.storage.local.set({ settings }, () => applySettings()); }

/* detection & auto-tagging */
function detectType(text){
  const t = text.trim();
  const urlRegex = /^https?:\/\/[^\s]+$/i;
  if(urlRegex.test(t)){ try{ const u=new URL(t); return { type:'url', meta:{ title:t, favicon:`https://www.google.com/s2/favicons?domain=${u.hostname}` } }; }catch(e){} }
  const codeKeywords=["function","const","let","var","=>","console.log","class","{","}",";"];
  if(codeKeywords.some(k => t.includes(k))) return { type:'code', meta:{} };
  return { type:'text', meta:{} };
}
const autoTagMap = {
  "code":["function","console.log","var ","let ","const ","class","=>"],
  "link":["http://","https://","www."],
  "todo":["todo","fix","task","later","remember"],
  "idea":["idea","brainstorm","concept","plan"]
};
function autoTagForText(text) {
  const detected = new Set();
  const lower = text.trim().toLowerCase();

  // URL Detection (matches your existing logic)
  if (/^(https?:\/\/|www\.)/.test(lower)) {
    detected.add("URL");
  }

  // Code Detection - Broad language support
  if (/(function|const|var|import |<[a-z]|\.\w+\s*\{|def |#include)/.test(lower)) {
    detected.add("Code");
  }

  // Smart content categorization
  if (/(note:|tip:|info:|\[info\])/.test(lower)) detected.add("Info");
  if (/(tutorial|docs?|manual|reference)/.test(lower)) detected.add("Reference");
  if (/(part \d|episode|season|chapter)/.test(lower)) detected.add("Series");

  return Array.from(detected);
}

/* rendering */
function renderTagBar(allItems){
  const tags = new Set();
  allItems.forEach(i => (i.tags||[]).forEach(t => tags.add(t)));
  tagBar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'tag-btn' + (activeTag===null ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => { activeTag=null; loadMemory(); Array.from(tagBar.children).forEach(c=>c.classList.remove('active')); allBtn.classList.add('active'); });
  tagBar.appendChild(allBtn);
  Array.from(tags).sort().forEach(t=>{
    const b = document.createElement('button');
    b.className = 'tag-btn' + (activeTag===t ? ' active' : '');
    b.textContent = t;
    b.addEventListener('click', ()=>{ activeTag = t; Array.from(tagBar.children).forEach(c=>c.classList.remove('active')); b.classList.add('active'); loadMemory(); });
    tagBar.appendChild(b);
  });
}

function renderList(items){
  memoryListEl.innerHTML = '';
  if(!items.length){ memoryListEl.innerHTML = `<div style="color:var(--muted); text-align:center; padding:16px">No saved items</div>`; return; }

  // grouping if needed
  if(groupBy === 'tag'){
    const groups = {};
    items.forEach(it => (it.tags||['untitled']).forEach(t=>{ groups[t] = groups[t]||[]; groups[t].push(it); }));
    for(const [tag, group] of Object.entries(groups)){
      const header = document.createElement('div'); header.className='group-header';
      header.innerHTML = `<strong>${tag}</strong> <button class="action-btn" data-tag="${tag}">Toggle</button>`;
      const ul = document.createElement('ul'); ul.className='group-list';
      group.forEach(it => ul.appendChild(renderItem(it)));
      const liWrap = document.createElement('li'); liWrap.appendChild(header); liWrap.appendChild(ul);
      memoryListEl.appendChild(liWrap);
    }
    return;
  }

  // no grouping
  items.forEach(it => memoryListEl.appendChild(renderItem(it)));
}

function renderItem(item){
  const li = document.createElement('li');
  li.className = 'memory-item';
  li.dataset.id = item.id;
  li.dataset.type = item.type || 'text';

  // toolbar
  const toolbar = document.createElement('div'); toolbar.className='item-toolbar';
  const left = document.createElement('div'); left.className='toolbar-left';
  const right = document.createElement('div'); right.className='item-actions';

  const pill = document.createElement('div'); pill.className='color-pill'; pill.style.background = item.color || randomColor();
  left.appendChild(pill);

  const meta = document.createElement('div'); meta.className='item-meta'; meta.textContent = formatDate(item.created);
  left.appendChild(meta);

  // actions
  const selChk = document.createElement('input'); selChk.type='checkbox'; selChk.className='select-item';
  selChk.style.marginRight='6px';
  right.appendChild(selChk);

  const copyBtn = actionBtn('📋','Copy', ()=> navigator.clipboard.writeText(item.text).catch(()=>{}) );
  right.appendChild(copyBtn);

  const editBtn = actionBtn('✏️','Edit', ()=> startEdit(item.id));
  right.appendChild(editBtn);

  const pinBtn = actionBtn(item.pinned ? '📌' : '📍','Pin', ()=> togglePin(item.id));
  if(item.pinned) pinBtn.classList.add('active');
  right.appendChild(pinBtn);

  const delBtn = actionBtn('❌','Delete', ()=> deleteItem(item.id));
  right.appendChild(delBtn);

  if (item.meta?.sourceUrl) {
    const sourceBtn = actionBtn('🌐', 'Open Source', () => chrome.tabs.create({url: item.meta.sourceUrl}));
    right.insertBefore(sourceBtn, right.children[1]); // Insert after first child
  }

  toolbar.appendChild(left); toolbar.appendChild(right);

  // body
  const body = document.createElement('div');
  if(item.type === 'url'){
    const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    const fav = document.createElement('img'); fav.src = (item.meta && item.meta.favicon) ? item.meta.favicon : 'icon.png'; fav.width=20; fav.height=20; fav.style.borderRadius='4px';
    const a = document.createElement('a'); a.href = item.text; a.textContent = item.meta && item.meta.title ? item.meta.title : item.text; a.target='_blank'; a.style.color='var(--accent)';
    wrap.appendChild(fav); wrap.appendChild(a); body.appendChild(wrap);
    const p = document.createElement('p'); p.className='item-text'; p.textContent = item.text; body.appendChild(p);
  } else if(item.type === 'code'){
    const pre = document.createElement('pre'); const code = document.createElement('code'); code.innerHTML = window.SimpleHighlighter.highlight(item.text); pre.appendChild(code); body.appendChild(pre);
  } else {
  const p = document.createElement('p');
  p.className = 'item-text';
  p.textContent = item.text;
  body.appendChild(p);
  
  // Add source URL if available
  if (item.meta?.sourceUrl) {
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'source-indicator';
    sourceDiv.innerHTML = `
      <span>Saved from:</span>
      <a href="${item.meta.sourceUrl}" target="_blank">${new URL(item.meta.sourceUrl).hostname}</a>
    `;
    body.appendChild(sourceDiv);
  }}
  if (item.type === 'image') {

    // Image preview container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    
    // Clickable thumbnail
    const img = document.createElement('img');
    img.src = item.meta.imageData;
    img.className = 'image-thumbnail';
    img.addEventListener('click', () => showFullscreenImage(item.meta.imageData));
    
    // Optional caption
    const caption = document.createElement('p');
    caption.className = 'image-caption';
    caption.textContent = item.text || 'Screenshot';
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(caption);
    body.appendChild(imgContainer);
  } 

  // tags
  const tagWrap = document.createElement('div'); tagWrap.className = 'item-tags';
  (item.tags || []).forEach(t => { const tg = document.createElement('div'); tg.className='tag'; tg.textContent = t; tg.addEventListener('click', ()=> { activeTag = t; loadMemory(); Array.from(tagBar.children).forEach(c=>c.classList.remove('active')); const btn = Array.from(tagBar.children).find(b=>b.textContent===t); if(btn) btn.classList.add('active'); }); tagWrap.appendChild(tg); });

  li.appendChild(toolbar); li.appendChild(body); li.appendChild(tagWrap);
  return li;
}

function actionBtn(symbol, title, cb){
  const b = document.createElement('button'); b.className='action-btn'; b.title=title; b.innerText=symbol; b.addEventListener('click', cb); return b;
}

/* load & filters */
function loadMemory(){
  getMemory(list => {
    // sort: pinned first then date desc
    list.sort((a,b) => (b.pinned - a.pinned) || (new Date(b.created) - new Date(a.created)));
    // filter by search
    const q = searchInput.value.trim().toLowerCase();
    let filtered = list.filter(i => {
      const inText = i.text.toLowerCase().includes(q);
      const inTags = (i.tags||[]).some(t => t.toLowerCase().includes(q));
      return q ? (inText || inTags) : true;
    });
    // filter by activeTag
    if(activeTag) filtered = filtered.filter(i => (i.tags||[]).includes(activeTag));
    // render
    renderTagBar(list);
    renderList(filtered);
  });
}

/* CRUD operations */
addBtn.addEventListener('click', ()=>{
  const text = newText.value.trim();
  if(!text) return;
  const tagsInput = newTag.value.trim();
  const userTags = tagsInput ? tagsInput.split(',').map(t=>t.trim()).filter(Boolean) : [];
  const auto = autoTagForText(text);
  const tags = Array.from(new Set([...(userTags.length ? userTags : ['untitled']), ...auto]));
  const detected = detectType(text);
  const item = { id: uid(), text, created: new Date().toISOString(), color: randomColor(), pinned: pinOnAdd.checked, tags, type: detected.type, meta: detected.meta||{}, versions: [] };
  getMemory(list => { setMemory([item, ...list], ()=>{ newText.value=''; newTag.value=''; pinOnAdd.checked=false; loadMemory(); }); });
});

/* delete single */
function deleteItem(id){
  if(!confirm('Delete this item?')) return;
  getMemory(list => { setMemory(list.filter(i=>i.id!==id), ()=>loadMemory()); });
}

/* toggle pin */
function togglePin(id){
  getMemory(list => {
    const upd = list.map(i => i.id===id ? {...i, pinned: !i.pinned} : i);
    setMemory(upd, ()=> loadMemory());
  });
}

/* duplicate */
function duplicateItem(id){
  getMemory(list => {
    const it = list.find(i => i.id === id); if(!it) return;
    const copy = {...it, id: uid(), created: new Date().toISOString()};
    setMemory([copy, ...list], ()=> loadMemory());
  });
}

/* start inline edit */
function startEdit(id) {
  getMemory(list => {
    const item = list.find(i => i.id===id);
    if(!item) return;
    const li = document.querySelector(`li[data-id='${id}']`);
    if(!li) return;
    const body = li.querySelector('.item-text, pre, .item-text') || li.querySelector('div');
    
    const editor = document.createElement('div');
    editor.setAttribute('data-edit', 'true'); // Add this line
    
    const ta = document.createElement('textarea'); 
    ta.value = item.text; 
    ta.style.width = '100%'; 
    ta.rows = 4;
    
    const tagIn = document.createElement('input'); 
    tagIn.type = 'text'; // Add this line
    tagIn.value = (item.tags||[]).join(', ');
    
    const save = document.createElement('button'); 
    save.className = 'action-btn'; 
    save.innerText = 'Save';
    
    const cancel = document.createElement('button'); 
    cancel.className = 'action-btn'; 
    cancel.innerText = 'Cancel';
    
    // Add actions container
    const actions = document.createElement('div');
    actions.className = 'edit-actions';
    actions.append(save, cancel);
    
    editor.append(ta, tagIn, actions);
    body.replaceWith(editor);
    
    save.addEventListener('click', () => finishEdit(id, ta.value, tagIn.value));
    cancel.addEventListener('click', loadMemory);
  });
}

function finishEdit(id, newTextVal, tagsVal){
  getMemory(list => {
    const updated = list.map(i => {
      if(i.id===id){
        const prev = { text: i.text, date: new Date().toISOString() };
        const versions = i.versions || [];
        versions.unshift(prev);
        const newTags = tagsVal.split(',').map(t=>t.trim()).filter(Boolean);
        return {...i, text: newTextVal, tags: newTags.length ? newTags : ['untitled'], versions};
      }
      return i;
    });
    setMemory(updated, ()=>loadMemory());
  });
}

/* selection helpers for batch actions */
function getSelectedIds(){
  return Array.from(document.querySelectorAll('.select-item')).filter(cb=>cb.checked).map(cb=>{
    const li = cb.closest('li'); return li ? li.dataset.id : null;
  }).filter(Boolean);
}

/* duplicate selected */
duplicateBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds(); if(!ids.length){ alert('No selection'); return; }
  getMemory(list => {
    const copies = [];
    ids.forEach(id => {
      const it = list.find(i=>i.id===id);
      if(it) copies.push({...it, id: uid(), created: new Date().toISOString()});
    });
    setMemory([...copies, ...list], ()=> loadMemory());
  });
});

/* merge selected */
mergeBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds(); if(ids.length < 2){ alert('Select at least 2 items to merge'); return; }
  if(!confirm('Merge selected items into one note? Images will be removed.')) return;
  getMemory(list => {
    const items = ids.map(id => list.find(i=>i.id===id)).filter(Boolean);
    const mergedText = items.map(i=>i.text).join('\n\n---\n\n');
    const mergedTags = Array.from(new Set(items.flatMap(i=>i.tags||[])));
    const merged = { id: uid(), text: mergedText, created: new Date().toISOString(), color: randomColor(), pinned: false, tags: mergedTags.length?mergedTags:['untitled'], type: 'text', meta:{}, versions:[] };
    const remaining = list.filter(i => !ids.includes(i.id));
    setMemory([merged, ...remaining], ()=> loadMemory());
  });
});

/* export selected */
exportSelBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds(); if(!ids.length){ alert('No selection'); return; }
  getMemory(list => {
    const subset = list.filter(i=>ids.includes(i.id));
    const blob = new Blob([JSON.stringify(subset, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`memory-selected-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  });
});

/* export all */
exportBtn.addEventListener('click', ()=>{
  getMemory(list => {
    const blob = new Blob([JSON.stringify(list, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`memory-all-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  });
});

/* import */
importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if(!Array.isArray(imported)) throw new Error('Invalid');
      getMemory(existing => { const merged = [...imported, ...existing]; setMemory(merged.slice(0,5000), ()=> loadMemory()); });
    } catch(err){ alert('Import failed'); }
  };
  reader.readAsText(f); importFile.value='';
});

/* clear all */
clearAllBtn.addEventListener('click', ()=> { if(confirm('Delete all saved items?')) setMemory([], ()=> loadMemory()); });

/* search/filter events */
searchInput.addEventListener('input', ()=> loadMemory());

/* view toggle */
viewToggle.addEventListener('click', ()=>{
  listView = !listView;
  if(listView){ listContainer.classList.remove('grid-view'); listContainer.classList.add('list-view'); } else { listContainer.classList.remove('list-view'); listContainer.classList.add('grid-view'); }
});

/* group toggle */
groupToggle.addEventListener('click', ()=> {
  if(groupBy === null) groupBy = 'tag';
  else groupBy = null;
  loadMemory();
});


/* initial load & apply settings */
document.addEventListener('DOMContentLoaded', ()=>{
  getMemory(()=>{ applySettings(); loadMemory(); });
});
document.getElementById('openInTabBtn').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("popup.html") + 
         `?text=${encodeURIComponent(newText.value)}` +
         `&tags=${encodeURIComponent(newTag.value)}`
  });
});


// Save function
function saveScreenshot(dataUrl, captureType) {
  const newItem = {
    id: uid(),
    text: `Screenshot (${captureType}) ${new Date().toLocaleString()}`,
    created: new Date().toISOString(),
    color: randomColor(),
    pinned: false,
    tags: ["Content"],
    type: "image",
    meta: {
      imageData: dataUrl,
      sourceUrl: window.location.href
    },
    versions: []
  };

  getMemory(list => {
    setMemory([newItem, ...list], () => {
      loadMemory();
      screenshotFile.value = ''; // Reset file input
    });
  });
}


// Fullscreen view
function showFullscreenImage(src) {
  const modal = document.createElement("div");
  modal.id = "imageModal";
  modal.innerHTML = `<img src="${src}">`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}
function showFullscreenImage(imageSrc) {
  const viewer = document.createElement('div');
  viewer.id = 'image-viewer';
  
  viewer.innerHTML = `
    <img src="${imageSrc}" alt="Fullscreen screenshot">
    <button class="close-btn">×</button>
  `;
  
  viewer.querySelector('.close-btn').addEventListener('click', () => {
    viewer.remove();
  });
  
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) viewer.remove();
  });
  
  document.body.appendChild(viewer);
  
  // Close with Escape key
  document.addEventListener('keydown', function closeOnEscape(e) {
    if (e.key === 'Escape') {
      viewer.remove();
      document.removeEventListener('keydown', closeOnEscape);
    }
  });
}