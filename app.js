const App = (() => {
  const STORE_KEY = 'cardforge_data';
  const VERSION = 1;

  function defaultState() {
    return {
      characters: [],
      worldInfos: [],
      scenarios: [],
      personas: [],
      settings: { spec: 'v2' }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('Failed to load state', e); }
    return defaultState();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Failed to save', e); }
  }

  let state = load();
  let currentTab = 'characters';
  let editing = null;

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function nl2br(str) { return esc(str || '').replace(/\n/g, '<br>'); }

  return {
    state, genId, toast, esc, save, nl2br, currentTab, editing
  };
})();

function switchTab(tab) {
  App.currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
  renderCurrentList();
}

function renderCurrentList() {
  const t = App.currentTab;
  if (t === 'characters') renderCharacterList();
  else if (t === 'worldinfo') renderWorldInfoList();
  else if (t === 'scenarios') renderScenarioList();
  else if (t === 'personas') renderPersonaList();
}

// ── CHARACTERS ──────────────────────────────────────────────────────

function newCharData(spec) {
  const now = new Date().toISOString();
  if (spec === 'nexus') {
    return {
      _format: 'nexus-chara',
      name: '', desc: '', prompt: '', intro: '',
      authorsNote: '', creatorNotes: '', sourceUrl: '',
      tags: [], alternateGreetings: [], lorebook: [],
      tavernExtensions: { depth_prompt: { prompt: '', depth: 4, role: 'system' } },
      memory: [],
      avatar: null, bg: null, model: ''
    };
  }
  const base = {
    spec: spec === 'v3' ? 'chara_card_v3' : 'chara_card_v2',
    spec_version: spec === 'v3' ? '3.0' : '2.0',
    data: {
      name: '', description: '', personality: '', scenario: '',
      first_mes: '', mes_example: '', creator_notes: '',
      system_prompt: '', post_history_instructions: '',
      alternate_greetings: [], tags: [], creator: '',
      character_version: '1.0', extensions: {
        talkativeness: 0.7, fav: false, world: '',
        depth_prompt: { prompt: '', depth: 4, role: 'system' }
      }
    }
  };
  if (spec === 'v3') {
    base.data.assets = [];
    base.data.nickname = '';
    base.data.group_only_greetings = [];
    base.data.creation_date = Math.floor(Date.now() / 1000);
    base.data.modification_date = Math.floor(Date.now() / 1000);
  }
  return base;
}

function createCharacter() {
  const spec = document.getElementById('char-spec-select').value;
  const char = newCharData(spec);
  char.id = App.genId();
  char._cardSpec = spec;
  char._avatar = null;
  App.state.characters.push(char);
  App.save();
  renderCharacterList();
  editCharacter(char.id);
}

function renderCharacterList() {
  const el = document.getElementById('character-list');
  const chars = App.state.characters;
  if (!chars.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9733;</div><div class="empty-state-text">No characters yet</div><button class="btn btn-primary" onclick="createCharacter()">Create your first character</button></div>';
    return;
  }
  el.innerHTML = chars.map(c => {
    const name = c.data?.name || c.name || 'Untitled';
    const desc = c.data?.description || c.desc || '';
    const tags = c.data?.tags || c.tags || [];
    const specLabel = c._cardSpec === 'nexus' ? 'HordeStudio' : c._cardSpec === 'v3' ? 'CCv3' : 'CCv2';
    const avatar = c._avatar;
    return `<div class="card-item" onclick="editCharacter('${c.id}')">
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();duplicateCharacter('${c.id}')" title="Duplicate">&#9752;</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportCharacter('${c.id}')" title="Export">&#8681;</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="event.stopPropagation();deleteCharacter('${c.id}')" title="Delete">&#10005;</button>
      </div>
      <div class="card-item-header">
        <div class="card-avatar">${avatar ? `<img src="${avatar}" alt="">` : App.esc(name[0] || '?')}</div>
        <div><div class="card-title">${App.esc(name)}</div><div class="card-meta">${specLabel}</div></div>
      </div>
      <div class="card-desc">${App.esc(desc.substring(0, 200))}</div>
      ${tags.length ? `<div class="card-tags">${tags.slice(0, 5).map(t => `<span class="tag">${App.esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

function deleteCharacter(id) {
  if (!confirm('Delete this character?')) return;
  App.state.characters = App.state.characters.filter(c => c.id !== id);
  App.save();
  renderCharacterList();
}

function duplicateCharacter(id) {
  const orig = App.state.characters.find(c => c.id === id);
  if (!orig) return;
  const dupe = JSON.parse(JSON.stringify(orig));
  dupe.id = App.genId();
  dupe.data.name = (dupe.data?.name || dupe.name || 'Untitled') + ' (Copy)';
  App.state.characters.push(dupe);
  App.save();
  renderCharacterList();
  toast('Character duplicated');
}

function exportCharacter(id) {
  const char = App.state.characters.find(c => c.id === id);
  if (!char) return;
  const spec = char._cardSpec || 'v2';
  if (spec === 'nexus') {
    downloadJSON(char, (char.data?.name || char.name || 'character') + '.nexus', 'nexus');
  } else {
    const v2Data = { spec: char.spec, spec_version: char.spec_version, data: { ...char.data } };
    PNGUtil.createPNGWithCharacter(v2Data).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (char.data?.name || 'character') + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Exported as PNG with embedded metadata');
    });
  }
}

// ── CHARACTER EDITOR ────────────────────────────────────────────────

function editCharacter(id) {
  const char = App.state.characters.find(c => c.id === id);
  if (!char) return;
  App.editing = { type: 'character', id };
  const spec = char._cardSpec || 'v2';
  const panel = document.getElementById('editor-body');
  const title = document.getElementById('editor-title');
  title.textContent = spec === 'nexus' ? 'Edit Character (HordeStudio)' : spec === 'v3' ? 'Edit Character (CCv3)' : 'Edit Character (CCv2)';

  const d = char.data || char;
  const name = d.name || '';
  const desc = d.description || d.desc || '';
  const personality = d.personality || '';
  const scenario = d.scenario || '';
  const firstMes = d.first_mes || d.intro || '';
  const mesExample = d.mes_example || '';
  const creatorNotes = d.creator_notes || d.creatorNotes || '';
  const systemPrompt = d.system_prompt || d.prompt || '';
  const postHistory = d.post_history_instructions || d.authorsNote || '';
  const altGreetings = d.alternate_greetings || d.alternateGreetings || [];
  const tags = d.tags || [];
  const creator = d.creator || '';
  const charVersion = d.character_version || '';
  const talkativeness = d.extensions?.talkativeness ?? 0.7;
  const depthPrompt = d.extensions?.depth_prompt?.prompt || d.tavernExtensions?.depth_prompt?.prompt || '';
  const depthValue = d.extensions?.depth_prompt?.depth || d.tavernExtensions?.depth_prompt?.depth || 4;
  const depthRole = d.extensions?.depth_prompt?.role || d.tavernExtensions?.depth_prompt?.role || 'system';

  let html = `
    <div class="avatar-upload">
      <div class="avatar-preview" onclick="triggerAvatarUpload()">
        ${char._avatar ? `<img src="${char._avatar}" id="avatar-img">` : '<span class="placeholder">+</span>'}
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-secondary)">Click to upload avatar</div>
        <div class="field-hint">Recommended: 512×512 PNG</div>
      </div>
      <input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="handleAvatarUpload(event)">
    </div>

    <div class="section-divider">Core Identity</div>

    <div class="field">
      <label class="field-label">Name</label>
      <input type="text" id="ed-name" value="${App.esc(name)}" placeholder="Character name" oninput="autoSaveCharacter()">
    </div>

    <div class="field">
      <label class="field-label">Description</label>
      <textarea id="ed-desc" class="large" placeholder="Detailed character description. Use {{char}} and {{user}} macros." oninput="autoSaveCharacter()">${App.esc(desc)}</textarea>
      <div class="field-hint">This is injected into every prompt. Use ${App.esc('{{char}}')} for character name and ${App.esc('{{user}}')} for user name.</div>
    </div>

    <div class="field">
      <label class="field-label">Personality</label>
      <textarea id="ed-personality" placeholder="Brief personality summary (e.g. cheerful, witty, aloof)" oninput="autoSaveCharacter()">${App.esc(personality)}</textarea>
    </div>

    <div class="field">
      <label class="field-label">Scenario</label>
      <textarea id="ed-scenario" placeholder="Current context / circumstances of the character" oninput="autoSaveCharacter()">${App.esc(scenario)}</textarea>
    </div>

    <div class="section-divider">Messages</div>

    <div class="field">
      <label class="field-label">First Message</label>
      <textarea id="ed-firstmes" class="large" placeholder="The character's opening greeting" oninput="autoSaveCharacter()">${App.esc(firstMes)}</textarea>
    </div>

    <div class="field">
      <label class="field-label">Example Messages</label>
      <textarea id="ed-mesexample" class="large mono" placeholder="Example dialogue separated by <START> tags" oninput="autoSaveCharacter()">${App.esc(mesExample)}</textarea>
      <div class="field-hint">Format: &lt;START&gt;${App.esc('{{char}}')}: Hello! ... ${App.esc('{{user}}')}: Hi there! ...</div>
    </div>

    <div class="field">
      <label class="field-label">Alternate Greetings</label>
      <div id="ed-altgreetings" class="list-container">
        ${altGreetings.map((g, i) => `<div class="list-item">
          <div class="list-item-content"><textarea rows="2" oninput="updateAltGreeting(${i}, this.value)">${App.esc(g)}</textarea></div>
          <div class="list-item-actions"><button class="btn btn-ghost btn-sm btn-danger" onclick="removeAltGreeting(${i})">&#10005;</button></div>
        </div>`).join('')}
        <button class="list-add-btn" onclick="addAltGreeting()">+ Add Alternate Greeting</button>
      </div>
      <div class="field-hint">Additional greeting variations shown as swipes on first message.</div>
    </div>

    <div class="section-divider">System & Instructions</div>

    <div class="field">
      <label class="field-label">System Prompt</label>
      <textarea id="ed-systemprompt" class="large" placeholder="Replaces the user's global system prompt. Leave empty to keep default. Use ${App.esc('{{original}}')} to include original." oninput="autoSaveCharacter()">${App.esc(systemPrompt)}</textarea>
    </div>

    <div class="field">
      <label class="field-label">Post History Instructions (UJB)</label>
      <textarea id="ed-posthistory" class="large" placeholder="Appended after the last message. Leave empty for default." oninput="autoSaveCharacter()">${App.esc(postHistory)}</textarea>
    </div>

    <div class="section-divider">Depth Prompt</div>

    <div class="field-row-3">
      <div class="field">
        <label class="field-label">Depth Prompt</label>
        <input type="text" id="ed-depthprompt" value="${App.esc(depthPrompt)}" placeholder="System prompt at depth" oninput="autoSaveCharacter()">
      </div>
      <div class="field">
        <label class="field-label">Depth</label>
        <input type="number" id="ed-depthvalue" value="${depthValue}" min="0" max="100" oninput="autoSaveCharacter()">
      </div>
      <div class="field">
        <label class="field-label">Role</label>
        <select id="ed-depthrole" onchange="autoSaveCharacter()">
          <option value="system" ${depthRole === 'system' ? 'selected' : ''}>System</option>
          <option value="user" ${depthRole === 'user' ? 'selected' : ''}>User</option>
          <option value="assistant" ${depthRole === 'assistant' ? 'selected' : ''}>Assistant</option>
        </select>
      </div>
    </div>

    <div class="section-divider">Metadata</div>

    <div class="field">
      <label class="field-label">Tags</label>
      <input type="text" id="ed-tags" value="${App.esc(tags.join(', '))}" placeholder="Comma-separated tags" oninput="autoSaveCharacter()">
    </div>

    <div class="field-row">
      <div class="field">
        <label class="field-label">Creator</label>
        <input type="text" id="ed-creator" value="${App.esc(creator)}" placeholder="Your name" oninput="autoSaveCharacter()">
      </div>
      <div class="field">
        <label class="field-label">Version</label>
        <input type="text" id="ed-charversion" value="${App.esc(charVersion)}" placeholder="1.0" oninput="autoSaveCharacter()">
      </div>
    </div>

    <div class="field">
      <label class="field-label">Creator Notes</label>
      <textarea id="ed-creatornotes" placeholder="Notes about the character (never shown in prompts)" oninput="autoSaveCharacter()">${App.esc(creatorNotes)}</textarea>
    </div>

    <div class="section-divider">Talkativeness</div>
    <div class="field">
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" id="ed-talkativeness" min="0" max="1" step="0.05" value="${talkativeness}" oninput="document.getElementById('talk-val').textContent=this.value;autoSaveCharacter()" style="flex:1">
        <span id="talk-val" style="min-width:30px;text-align:right;font-size:13px;color:var(--text-secondary)">${talkativeness}</span>
      </div>
      <div class="field-hint">Controls how much the character speaks vs acts. 0 = very quiet, 1 = very chatty.</div>
    </div>

    <div class="section-divider">Export</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="doExportCharacter('png-v2')">Export as PNG (CCv2)</button>
      <button class="btn btn-primary" onclick="doExportCharacter('png-v3')">Export as PNG (CCv3)</button>
      <button class="btn btn-primary" onclick="doExportCharacter('json-v2')">Export as JSON (CCv2)</button>
      <button class="btn btn-primary" onclick="doExportCharacter('json-v3')">Export as JSON (CCv3)</button>
      <button class="btn btn-primary" onclick="doExportCharacter('nexus')">Export as .nexus</button>
    </div>
  `;

  panel.innerHTML = html;
  document.getElementById('editor-overlay').classList.remove('hidden');
}

function autoSaveCharacter() {
  if (!App.editing || App.editing.type !== 'character') return;
  const char = App.state.characters.find(c => c.id === App.editing.id);
  if (!char) return;
  const spec = char._cardSpec || 'v2';

  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };

  if (spec === 'nexus') {
    char.name = val('ed-name');
    char.desc = val('ed-desc');
    char.intro = val('ed-firstmes');
    char.prompt = [val('ed-personality'), val('ed-scenario'), val('ed-mesexample'), val('ed-systemprompt'), val('ed-posthistory')].filter(Boolean).join('\n\n');
    char.creatorNotes = val('ed-creatornotes');
    char.authorsNote = val('ed-depthprompt');
    char.tags = val('ed-tags').split(',').map(s => s.trim()).filter(Boolean);
    char.tavernExtensions.depth_prompt = {
      prompt: val('ed-depthprompt'),
      depth: parseInt(val('ed-depthvalue')) || 4,
      role: val('ed-depthrole')
    };
  } else {
    char.data.name = val('ed-name');
    char.data.description = val('ed-desc');
    char.data.personality = val('ed-personality');
    char.data.scenario = val('ed-scenario');
    char.data.first_mes = val('ed-firstmes');
    char.data.mes_example = val('ed-mesexample');
    char.data.system_prompt = val('ed-systemprompt');
    char.data.post_history_instructions = val('ed-posthistory');
    char.data.creator_notes = val('ed-creatornotes');
    char.data.creator = val('ed-creator');
    char.data.character_version = val('ed-charversion');
    char.data.tags = val('ed-tags').split(',').map(s => s.trim()).filter(Boolean);
    char.data.extensions.talkativeness = parseFloat(val('ed-talkativeness')) || 0.7;
    char.data.extensions.depth_prompt = {
      prompt: val('ed-depthprompt'),
      depth: parseInt(val('ed-depthvalue')) || 4,
      role: val('ed-depthrole')
    };
    if (spec === 'v3') {
      char.data.modification_date = Math.floor(Date.now() / 1000);
    }
  }
  App.save();
  renderCharacterList();
}

function addAltGreeting() {
  const char = App.state.characters.find(c => c.id === App.editing?.id);
  if (!char) return;
  const greetings = char.data?.alternate_greetings || char.alternateGreetings || [];
  greetings.push('');
  if (char.data) char.data.alternate_greetings = greetings;
  else char.alternateGreetings = greetings;
  App.save();
  editCharacter(char.id);
}

function removeAltGreeting(index) {
  const char = App.state.characters.find(c => c.id === App.editing?.id);
  if (!char) return;
  const greetings = char.data?.alternate_greetings || char.alternateGreetings || [];
  greetings.splice(index, 1);
  App.save();
  editCharacter(char.id);
}

function updateAltGreeting(index, value) {
  const char = App.state.characters.find(c => c.id === App.editing?.id);
  if (!char) return;
  const greetings = char.data?.alternate_greetings || char.alternateGreetings || [];
  greetings[index] = value;
  App.save();
}

function triggerAvatarUpload() {
  document.getElementById('avatar-input')?.click();
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const char = App.state.characters.find(c => c.id === App.editing?.id);
    if (char) { char._avatar = reader.result; App.save(); }
    const img = document.getElementById('avatar-img');
    if (img) img.src = reader.result;
    else {
      const preview = document.querySelector('.avatar-preview');
      if (preview) preview.innerHTML = `<img src="${reader.result}" id="avatar-img">`;
    }
  };
  reader.readAsDataURL(file);
}

function doExportCharacter(format) {
  const char = App.state.characters.find(c => c.id === App.editing?.id);
  if (!char) return;
  const name = (char.data?.name || char.name || 'character').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'nexus') {
    downloadJSON(char, name + '.nexus', 'nexus');
    return;
  }

  const v2Data = {
    spec: format.includes('v3') ? 'chara_card_v3' : 'chara_card_v2',
    spec_version: format.includes('v3') ? '3.0' : '2.0',
    data: { ...char.data }
  };

  if (format.startsWith('json')) {
    const blob = new Blob([JSON.stringify(v2Data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + (format.includes('v3') ? '_v3.json' : '_v2.json');
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported as JSON');
  } else if (format.startsWith('png')) {
    PNGUtil.writeCharacterToPNG(new ArrayBuffer(0), v2Data);
    PNGUtil.createPNGWithCharacter(v2Data).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.png';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Exported as PNG with embedded metadata');
    });
  }
}

// ── WORLD INFO ──────────────────────────────────────────────────────

function newWorldData() {
  return {
    _format: 'chara_world_v2',
    _version: '2.0',
    name: '',
    description: '',
    entries: []
  };
}

function newWorldEntry() {
  return {
    uid: Date.now(),
    keys: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    selective: false,
    selectiveLogic: 0,
    addMemo: true,
    order: 100,
    position: 1,
    disable: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: '',
    groupOverride: false,
    groupWeight: 100,
    scanDepth: 0,
    caseSensitive: false,
    matchWholeWords: false,
    automationId: '',
    role: 0,
    vectorized: false,
    extensions: {}
  };
}

function createWorldInfo() {
  const world = newWorldData();
  world.id = App.genId();
  App.state.worldInfos.push(world);
  App.save();
  renderWorldInfoList();
  editWorldInfo(world.id);
}

function renderWorldInfoList() {
  const el = document.getElementById('worldinfo-list');
  const worlds = App.state.worldInfos;
  if (!worlds.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9878;</div><div class="empty-state-text">No world info yet</div><button class="btn btn-primary" onclick="createWorldInfo()">Create your first world</button></div>';
    return;
  }
  el.innerHTML = worlds.map(w => `
    <div class="card-item" onclick="editWorldInfo('${w.id}')">
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();duplicateWorld('${w.id}')" title="Duplicate">&#9752;</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportWorld('${w.id}')" title="Export">&#8681;</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="event.stopPropagation();deleteWorld('${w.id}')" title="Delete">&#10005;</button>
      </div>
      <div class="card-item-header">
        <div class="card-avatar">&#9878;</div>
        <div><div class="card-title">${App.esc(w.name || 'Untitled World')}</div><div class="card-meta">${w.entries?.length || 0} entries</div></div>
      </div>
      <div class="card-desc">${App.esc((w.description || '').substring(0, 200))}</div>
    </div>
  `).join('');
}

function deleteWorld(id) {
  if (!confirm('Delete this world info?')) return;
  App.state.worldInfos = App.state.worldInfos.filter(w => w.id !== id);
  App.save();
  renderWorldInfoList();
}

function duplicateWorld(id) {
  const orig = App.state.worldInfos.find(w => w.id === id);
  if (!orig) return;
  const dupe = JSON.parse(JSON.stringify(orig));
  dupe.id = App.genId();
  dupe.name = (dupe.name || 'Untitled') + ' (Copy)';
  App.state.worldInfos.push(dupe);
  App.save();
  renderWorldInfoList();
  toast('World duplicated');
}

function exportWorld(id) {
  const world = App.state.worldInfos.find(w => w.id === id);
  if (!world) return;
  downloadJSON(world, (world.name || 'world') + '.json', 'world');
}

function editWorldInfo(id) {
  const world = App.state.worldInfos.find(w => w.id === id);
  if (!world) return;
  App.editing = { type: 'worldinfo', id };

  const panel = document.getElementById('editor-body');
  document.getElementById('editor-title').textContent = 'Edit World Info';

  let html = `
    <div class="field">
      <label class="field-label">World Name</label>
      <input type="text" id="ed-worldname" value="${App.esc(world.name || '')}" placeholder="World name" oninput="autoSaveWorld()">
    </div>
    <div class="field">
      <label class="field-label">Description</label>
      <textarea id="ed-worlddesc" class="large" placeholder="World description / setting overview" oninput="autoSaveWorld()">${App.esc(world.description || '')}</textarea>
    </div>
    <div class="section-divider">Lorebook Entries (${world.entries?.length || 0})</div>
    <div id="world-entries-list">
      ${(world.entries || []).map((e, i) => `
        <div class="list-item" style="flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">#${e.uid}</span>
            <strong style="flex:1;font-size:13px">${App.esc((e.keys || []).join(', ') || '(no keys)')}</strong>
            <button class="btn btn-ghost btn-sm" onclick="toggleWorldEntry(${i})" title="Expand/Collapse">&#9660;</button>
            <button class="btn btn-ghost btn-sm btn-danger" onclick="removeWorldEntry(${i})">&#10005;</button>
          </div>
          <div class="entry-editor" id="we-${i}" style="display:none;width:100%">
            <div class="field" style="margin-top:8px">
              <label class="field-label">Primary Keywords (one per line)</label>
              <textarea rows="2" oninput="updateWorldEntryField(${i},'keys',this.value.split('\\n').filter(Boolean))">${App.esc((e.keys || []).join('\n'))}</textarea>
            </div>
            <div class="field">
              <label class="field-label">Secondary Keywords</label>
              <textarea rows="2" oninput="updateWorldEntryField(${i},'keysecondary',this.value.split('\\n').filter(Boolean))">${App.esc((e.keysecondary || []).join('\n'))}</textarea>
            </div>
            <div class="field">
              <label class="field-label">Content</label>
              <textarea class="large" oninput="updateWorldEntryField(${i},'content',this.value)">${App.esc(e.content || '')}</textarea>
            </div>
            <div class="field">
              <label class="field-label">Comment</label>
              <input type="text" value="${App.esc(e.comment || '')}" oninput="updateWorldEntryField(${i},'comment',this.value)">
            </div>
            <div class="field-row">
              <div class="field">
                <label class="field-label">Insertion Order</label>
                <input type="number" value="${e.order ?? 100}" oninput="updateWorldEntryField(${i},'order',parseInt(this.value)||100)">
              </div>
              <div class="field">
                <label class="field-label">Depth</label>
                <input type="number" value="${e.depth ?? 4}" min="0" max="100" oninput="updateWorldEntryField(${i},'depth',parseInt(this.value)||4)">
              </div>
            </div>
            <div class="checkbox-group" style="margin-top:8px">
              <label class="checkbox-label"><input type="checkbox" ${e.constant ? 'checked' : ''} onchange="updateWorldEntryField(${i},'constant',this.checked)"> Constant</label>
              <label class="checkbox-label"><input type="checkbox" ${e.selective ? 'checked' : ''} onchange="updateWorldEntryField(${i},'selective',this.checked)"> Selective</label>
              <label class="checkbox-label"><input type="checkbox" ${e.disable ? 'checked' : ''} onchange="updateWorldEntryField(${i},'disable',this.checked)"> Disabled</label>
              <label class="checkbox-label"><input type="checkbox" ${e.caseSensitive ? 'checked' : ''} onchange="updateWorldEntryField(${i},'caseSensitive',this.checked)"> Case Sensitive</label>
              <label class="checkbox-label"><input type="checkbox" ${e.matchWholeWords ? 'checked' : ''} onchange="updateWorldEntryField(${i},'matchWholeWords',this.checked)"> Whole Words</label>
              <label class="checkbox-label"><input type="checkbox" ${e.useProbability ? 'checked' : ''} onchange="updateWorldEntryField(${i},'useProbability',this.checked)"> Use Probability</label>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="list-add-btn" onclick="addWorldEntry()">+ Add Entry</button>

    <div class="section-divider">Export</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="doExportWorld('sil')">SillyTavern / Marinara Format</button>
      <button class="btn btn-primary" onclick="doExportWorld('horde')">HordeStudio .horde_world</button>
    </div>
  `;

  panel.innerHTML = html;
  document.getElementById('editor-overlay').classList.remove('hidden');
}

function autoSaveWorld() {
  if (!App.editing || App.editing.type !== 'worldinfo') return;
  const world = App.state.worldInfos.find(w => w.id === App.editing.id);
  if (!world) return;
  world.name = document.getElementById('ed-worldname')?.value || '';
  world.description = document.getElementById('ed-worlddesc')?.value || '';
  App.save();
  renderWorldInfoList();
}

function addWorldEntry() {
  const world = App.state.worldInfos.find(w => w.id === App.editing?.id);
  if (!world) return;
  if (!world.entries) world.entries = [];
  world.entries.push(newWorldEntry());
  App.save();
  editWorldInfo(world.id);
}

function removeWorldEntry(index) {
  const world = App.state.worldInfos.find(w => w.id === App.editing?.id);
  if (!world || !world.entries) return;
  world.entries.splice(index, 1);
  App.save();
  editWorldInfo(world.id);
}

function toggleWorldEntry(index) {
  const el = document.getElementById('we-' + index);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateWorldEntryField(index, field, value) {
  const world = App.state.worldInfos.find(w => w.id === App.editing?.id);
  if (!world || !world.entries?.[index]) return;
  world.entries[index][field] = value;
  App.save();
}

function doExportWorld(format) {
  const world = App.state.worldInfos.find(w => w.id === App.editing?.id);
  if (!world) return;
  const name = (world.name || 'world').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'horde') {
    const hordeWorld = {
      _format: 'horde-world',
      _version: 2,
      name: world.name,
      description: world.description,
      lorebook: (world.entries || []).map(e => ({
        keyword: (e.keys || []).join(','),
        text: e.content || ''
      })),
      locations: [],
      entities: [],
      presentation: { enabled: false, mode: 'classic' },
      hudConfig: { stats: [], timeStep: 1 },
      gameRules: { profileId: 'pure_narrative', modules: {} },
      kernel: { enabled: false }
    };
    downloadJSON(hordeWorld, name + '.horde_world', 'horde_world');
  } else {
    downloadJSON(world, name + '_world.json', 'world');
  }
  toast('World exported');
}

// ── SCENARIOS ───────────────────────────────────────────────────────

function newScenarioData() {
  return {
    name: '',
    description: '',
    systemPrompt: '',
    scenario: '',
    firstMes: '',
    tags: [],
    difficulty: 'medium',
    genre: '',
    hooks: []
  };
}

function createScenario() {
  const sc = newScenarioData();
  sc.id = App.genId();
  App.state.scenarios.push(sc);
  App.save();
  renderScenarioList();
  editScenario(sc.id);
}

function renderScenarioList() {
  const el = document.getElementById('scenario-list');
  const scenarios = App.state.scenarios;
  if (!scenarios.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9874;</div><div class="empty-state-text">No scenarios yet</div><button class="btn btn-primary" onclick="createScenario()">Create your first scenario</button></div>';
    return;
  }
  el.innerHTML = scenarios.map(s => `
    <div class="card-item" onclick="editScenario('${s.id}')">
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();duplicateScenario('${s.id}')" title="Duplicate">&#9752;</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportScenario('${s.id}')" title="Export">&#8681;</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="event.stopPropagation();deleteScenario('${s.id}')" title="Delete">&#10005;</button>
      </div>
      <div class="card-item-header">
        <div class="card-avatar">&#9874;</div>
        <div><div class="card-title">${App.esc(s.name || 'Untitled Scenario')}</div><div class="card-meta">${App.esc(s.genre || 'General')} &middot; ${App.esc(s.difficulty || 'medium')}</div></div>
      </div>
      <div class="card-desc">${App.esc((s.description || '').substring(0, 200))}</div>
      ${s.tags?.length ? `<div class="card-tags">${s.tags.slice(0, 5).map(t => `<span class="tag">${App.esc(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

function deleteScenario(id) {
  if (!confirm('Delete this scenario?')) return;
  App.state.scenarios = App.state.scenarios.filter(s => s.id !== id);
  App.save();
  renderScenarioList();
}

function duplicateScenario(id) {
  const orig = App.state.scenarios.find(s => s.id === id);
  if (!orig) return;
  const dupe = JSON.parse(JSON.stringify(orig));
  dupe.id = App.genId();
  dupe.name = (dupe.name || 'Untitled') + ' (Copy)';
  App.state.scenarios.push(dupe);
  App.save();
  renderScenarioList();
  toast('Scenario duplicated');
}

function exportScenario(id) {
  const sc = App.state.scenarios.find(s => s.id === id);
  if (!sc) return;
  downloadJSON(sc, (sc.name || 'scenario') + '.json', 'scenario');
  toast('Scenario exported');
}

function editScenario(id) {
  const sc = App.state.scenarios.find(s => s.id === id);
  if (!sc) return;
  App.editing = { type: 'scenario', id };

  const panel = document.getElementById('editor-body');
  document.getElementById('editor-title').textContent = 'Edit Scenario';

  const hooks = sc.hooks || [];

  panel.innerHTML = `
    <div class="field">
      <label class="field-label">Scenario Name</label>
      <input type="text" id="ed-scname" value="${App.esc(sc.name || '')}" placeholder="Scenario name" oninput="autoSaveScenario()">
    </div>
    <div class="field">
      <label class="field-label">Description</label>
      <textarea id="ed-scdesc" class="large" placeholder="What is this scenario about?" oninput="autoSaveScenario()">${App.esc(sc.description || '')}</textarea>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">Genre</label>
        <input type="text" id="ed-genre" value="${App.esc(sc.genre || '')}" placeholder="e.g. Fantasy, Sci-fi, Horror" oninput="autoSaveScenario()">
      </div>
      <div class="field">
        <label class="field-label">Difficulty</label>
        <select id="ed-difficulty" onchange="autoSaveScenario()">
          <option value="easy" ${sc.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
          <option value="medium" ${sc.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="hard" ${sc.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
          <option value="deadly" ${sc.difficulty === 'deadly' ? 'selected' : ''}>Deadly</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label class="field-label">Tags</label>
      <input type="text" id="ed-sctags" value="${App.esc((sc.tags || []).join(', '))}" placeholder="Comma-separated tags" oninput="autoSaveScenario()">
    </div>

    <div class="section-divider">Scenario Setup</div>

    <div class="field">
      <label class="field-label">System Prompt</label>
      <textarea id="ed-scsystem" class="large" placeholder="System instructions for this scenario" oninput="autoSaveScenario()">${App.esc(sc.systemPrompt || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">Scenario Context</label>
      <textarea id="ed-scscenario" class="large" placeholder="The setting and circumstances" oninput="autoSaveScenario()">${App.esc(sc.scenario || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">Opening Message</label>
      <textarea id="ed-scfm" class="large" placeholder="The first message to set the scene" oninput="autoSaveScenario()">${App.esc(sc.firstMes || '')}</textarea>
    </div>

    <div class="section-divider">Story Hooks</div>
    <div id="scenario-hooks" class="list-container">
      ${hooks.map((h, i) => `<div class="list-item">
        <div class="list-item-content"><input type="text" value="${App.esc(h)}" oninput="updateScenarioHook(${i}, this.value)" placeholder="Story hook"></div>
        <div class="list-item-actions"><button class="btn btn-ghost btn-sm btn-danger" onclick="removeScenarioHook(${i})">&#10005;</button></div>
      </div>`).join('')}
      <button class="list-add-btn" onclick="addScenarioHook()">+ Add Story Hook</button>
    </div>

    <div class="section-divider">Export</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" onclick="doExportScenario()">Export Scenario</button>
    </div>
  `;
  document.getElementById('editor-overlay').classList.remove('hidden');
}

function autoSaveScenario() {
  if (!App.editing || App.editing.type !== 'scenario') return;
  const sc = App.state.scenarios.find(s => s.id === App.editing.id);
  if (!sc) return;
  const val = id => document.getElementById(id)?.value || '';
  sc.name = val('ed-scname');
  sc.description = val('ed-scdesc');
  sc.genre = val('ed-genre');
  sc.difficulty = val('ed-difficulty');
  sc.tags = val('ed-sctags').split(',').map(s => s.trim()).filter(Boolean);
  sc.systemPrompt = val('ed-scsystem');
  sc.scenario = val('ed-scscenario');
  sc.firstMes = val('ed-scfm');
  App.save();
  renderScenarioList();
}

function addScenarioHook() {
  const sc = App.state.scenarios.find(s => s.id === App.editing?.id);
  if (!sc) return;
  if (!sc.hooks) sc.hooks = [];
  sc.hooks.push('');
  App.save();
  editScenario(sc.id);
}

function removeScenarioHook(index) {
  const sc = App.state.scenarios.find(s => s.id === App.editing?.id);
  if (!sc || !sc.hooks) return;
  sc.hooks.splice(index, 1);
  App.save();
  editScenario(sc.id);
}

function updateScenarioHook(index, value) {
  const sc = App.state.scenarios.find(s => s.id === App.editing?.id);
  if (!sc || !sc.hooks) return;
  sc.hooks[index] = value;
  App.save();
}

function doExportScenario() {
  const sc = App.state.scenarios.find(s => s.id === App.editing?.id);
  if (!sc) return;
  downloadJSON(sc, (sc.name || 'scenario').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json', 'scenario');
  toast('Scenario exported');
}

// ── PERSONAS ────────────────────────────────────────────────────────

function newPersonaData() {
  return {
    name: '', text: '', age: '', pronouns: '',
    appearance: '', publicIdentity: '', reputation: '',
    color: '#4A90E2'
  };
}

function createPersona() {
  const p = newPersonaData();
  p.id = App.genId();
  App.state.personas.push(p);
  App.save();
  renderPersonaList();
  editPersona(p.id);
}

function renderPersonaList() {
  const el = document.getElementById('persona-list');
  const personas = App.state.personas;
  if (!personas.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#9786;</div><div class="empty-state-text">No personas yet</div><button class="btn btn-primary" onclick="createPersona()">Create your first persona</button></div>';
    return;
  }
  el.innerHTML = personas.map(p => `
    <div class="card-item" onclick="editPersona('${p.id}')">
      <div class="card-actions">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();duplicatePersona('${p.id}')" title="Duplicate">&#9752;</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportPersona('${p.id}')" title="Export">&#8681;</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="event.stopPropagation();deletePersona('${p.id}')" title="Delete">&#10005;</button>
      </div>
      <div class="card-item-header">
        <div class="card-avatar" style="background:${App.esc(p.color || '#4A90E2')}">${App.esc((p.name || '?')[0])}</div>
        <div><div class="card-title">${App.esc(p.name || 'Unnamed')}</div><div class="card-meta">${App.esc(p.pronouns || '')} ${p.age ? '&middot; Age ' + App.esc(p.age) : ''}</div></div>
      </div>
      <div class="card-desc">${App.esc((p.appearance || p.text || '').substring(0, 200))}</div>
    </div>
  `).join('');
}

function deletePersona(id) {
  if (!confirm('Delete this persona?')) return;
  App.state.personas = App.state.personas.filter(p => p.id !== id);
  App.save();
  renderPersonaList();
}

function duplicatePersona(id) {
  const orig = App.state.personas.find(p => p.id === id);
  if (!orig) return;
  const dupe = JSON.parse(JSON.stringify(orig));
  dupe.id = App.genId();
  dupe.name = (dupe.name || 'Unnamed') + ' (Copy)';
  App.state.personas.push(dupe);
  App.save();
  renderPersonaList();
  toast('Persona duplicated');
}

function exportPersona(id) {
  const p = App.state.personas.find(p => p.id === id);
  if (!p) return;
  downloadJSON(p, (p.name || 'persona').replace(/[^a-zA-Z0-9_-]/g, '_') + '_persona.json', 'persona');
  toast('Persona exported');
}

function editPersona(id) {
  const p = App.state.personas.find(p => p.id === id);
  if (!p) return;
  App.editing = { type: 'persona', id };

  const panel = document.getElementById('editor-body');
  document.getElementById('editor-title').textContent = 'Edit Persona';

  panel.innerHTML = `
    <div class="field">
      <label class="field-label">Persona Name</label>
      <input type="text" id="ed-pname" value="${App.esc(p.name || '')}" placeholder="Your persona name" oninput="autoSavePersona()">
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field-label">Age</label>
        <input type="text" id="ed-page" value="${App.esc(p.age || '')}" placeholder="Age" oninput="autoSavePersona()">
      </div>
      <div class="field">
        <label class="field-label">Pronouns</label>
        <input type="text" id="ed-ppronouns" value="${App.esc(p.pronouns || '')}" placeholder="e.g. she/her" oninput="autoSavePersona()">
      </div>
    </div>
    <div class="field">
      <label class="field-label">Color</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="color" id="ed-pcolor" value="${p.color || '#4A90E2'}" onchange="autoSavePersona()" style="width:40px;height:32px;border:none;background:none;cursor:pointer">
        <input type="text" id="ed-pcolor-text" value="${App.esc(p.color || '#4A90E2')}" oninput="document.getElementById('ed-pcolor').value=this.value;autoSavePersona()" style="width:100px">
      </div>
    </div>

    <div class="section-divider">Description</div>
    <div class="field">
      <label class="field-label">Description / Bio</label>
      <textarea id="ed-ptext" class="large" placeholder="Who are you? Your persona description for ${App.esc('{{user}}')} in roleplay." oninput="autoSavePersona()">${App.esc(p.text || '')}</textarea>
      <div class="field-hint">This gets injected wherever ${App.esc('{{user}}')} appears in character cards.</div>
    </div>

    <div class="section-divider">Extended Details</div>
    <div class="field">
      <label class="field-label">Appearance</label>
      <textarea id="ed-pappearance" placeholder="Physical appearance details" oninput="autoSavePersona()">${App.esc(p.appearance || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">Public Identity</label>
      <textarea id="ed-pidentity" placeholder="How the persona presents publicly" oninput="autoSavePersona()">${App.esc(p.publicIdentity || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label">Reputation</label>
      <textarea id="ed-preputation" placeholder="How others perceive this persona" oninput="autoSavePersona()">${App.esc(p.reputation || '')}</textarea>
    </div>

    <div class="section-divider">Export</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="doExportPersona('sil')">SillyTavern / Marinara User Settings</button>
      <button class="btn btn-primary" onclick="doExportPersona('horde')">HordeStudio Persona</button>
      <button class="btn btn-primary" onclick="doExportPersona('json')">Export as JSON</button>
    </div>
  `;
  document.getElementById('editor-overlay').classList.remove('hidden');
}

function autoSavePersona() {
  if (!App.editing || App.editing.type !== 'persona') return;
  const p = App.state.personas.find(p => p.id === App.editing.id);
  if (!p) return;
  const val = id => document.getElementById(id)?.value || '';
  p.name = val('ed-pname');
  p.age = val('ed-page');
  p.pronouns = val('ed-ppronouns');
  p.color = val('ed-pcolor-text') || val('ed-pcolor') || '#4A90E2';
  p.text = val('ed-ptext');
  p.appearance = val('ed-pappearance');
  p.publicIdentity = val('ed-pidentity');
  p.reputation = val('ed-preputation');
  App.save();
  renderPersonaList();
}

function doExportPersona(format) {
  const p = App.state.personas.find(p => p.id === App.editing?.id);
  if (!p) return;
  const name = (p.name || 'persona').replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'sil') {
    const silPersona = {
      name: p.name,
      description: [p.appearance, p.text, p.publicIdentity, p.reputation].filter(Boolean).join('\n\n'),
      avatars: []
    };
    downloadJSON(silPersona, name + '_user_settings.json', 'persona');
  } else if (format === 'horde') {
    const hordePersona = {
      name: p.name,
      text: p.text,
      age: p.age,
      pronouns: p.pronouns,
      appearance: p.appearance,
      publicIdentity: p.publicIdentity,
      reputation: p.reputation,
      color: p.color
    };
    downloadJSON(hordePersona, name + '_horde_persona.json', 'persona');
  } else {
    downloadJSON(p, name + '_persona.json', 'persona');
  }
  toast('Persona exported');
}

// ── IMPORT / EXPORT ALL ─────────────────────────────────────────────

function downloadJSON(data, filename, type) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData() {
  document.getElementById('import-file').click();
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  if (file.name.endsWith('.png')) {
    reader.onload = () => {
      try {
        const data = PNGUtil.readCharacterFromPNG(reader.result);
        importCharacterData(data);
        toast('Character imported from PNG');
      } catch (e) {
        toast('Error: ' + e.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data._format === 'horde-world') {
          importHordeWorld(data);
          toast('HordeStudio world imported');
        } else if (data._format === 'nexus-chara' || data._format === 'horde-studio-character') {
          importNexusCharacter(data);
          toast('HordeStudio character imported');
        } else if (data.spec === 'chara_card_v2' || data.spec === 'chara_card_v3') {
          importCharacterData(data);
          toast('Character card imported');
        } else if (data.entries && data.name) {
          importWorldData(data);
          toast('World info imported');
        } else if (data.name && (data.pronouns !== undefined || data.appearance !== undefined)) {
          importPersonaData(data);
          toast('Persona imported');
        } else {
          toast('Unrecognized format');
        }
      } catch (e) {
        toast('Error parsing file: ' + e.message);
      }
    };
    reader.readAsText(file);
  }
  event.target.value = '';
}

function importCharacterData(data) {
  const char = JSON.parse(JSON.stringify(data));
  char.id = App.genId();
  char._cardSpec = data.spec === 'chara_card_v3' ? 'v3' : 'v2';
  char._avatar = null;
  App.state.characters.push(char);
  App.save();
  renderCharacterList();
}

function importNexusCharacter(data) {
  const char = {
    id: App.genId(),
    _cardSpec: 'nexus',
    _format: 'nexus-chara',
    _avatar: null,
    name: data.name || '',
    desc: data.desc || '',
    prompt: data.prompt || '',
    intro: data.intro || '',
    authorsNote: data.authorsNote || '',
    creatorNotes: data.creatorNotes || '',
    sourceUrl: data.sourceUrl || '',
    tags: data.tags || [],
    alternateGreetings: data.alternateGreetings || [],
    lorebook: data.lorebook || [],
    tavernExtensions: data.tavernExtensions || { depth_prompt: { prompt: '', depth: 4, role: 'system' } },
    memory: data.memory || [],
    avatar: data.avatar || null,
    bg: data.bg || null,
    model: data.model || ''
  };
  if (data.avatar) char._avatar = data.avatar;
  App.state.characters.push(char);
  App.save();
  renderCharacterList();
}

function importHordeWorld(data) {
  const world = {
    id: App.genId(),
    _format: 'chara_world_v2',
    _version: '2.0',
    name: data.name || '',
    description: data.description || '',
    entries: (data.lorebook || []).map((e, i) => ({
      uid: i,
      keys: (e.keyword || '').split(',').map(s => s.trim()).filter(Boolean),
      keysecondary: [],
      comment: '',
      content: e.text || '',
      constant: false,
      selective: false,
      order: 100,
      depth: 4,
      disable: false,
      caseSensitive: false,
      matchWholeWords: false,
      useProbability: true,
      extensions: {}
    }))
  };
  App.state.worldInfos.push(world);
  App.save();
  renderWorldInfoList();
}

function importWorldData(data) {
  const world = JSON.parse(JSON.stringify(data));
  world.id = App.genId();
  App.state.worldInfos.push(world);
  App.save();
  renderWorldInfoList();
}

function importPersonaData(data) {
  const p = JSON.parse(JSON.stringify(data));
  p.id = App.genId();
  App.state.personas.push(p);
  App.save();
  renderPersonaList();
}

function exportAll() {
  const backup = {
    _format: 'cardforge-backup',
    _version: 1,
    _exported: new Date().toISOString(),
    characters: App.state.characters,
    worldInfos: App.state.worldInfos,
    scenarios: App.state.scenarios,
    personas: App.state.personas
  };
  downloadJSON(backup, 'cardforge_backup_' + new Date().toISOString().slice(0, 10) + '.json', 'backup');
  toast('Full backup exported');
}

// ── EDITOR ──────────────────────────────────────────────────────────

function closeEditor(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('editor-overlay').classList.add('hidden');
  App.editing = null;
  renderCurrentList();
}

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeEditor();
});

// ── INIT ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderCurrentList();
});
