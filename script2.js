const DEFAULT_DB = {};

function sanitizeName(name, id) {
    if (!name || typeof name !== 'string') return '';
    const trimmed = name.trim();
    if (/^оп\s*#?\d+$/i.test(trimmed) || trimmed === `#${id}`) {
        return '';
    }
    return trimmed;
}

function loadDB() {
    try {
        const raw = localStorage.getItem('opsDB') || localStorage.getItem('operator_db');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        const sanitized = {};
        for (const [id, op] of Object.entries(parsed)) {
            if (op && typeof op === 'object') {
                const tag = op.handle || op.tag || '';
                const name = sanitizeName(op.name, id);
                const history = Array.isArray(op.history) ? op.history.filter(h => h && typeof h === 'object') : [];
                sanitized[id] = { name, tag, handle: tag, history };
            }
        }
        return sanitized;
    } catch (error) {
        return {};
    }
}

let db = loadDB();
let editingDbList = [];
let dbStatusFilter = 'all';

function updateButtonStates() {
    const hasData = db && Object.keys(db).length > 0;
    const btnImport = document.getElementById('btnImport');
    const btnExport = document.getElementById('btnExport');
    const btnEdit = document.getElementById('btnEdit');
    const btnReset = document.getElementById('btnReset');

    if (!hasData) {
        if (btnImport) btnImport.classList.add('btn-pulse-needed');
        if (btnExport) btnExport.disabled = true;
        if (btnEdit) btnEdit.disabled = true;
        if (btnReset) btnReset.disabled = true;
    } else {
        if (btnImport) btnImport.classList.remove('btn-pulse-needed');
        if (btnExport) btnExport.disabled = false;
        if (btnEdit) btnEdit.disabled = false;
        if (btnReset) btnReset.disabled = false;
    }
}

function isDismissed(item) {
    return String(item?.name || '').trim().toLowerCase().includes('звільн');
}

function setDbStatusFilter(filter, btn) {
    dbStatusFilter = filter || 'all';
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    renderDbTableRows();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function ensureDbEditor() {
    renderDbTableRows();
}

function toggleModal() {
    const modal = document.getElementById('dbModal');
    if (!modal) return;

    const shouldOpen = modal.style.display !== 'flex';
    modal.style.display = shouldOpen ? 'flex' : 'none';

    if (shouldOpen) {
        editingDbList = Object.keys(db).map(id => ({
            id: String(id),
            name: sanitizeName(db[id]?.name, id),
            tag: db[id]?.tag || db[id]?.handle || '',
            history: Array.isArray(db[id]?.history) ? [...db[id].history] : []
        }));
        
        // Сортуємо за числовим ID
        editingDbList.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
        
        const searchInput = document.getElementById('dbSearch');
        if (searchInput) searchInput.value = '';

        dbStatusFilter = 'all';
        const filterGroup = document.querySelector('.status-filter-group');
        if (filterGroup) {
            filterGroup.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            const allBtn = filterGroup.querySelector('.btn-filter');
            if (allBtn) allBtn.classList.add('active');
        }
        
        renderDbTableRows();
    }
}

function syncEditingDbFromDom() {
    const rows = document.querySelectorAll('#dbTableContainer .db-row');
    rows.forEach(row => {
        const origIdx = parseInt(row.dataset.originalIndex, 10);
        if (!isNaN(origIdx) && editingDbList[origIdx]) {
            const idInput = row.querySelector('.row-id');
            const nameInput = row.querySelector('.row-name');
            const handleInput = row.querySelector('.row-handle');

            if (idInput) editingDbList[origIdx].id = idInput.value;
            if (nameInput) editingDbList[origIdx].name = nameInput.value;
            if (handleInput) editingDbList[origIdx].tag = handleInput.value;
        }
    });
}

function renderDbTableRows() {
    syncEditingDbFromDom();
    const container = document.getElementById('dbTableContainer');
    const counter = document.getElementById('dbTotalCounter');
    const searchQuery = (document.getElementById('dbSearch')?.value || '').trim().toLowerCase();

    if (counter) {
        counter.innerText = `Всього: ${editingDbList.length}`;
    }

    if (!container) return;
    container.innerHTML = '';

    const filtered = editingDbList
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => {
            const matchesSearch = !searchQuery || (
                String(item.id).toLowerCase().includes(searchQuery) ||
                String(item.name).toLowerCase().includes(searchQuery) ||
                String(item.tag).toLowerCase().includes(searchQuery)
            );
            if (!matchesSearch) return false;

            if (dbStatusFilter === 'active') {
                return !isDismissed(item);
            } else if (dbStatusFilter === 'dismissed') {
                return isDismissed(item);
            }
            return true;
        });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 24px 10px; font-size: 14px;">
            ${editingDbList.length === 0 ? 'База порожня. Натисніть "+ Додати", щоб створити запис.' : 'Нічого не знайдено за запитом.'}
        </div>`;
        return;
    }

    filtered.forEach(({ item, originalIndex }) => {
        const row = document.createElement('div');
        row.className = 'db-row';
        row.dataset.originalIndex = originalIndex;

        const dismissed = isDismissed(item);
        const statusLabel = dismissed ? 'Звільнився' : 'Активний';
        const statusClass = dismissed ? 'dismissed' : 'active';
        const historyCount = Array.isArray(item.history) ? item.history.length : 0;
        const historyTooltip = historyCount > 0
            ? `Історія записів (${historyCount}):\n` + item.history.map(h => `• ${h.name || 'Без імені'} (${h.tag || ''}) — ${h.status === 'dismissed' ? 'Звільнився' : 'Активний'} [${h.archivedAt || 'архів'}]`).join('\n')
            : '';

        row.innerHTML = `
            <input type="text" class="row-id" placeholder="ID" value="${escapeHtml(item.id)}" title="Номер ID">
            <input type="text" class="row-name" placeholder="Ім'я" value="${escapeHtml(item.name)}" title="Ім'я оператора">
            <input type="text" class="row-handle" placeholder="@тег" value="${escapeHtml(item.tag)}" title="Telegram-тег">
            <div class="status-col" style="display:flex; align-items:center; justify-content:center; gap:4px;">
                <span class="status-badge ${statusClass}">${statusLabel}</span>
                ${historyCount > 0 ? `<span style="font-size:11px; cursor:help; color:var(--tg-text-muted);" title="${escapeHtml(historyTooltip)}">📜${historyCount}</span>` : ''}
            </div>
            <button type="button" class="btn-del" title="Видалити" onclick="deleteDbRow(${originalIndex})">✕</button>
        `;
        container.appendChild(row);
    });
}

function addNewDbRow() {
    syncEditingDbFromDom();
    editingDbList.unshift({ id: '', name: '', tag: '', history: [] });
    renderDbTableRows();
    const firstInput = document.querySelector('.db-row input.row-id');
    if (firstInput) firstInput.focus();
}

function deleteDbRow(index) {
    syncEditingDbFromDom();
    if (index >= 0 && index < editingDbList.length) {
        editingDbList.splice(index, 1);
        renderDbTableRows();
    }
}

function saveInteractiveDB() {
    syncEditingDbFromDom();
    const newDb = {};
    const seenIds = new Set();
    let hasErrors = false;

    for (let i = 0; i < editingDbList.length; i++) {
        const item = editingDbList[i];
        const cleanId = String(item.id || '').trim();
        let cleanTag = String(item.tag || '').trim();
        const cleanName = sanitizeName(item.name, cleanId);

        if (!cleanId && !cleanTag && !cleanName) {
            continue; // Пропускаємо порожні рядки
        }

        if (!cleanId) {
            alert(`Рядок #${i + 1}: ID не може бути порожнім`);
            hasErrors = true;
            break;
        }

        if (!cleanTag) {
            alert(`Рядок #${i + 1} (ID: ${cleanId}): Telegram-тег не може бути порожнім`);
            hasErrors = true;
            break;
        }

        if (seenIds.has(cleanId)) {
            alert(`Помилка: дублікат ID "${cleanId}". Кожен номер повинен бути унікальним.`);
            hasErrors = true;
            break;
        }

        if (!cleanTag.startsWith('@')) {
            cleanTag = '@' + cleanTag;
        }

        if (cleanId === '41' && cleanTag === '@maria63') {
            cleanTag = '@mariiia63';
        }

        seenIds.add(cleanId);

        // Фіксація історії при зміні або перевидачі ID іншому оператору
        const oldOp = db[cleanId];
        let history = Array.isArray(item.history) ? [...item.history] : (oldOp && Array.isArray(oldOp.history) ? [...oldOp.history] : []);

        if (oldOp && (oldOp.name !== cleanName || oldOp.tag !== cleanTag)) {
            const wasDismissed = isDismissed(oldOp);
            history.push({
                name: oldOp.name || '',
                tag: oldOp.tag || oldOp.handle || '',
                status: wasDismissed ? 'dismissed' : 'active',
                archivedAt: new Date().toISOString().slice(0, 10)
            });
        }

        newDb[cleanId] = {
            name: cleanName,
            tag: cleanTag,
            handle: cleanTag,
            history
        };
    }

    if (hasErrors) return;

    db = newDb;
    localStorage.setItem('opsDB', JSON.stringify(db));
    localStorage.setItem('operator_db', JSON.stringify(db));
    updateButtonStates();
    toggleModal();
    processInput();
    alert(`Зміни збережено! Всього операторів: ${Object.keys(db).length}`);
}

function handleFileImport(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const isExcel = file.name.match(/\.xlsx?$/i);

    if (isJson) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                const importedDB = {};

                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        const id = item.id || item.idVal || item['№ оп'] || item['номер'] || item['оп'];
                        const rawTag = item.tag || item.handle || item.telegram || item['тег'] || item['нік'];
                        const rawName = item.name || item['ім\'я'] || item['имя'] || item['піб'] || item['оператор'];
                        if (id && rawTag) {
                            let tag = String(rawTag).trim();
                            if (!tag.startsWith('@')) tag = '@' + tag;
                            const cleanId = String(id).trim();
                            if (cleanId === '41' && tag === '@maria63') tag = '@mariiia63';
                            const name = sanitizeName(rawName, cleanId);
                            importedDB[cleanId] = { name, tag, handle: tag };
                        }
                    });
                } else if (parsed && typeof parsed === 'object') {
                    for (const [key, val] of Object.entries(parsed)) {
                        if (val && typeof val === 'object') {
                            const rawTag = val.tag || val.handle || val.telegram || val['тег'] || '';
                            let tag = String(rawTag).trim();
                            if (tag && !tag.startsWith('@')) tag = '@' + tag;
                            const cleanId = String(key).trim();
                            if (cleanId === '41' && tag === '@maria63') tag = '@mariiia63';
                            const rawName = val.name || val['ім\'я'] || val['имя'] || val['піб'];
                            const name = sanitizeName(rawName, cleanId);
                            if (tag) {
                                importedDB[cleanId] = { name, tag, handle: tag };
                            }
                        }
                    }
                }

                if (Object.keys(importedDB).length === 0) {
                    throw new Error('У файлі JSON не знайдено валідних записів операторів');
                }

                db = importedDB;
                localStorage.setItem('opsDB', JSON.stringify(db));
                localStorage.setItem('operator_db', JSON.stringify(db));
                updateButtonStates();
                processInput();
                alert(`Успішно імпортовано: ${Object.keys(db).length} операторів`);
            } catch (err) {
                alert('Помилка імпорту JSON: ' + err.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.onerror = function () {
            alert('Помилка зчитування файлу');
            event.target.value = '';
        };
        reader.readAsText(file);
    } else if (isExcel) {
        if (typeof XLSX === 'undefined') {
            alert('Бібліотеку SheetJS ще не завантажено. Перевірте з\'єднання з інтернетом.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const importedDB = {};

                jsonData.forEach(row => {
                    let idVal = null;
                    let tagVal = null;
                    let nameVal = null;

                    for (const key of Object.keys(row)) {
                        const cleanKey = key.trim();
                        if (/^(№\s*оп|id|номер|оп|№)/i.test(cleanKey) && idVal === null) {
                            idVal = row[key];
                        } else if (/(telegram|тег|handle|нік|tag|телеграм|юзернейм|username)/i.test(cleanKey) && tagVal === null) {
                            tagVal = row[key];
                        } else if (/(ім'я|имя|name|піб|оператор|співробітник|працівник|прізвище|хто)/i.test(cleanKey) && nameVal === null) {
                            nameVal = row[key];
                        }
                    }

                    if (idVal !== null && idVal !== undefined && tagVal) {
                        const id = String(idVal).trim();
                        let tag = String(tagVal).trim();
                        if (!tag.startsWith('@')) tag = '@' + tag;
                        if (id === '41' && tag === '@maria63') tag = '@mariiia63';
                        const name = sanitizeName(nameVal, id);
                        if (id) {
                            importedDB[id] = { name, tag, handle: tag };
                        }
                    }
                });

                if (Object.keys(importedDB).length === 0) {
                    throw new Error('Не знайдено валідних колонок (ID/Тег) або рядків у таблиці');
                }

                db = importedDB;
                localStorage.setItem('opsDB', JSON.stringify(db));
                localStorage.setItem('operator_db', JSON.stringify(db));
                updateButtonStates();
                processInput();
                alert(`Успішно імпортовано: ${Object.keys(db).length} операторів`);
            } catch (err) {
                alert('Помилка імпорту Excel: ' + err.message);
            } finally {
                event.target.value = '';
            }
        };
        reader.onerror = function () {
            alert('Помилка зчитування файлу');
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Підтримуються тільки файли .xlsx, .xls або .json');
        event.target.value = '';
    }
}

function parseOperatorInputTokens(input) {
    if (!input || typeof input !== 'string') return [];

    const processedRanges = [];
    const checkOverlap = (start, end) => processedRanges.some(r => (start >= r.start && start < r.end) || (end > r.start && end <= r.end));

    // 1. Shift pattern: (32до19), 32(до19), 32 до 19, 32 (до 13:00), (32 до 19:00), 32(до 15)
    const shiftRegex = /(?:(\()?\s*(\d+)\s*(?:\(|\s*)\s*до\s*(\d{1,2})(?::(\d{2}))?\s*\)?\)?)/gi;
    let match;
    while ((match = shiftRegex.exec(input)) !== null) {
        const id = match[2];
        const hour = parseInt(match[3], 10);
        const min = match[4] ? parseInt(match[4], 10) : 0;
        processedRanges.push({
            start: match.index,
            end: shiftRegex.lastIndex,
            id,
            shiftEndHour: hour,
            shiftEndMin: min
        });
    }

    // 2. Outage: No Light (47(б/с), 47(без світла), 47 (б/с), 47(світло), 47б/с, 47 (б.с))
    const noLightRegex = /(?:(\()?\s*(\d+)\s*(?:\(|\s*)\s*(?:б[\/\.]?с|без\s*світла|світло)\s*\)?\)?)/gi;
    while ((match = noLightRegex.exec(input)) !== null) {
        const start = match.index;
        const end = noLightRegex.lastIndex;
        if (!checkOverlap(start, end)) {
            const id = match[2];
            processedRanges.push({
                start,
                end,
                id,
                outage: 'no_light'
            });
        }
    }

    // 3. Outage: No Net (105(б/і), 105(без нету), 105(нет), 105(інет), 105(інтернет), 105(интернет), 105(б/и), 105 (б/і))
    const noNetRegex = /(?:(\()?\s*(\d+)\s*(?:\(|\s*)\s*(?:б[\/\.]?[іи]|без\s*(?:нету|інету|інтернету|интернета)|нет|інет|инет|інтернет|интернет)\s*\)?\)?)/gi;
    while ((match = noNetRegex.exec(input)) !== null) {
        const start = match.index;
        const end = noNetRegex.lastIndex;
        if (!checkOverlap(start, end)) {
            const id = match[2];
            processedRanges.push({
                start,
                end,
                id,
                outage: 'no_net'
            });
        }
    }

    // 4. Outage: Offline / Away (73(офлайн), 73(off), 73(немає), 73(offline), 73(оффлайн), 73(нема))
    const offlineRegex = /(?:(\()?\s*(\d+)\s*(?:\(|\s*)\s*(?:офлайн|оффлайн|offline|off|немає|нема)\s*\)?\)?)/gi;
    while ((match = offlineRegex.exec(input)) !== null) {
        const start = match.index;
        const end = offlineRegex.lastIndex;
        if (!checkOverlap(start, end)) {
            const id = match[2];
            processedRanges.push({
                start,
                end,
                id,
                outage: 'offline'
            });
        }
    }

    // 5. Lead pattern: 23(г), 23 (г), 23(g), 23 (g), (23г), (23 г), 23г, 23g
    const leadRegex = /(?:(\()?\s*(\d+)\s*(?:\(|\s*)\s*([гgГG])\s*\)?\)?)/gi;
    while ((match = leadRegex.exec(input)) !== null) {
        const start = match.index;
        const end = leadRegex.lastIndex;
        if (!checkOverlap(start, end)) {
            const id = match[2];
            processedRanges.push({
                start,
                end,
                id,
                isLead: true
            });
        }
    }

    // 6. Plain ID pattern: match any remaining digits
    const digitRegex = /\d+/g;
    while ((match = digitRegex.exec(input)) !== null) {
        const start = match.index;
        const end = digitRegex.lastIndex;
        if (!checkOverlap(start, end)) {
            const id = match[0];
            processedRanges.push({
                start,
                end,
                id
            });
        }
    }

    // Sort by order of appearance
    processedRanges.sort((a, b) => a.start - b.start);

    // Deduplicate by ID
    const seenIds = new Set();
    const result = [];
    for (const item of processedRanges) {
        if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            result.push({
                id: item.id,
                isLead: Boolean(item.isLead),
                outage: item.outage || null,
                shiftEndHour: item.shiftEndHour !== undefined ? item.shiftEndHour : null,
                shiftEndMin: item.shiftEndMin !== undefined ? item.shiftEndMin : 0
            });
        }
    }

    return result;
}

// Логіка роботи
function processInput() {
    updateButtonStates();
    const grid = document.getElementById('operatorGrid');
    if (!grid) return;

    if (!db || Object.keys(db).length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; color: var(--warn); padding: 12px; background: rgba(239, 68, 68, 0.08); border-radius: 8px; border: 1px dashed var(--warn); font-size: 14px; text-align: center;">База операторів порожня. Натисніть "Import Base" та оберіть файл з тегами.</div>';
        updateTags();
        return;
    }

    const input = document.getElementById('inputIds')?.value || '';
    grid.innerHTML = '';
    const parsedItems = parseOperatorInputTokens(input);

    parsedItems.forEach(item => {
        const id = item.id;
        const op = db[id];
        const div = document.createElement('div');

        if (!op) {
            div.className = 'card';
            div.style.borderColor = 'var(--warn)';
            div.innerHTML = `⚠️ ${escapeHtml(id)}: Немає в базі`;
        } else {
            const tag = op.handle || op.tag || '';
            const name = sanitizeName(op.name, id);

            let badgesHtml = '';
            let isChecked = true;
            let isOutage = false;
            let outageType = item.outage || 'none';

            if (item.isLead) {
                isChecked = false;
            }

            if (item.outage) {
                isChecked = false;
                isOutage = true;
                if (item.outage === 'no_light') {
                    badgesHtml += `<span class="badge-role badge-outage badge-no-light">⚡️ Без світла</span>`;
                } else if (item.outage === 'no_net') {
                    badgesHtml += `<span class="badge-role badge-outage badge-no-net">🌐 Без інтернету</span>`;
                } else if (item.outage === 'offline') {
                    badgesHtml += `<span class="badge-role badge-outage badge-offline">⏸ Офлайн</span>`;
                }
            }

            if (item.shiftEndHour !== null) {
                const now = new Date();
                const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), item.shiftEndHour, item.shiftEndMin || 0, 0);
                const diffMinutes = (shiftEnd.getTime() - now.getTime()) / (1000 * 60);

                const timeStr = (item.shiftEndMin && item.shiftEndMin > 0)
                    ? `${item.shiftEndHour}:${String(item.shiftEndMin).padStart(2, '0')}`
                    : `${item.shiftEndHour}:00`;

                if (diffMinutes <= 0) {
                    isChecked = false;
                    badgesHtml += `<span class="badge-role badge-expired">⏳ Зміна закінчилась (до ${escapeHtml(timeStr)})</span>`;
                    div.style.opacity = '0.65';
                } else if (diffMinutes <= 45) {
                    badgesHtml += `<span class="badge-role badge-warning">⚠️ Скоро кінець зміни (до ${escapeHtml(timeStr)})</span>`;
                    div.style.borderColor = 'rgba(245, 158, 11, 0.6)';
                } else {
                    badgesHtml += `<span class="badge-role badge-info">🕒 До ${escapeHtml(timeStr)}</span>`;
                }
            }

            let cardClasses = ['card'];
            if (isChecked) cardClasses.push('active');
            if (isOutage) cardClasses.push('is-outage');
            div.className = cardClasses.join(' ');
            div.dataset.outage = outageType;
            div.dataset.opId = id;
            div.dataset.isLead = item.isLead ? 'true' : 'false';

            let toggleBtnIcon = '⚡️';
            let toggleBtnStyle = '';
            if (outageType === 'no_net') { toggleBtnIcon = '🌐'; toggleBtnStyle = 'opacity:1;'; }
            else if (outageType === 'offline') { toggleBtnIcon = '⏸'; toggleBtnStyle = 'opacity:1;'; }
            else if (outageType === 'no_light') { toggleBtnIcon = '⚡️'; toggleBtnStyle = 'opacity:1;'; }

            div.innerHTML = `
                <div class="card-header-row">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="this.closest('.card').classList.toggle('active'); updateTags()">
                    <span class="card-title"><strong>Оп ${escapeHtml(id)}</strong>${name ? ` <span class="card-name">— ${escapeHtml(name)}</span>` : ''}${item.isLead ? ` <span class="lead-crown-icon" title="Головний бази">👑</span>` : ''}</span>
                </div>
                <div class="card-footer-row">
                    <div class="card-subtitle">${escapeHtml(tag)}</div>
                    <div class="card-footer-actions">
                        <button type="button" class="btn-outage-toggle" style="${toggleBtnStyle}" onclick="toggleCardOutage(this, '${escapeHtml(id)}', event)" title="Позначити статус: Без світла / Інтернету / Офлайн">${toggleBtnIcon}</button>
                        <div class="break-trigger-wrap">
                            <button type="button" class="btn-break-trigger" ${isOutage ? 'disabled' : ''} onclick="toggleBreakMenu('${escapeHtml(id)}', event)" title="${isOutage ? 'Перерва недоступна під час форс-мажору' : 'Поставити перерву / обід'}">☕️</button>
                        </div>
                    </div>
                </div>
                ${badgesHtml ? `<div class="card-badges">${badgesHtml}</div>` : ''}
            `;
            div.dataset.tag = tag;
            div.dataset.handle = tag;
        }

        grid.appendChild(div);
    });

    checkActiveBreaks();
    updateTags();
}

// Перерви та Обід (Break / Lunch Timer System)
function getBreaksState() {
    try {
        const raw = localStorage.getItem('tg_breaks_state');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function setBreaksState(state) {
    try {
        localStorage.setItem('tg_breaks_state', JSON.stringify(state));
    } catch (e) {}
}

function toggleBreakMenu(id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = document.querySelector(`.card[data-op-id="${id}"]`);
    if (!card || card.classList.contains('is-outage') || (card.dataset.outage && card.dataset.outage !== 'none')) return;

    const wrap = card.querySelector('.break-trigger-wrap') || card;
    const existingPopover = wrap.querySelector('.break-menu-popover');
    if (existingPopover) {
        existingPopover.remove();
        return;
    }

    document.querySelectorAll('.break-menu-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'break-menu-popover';
    popover.innerHTML = `
        <button type="button" class="btn-break-option" onclick="startBreak('${escapeHtml(id)}', 15 * 60, '15 хв', event)">☕️ 15 хв</button>
        <button type="button" class="btn-break-option" onclick="startBreak('${escapeHtml(id)}', 30 * 60, '30 хв', event)">☕️ 30 хв</button>
        <button type="button" class="btn-break-option" onclick="startBreak('${escapeHtml(id)}', 60 * 60, 'Обід', event)">🍔 1 год (Обід)</button>
        <div class="break-custom-row" onclick="event.stopPropagation()">
            <input type="number" id="customMin_${escapeHtml(id)}" placeholder="хв" min="0" max="180">
            <span>:</span>
            <input type="number" id="customSec_${escapeHtml(id)}" placeholder="сек" min="0" max="59">
            <button type="button" class="btn-custom-start" onclick="startCustomBreak('${escapeHtml(id)}', event)" title="Запустити">▶</button>
        </div>
    `;

    wrap.appendChild(popover);
}

function startCustomBreak(id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const minInput = document.getElementById(`customMin_${id}`);
    const secInput = document.getElementById(`customSec_${id}`);
    const mins = parseInt(minInput ? minInput.value : 0, 10) || 0;
    const secs = parseInt(secInput ? secInput.value : 0, 10) || 0;
    const totalSeconds = mins * 60 + secs;
    if (totalSeconds <= 0) return;

    let label = 'Перерва';
    if (mins > 0 && secs > 0) {
        label = `${mins}хв ${secs}с`;
    } else if (mins > 0) {
        label = `${mins} хв`;
    } else {
        label = `${secs} с`;
    }

    startBreak(id, totalSeconds, label, event);
}

function startBreak(id, totalSeconds, label, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = document.querySelector(`.card[data-op-id="${id}"]`);
    if (card && (card.classList.contains('is-outage') || (card.dataset.outage && card.dataset.outage !== 'none'))) return;

    document.querySelectorAll('.break-menu-popover').forEach(p => p.remove());

    const totalMs = totalSeconds * 1000;
    const breaks = getBreaksState();
    breaks[id] = {
        startAt: Date.now(),
        totalMs: totalMs,
        totalSeconds: totalSeconds,
        breakUntil: Date.now() + totalMs,
        breakType: totalSeconds >= 3600 && String(label).includes('Обід') ? 'lunch' : 'break',
        label: label || 'Перерва'
    };
    setBreaksState(breaks);

    if (card) {
        const cb = card.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
        card.classList.remove('active');
    }

    checkActiveBreaks();
    showToast(`✓ Оп ${id}: перерву (${label}) активовано`);
    updateTags();
}
const startOperatorBreak = startBreak;

function cancelBreak(id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const breaks = getBreaksState();
    delete breaks[id];
    setBreaksState(breaks);

    const card = document.querySelector(`.card[data-op-id="${id}"]`);
    if (card) {
        const breakBadge = card.querySelector('.break-countdown-badge');
        if (breakBadge) breakBadge.remove();

        if ((card.dataset.outage === 'none' || !card.dataset.outage) && card.dataset.isLead !== 'true') {
            const cb = card.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = true;
            card.classList.add('active');
        }
    }

    showToast(`✓ Оп ${id}: перерву завершено`);
    updateTags();
}
const cancelOperatorBreak = cancelBreak;

function formatTimeRemaining(remainingSeconds) {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function checkActiveBreaks() {
    const breaks = getBreaksState();
    let changed = false;
    const now = Date.now();

    for (const [id, brk] of Object.entries(breaks)) {
        const card = document.querySelector(`.card[data-op-id="${id}"]`);
        const diffMs = brk.breakUntil - now;

        if (diffMs <= 0) {
            delete breaks[id];
            changed = true;
            if (card) {
                const badge = card.querySelector('.break-countdown-badge');
                if (badge) badge.remove();
                if ((card.dataset.outage === 'none' || !card.dataset.outage) && card.dataset.isLead !== 'true') {
                    const cb = card.querySelector('input[type="checkbox"]');
                    if (cb) cb.checked = true;
                    card.classList.add('active');
                }
            }
        } else if (card) {
            const totalSec = Math.max(1, Math.ceil(diffMs / 1000));
            const timeRemainingStr = formatTimeRemaining(totalSec);

            const endDate = new Date(brk.breakUntil);
            const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

            const totalMs = brk.totalMs || (brk.totalSeconds ? brk.totalSeconds * 1000 : (brk.breakType === 'lunch' ? 3600000 : 900000));
            const fractionRemaining = Math.max(0, Math.min(1, diffMs / totalMs));
            const dashoffset = (34.56 * (1 - fractionRemaining)).toFixed(2);

            const icon = brk.breakType === 'lunch' ? '🍔' : '☕️';
            const badgeContent = `
                <svg class="radial-progress-svg" viewBox="0 0 16 16">
                    <circle class="radial-bg" cx="8" cy="8" r="5.5" fill="none" stroke-width="2.5"></circle>
                    <circle class="radial-bar" cx="8" cy="8" r="5.5" fill="none" stroke-width="2.5" stroke-dasharray="34.56" stroke-dashoffset="${dashoffset}"></circle>
                </svg>
                <span>${icon} ${escapeHtml(brk.label)} (залишилось ${timeRemainingStr} • до ${endTimeStr})</span>
            `;

            let badgesContainer = card.querySelector('.card-badges');
            if (!badgesContainer) {
                badgesContainer = document.createElement('div');
                badgesContainer.className = 'card-badges';
                card.appendChild(badgesContainer);
            }

            let badge = badgesContainer.querySelector('.break-countdown-badge');
            if (badge) {
                badge.innerHTML = badgeContent;
            } else {
                badgesContainer.insertAdjacentHTML('beforeend', `<div class="break-countdown-badge" onclick="cancelBreak('${escapeHtml(id)}', event)" title="Клікніть, щоб завершити перерву">${badgeContent}</div>`);
            }

            const cb = card.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) {
                cb.checked = false;
                card.classList.remove('active');
            }
        }
    }

    if (changed) {
        setBreaksState(breaks);
        updateTags();
    }
}

if (!window._breakTimerInterval) {
    window._breakTimerInterval = setInterval(checkActiveBreaks, 1000);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.break-menu-popover') && !e.target.closest('.btn-break-trigger')) {
        document.querySelectorAll('.break-menu-popover').forEach(p => p.remove());
    }
});

// Форс-мажори (Outage Toggle)
function toggleCardOutage(btn, id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const card = btn.closest('.card') || document.querySelector(`.card[data-op-id="${id}"]`);
    if (!card) return;

    const currentOutage = card.dataset.outage || 'none';
    let nextOutage = 'none';

    if (currentOutage === 'none') {
        nextOutage = 'no_light';
    } else if (currentOutage === 'no_light') {
        nextOutage = 'no_net';
    } else if (currentOutage === 'no_net') {
        nextOutage = 'offline';
    } else {
        nextOutage = 'none';
    }

    setCardOutageState(card, nextOutage);
}

function setCardOutageState(card, outage) {
    card.dataset.outage = outage;
    const checkbox = card.querySelector('input[type="checkbox"]');
    let badgesContainer = card.querySelector('.card-badges');
    if (!badgesContainer) {
        badgesContainer = document.createElement('div');
        badgesContainer.className = 'card-badges';
        card.appendChild(badgesContainer);
    }

    const existingOutageBadge = badgesContainer.querySelector('.badge-outage');
    if (existingOutageBadge) existingOutageBadge.remove();

    const toggleBtn = card.querySelector('.btn-outage-toggle');

    if (outage === 'none') {
        card.classList.remove('is-outage');
        const id = card.dataset.opId;
        const breaks = getBreaksState();
        const hasBreak = breaks[id] && breaks[id].breakUntil > Date.now();
        const isLead = card.dataset.isLead === 'true';

        if (!hasBreak && !isLead) {
            if (checkbox) checkbox.checked = true;
            card.classList.add('active');
        }
        if (toggleBtn) {
            toggleBtn.innerText = '⚡️';
            toggleBtn.title = 'Позначити статус: Без світла / Інтернету / Офлайн';
            toggleBtn.style.opacity = '';
        }
        const breakBtn = card.querySelector('.btn-break-trigger');
        if (breakBtn) {
            breakBtn.disabled = false;
            breakBtn.title = 'Поставити перерву / обід';
        }
    } else {
        card.classList.add('is-outage');
        if (checkbox) checkbox.checked = false;
        card.classList.remove('active');

        const id = card.dataset.opId;
        const breaks = getBreaksState();
        if (breaks[id]) {
            delete breaks[id];
            setBreaksState(breaks);
            const breakBadge = card.querySelector('.break-countdown-badge');
            if (breakBadge) breakBadge.remove();
        }

        const breakBtn = card.querySelector('.btn-break-trigger');
        if (breakBtn) {
            breakBtn.disabled = true;
            breakBtn.title = 'Перерва недоступна під час форс-мажору';
        }
        const existingPopover = card.querySelector('.break-menu-popover');
        if (existingPopover) existingPopover.remove();

        let badgeHtml = '';
        let btnIcon = '⚡️';
        if (outage === 'no_light') {
            badgeHtml = '<span class="badge-role badge-outage badge-no-light">⚡️ Без світла</span>';
            btnIcon = '⚡️';
        } else if (outage === 'no_net') {
            badgeHtml = '<span class="badge-role badge-outage badge-no-net">🌐 Без інтернету</span>';
            btnIcon = '🌐';
        } else if (outage === 'offline') {
            badgeHtml = '<span class="badge-role badge-outage badge-offline">⏸ Офлайн</span>';
            btnIcon = '⏸';
        }
        badgesContainer.insertAdjacentHTML('beforeend', badgeHtml);
        if (toggleBtn) {
            toggleBtn.innerText = btnIcon;
            toggleBtn.title = `Поточний статус: ${outage}. Натисніть, щоб змінити.`;
            toggleBtn.style.opacity = '1';
        }
    }

    updateTags();
}

function updateTags() {
    const activeCards = Array.from(document.querySelectorAll('.card.active'));
    const tags = activeCards
        .map(card => card.dataset.handle || card.dataset.tag)
        .filter(Boolean);

    const resultArea = document.getElementById('tagResult');
    const counter = document.getElementById('opCounter');
    const calcOpsInput = document.getElementById('calcOpsInput');

    if (resultArea) resultArea.value = tags.join(' ');
    if (counter) counter.innerText = `Вибрано: ${tags.length}`;
    if (calcOpsInput) {
        calcOpsInput.value = tags.length;
        calculateLeadDistribution();
    }
}

function calculateLeadDistribution() {
    const leadsInput = document.getElementById('calcLeadsInput');
    const opsInput = document.getElementById('calcOpsInput');
    const resultInput = document.getElementById('calcResult');
    if (!resultInput) return;

    const leadsVal = leadsInput ? leadsInput.value.trim() : '';
    const opsVal = opsInput ? opsInput.value.trim() : '';

    if (!leadsVal || !opsVal) {
        resultInput.value = '';
        return;
    }

    const leads = parseFloat(leadsVal);
    const ops = parseInt(opsVal, 10);

    if (isNaN(leads) || isNaN(ops) || ops <= 0 || leads < 0) {
        resultInput.value = '0';
        return;
    }

    const perOp = leads / ops;
    if (Number.isInteger(perOp)) {
        resultInput.value = perOp.toString();
    } else {
        resultInput.value = Number(perOp.toFixed(1)).toString();
    }
}

function copyCalcResult() {
    const resInput = document.getElementById('calcResult');
    if (!resInput || !resInput.value.trim()) {
        showToast('⚠️ Немає розрахованого значення для копіювання');
        return;
    }

    const val = resInput.value.trim();
    const btn = document.getElementById('btnCopyCalcResult');

    const handleSuccess = () => {
        showToast(`✓ Скопійовано: ${val} на оператора`);
        if (btn) {
            const orig = btn.innerText;
            btn.innerText = '✓';
            btn.style.color = 'var(--tg-success)';
            setTimeout(() => {
                btn.innerText = orig;
                btn.style.color = '';
            }, 1500);
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(val)
            .then(handleSuccess)
            .catch(() => fallbackCopyInput(resInput, handleSuccess));
        return;
    }
    fallbackCopyInput(resInput, handleSuccess);
}

function fallbackCopyInput(inputElem, cb) {
    inputElem.focus();
    inputElem.select();
    try {
        document.execCommand('copy');
        if (cb) cb();
    } catch (err) {
        showToast('❌ Помилка копіювання');
    }
}

function exportDbToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Бібліотеку SheetJS ще не завантажено. Перевірте з\'єднання з інтернетом.');
        return;
    }

    if (!db || Object.keys(db).length === 0) {
        alert('База порожня. Немає даних для експорту.');
        return;
    }

    const ids = Object.keys(db);
    ids.sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));

    const allRows = ids.map(id => {
        const op = db[id] || {};
        const dismissed = isDismissed(op);
        return {
            "ID": Number(id) || id,
            "Ім'я": op.name || '',
            "Telegram Handle": op.tag || op.handle || '',
            "Статус": dismissed ? "Звільнився" : "Активний"
        };
    });

    const activeRows = allRows.filter(r => r["Статус"] === "Активний");
    
    // Формуємо аркуш "Звільнені": поточні звільнені + історичні звільнені власники ID
    const dismissedRows = [];
    allRows.forEach(r => {
        if (r["Статус"] === "Звільнився") {
            dismissedRows.push({ ...r });
        }
    });

    ids.forEach(id => {
        const op = db[id];
        if (op && Array.isArray(op.history)) {
            op.history.forEach(hist => {
                if (hist && (hist.status === 'dismissed' || isDismissed(hist))) {
                    dismissedRows.push({
                        "ID": Number(id) || id,
                        "Ім'я": hist.name || '',
                        "Telegram Handle": hist.tag || hist.handle || '',
                        "Статус": "Звільнився" + (hist.archivedAt ? ` (${hist.archivedAt})` : ' (історія)')
                    });
                }
            });
        }
    });

    dismissedRows.sort((a, b) => (parseInt(a["ID"], 10) || 0) - (parseInt(b["ID"], 10) || 0));

    const wb = XLSX.utils.book_new();
    const colWidths = [{ wch: 8 }, { wch: 24 }, { wch: 22 }, { wch: 18 }];

    const wsAll = XLSX.utils.json_to_sheet(allRows);
    wsAll['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsAll, 'Усі співробітники');

    const wsActive = XLSX.utils.json_to_sheet(activeRows);
    wsActive['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsActive, 'Активні');

    const wsDismissed = XLSX.utils.json_to_sheet(dismissedRows);
    wsDismissed['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsDismissed, 'Звільнені');

    XLSX.writeFile(wb, 'employees_report.xlsx');
}

function clearCache() {
    if (confirm("Скинути базу до порожньої?")) {
        localStorage.removeItem('opsDB');
        localStorage.removeItem('operator_db');
        db = {};
        editingDbList = [];
        updateButtonStates();
        processInput();
        updateTags();
    }
}

let toastTimeout = null;
function showToast(message = '✓ Теги успішно скопійовано!') {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function handleCopySuccess() {
    showToast('✓ Теги успішно скопійовано!');
    const btn = document.getElementById('btnCopyTags');
    if (btn) {
        const origText = btn.innerText;
        btn.innerText = '✓ Скопійовано!';
        btn.style.backgroundColor = 'var(--import-btn)';
        btn.style.borderColor = 'var(--import-btn)';
        setTimeout(() => {
            btn.innerText = origText;
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
        }, 1500);
    }
}

function copyTags() {
    const area = document.getElementById('tagResult');
    if (!area) return;

    if (!area.value.trim()) {
        showToast('⚠️ Немає вибраних тегів для копіювання');
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(area.value)
            .then(() => handleCopySuccess())
            .catch(() => fallbackCopy(area));
        return;
    }

    fallbackCopy(area);
}

function fallbackCopy(area) {
    area.focus();
    area.select();
    try {
        document.execCommand('copy');
        handleCopySuccess();
    } catch (err) {
        showToast('❌ Помилка копіювання');
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('opsDB') && !localStorage.getItem('operator_db')) {
        try {
            const resp = await fetch('./opsDB_backup.json');
            if (resp.ok) {
                const backupData = await resp.json();
                if (backupData && typeof backupData === 'object' && !Array.isArray(backupData)) {
                    const sanitized = {};
                    for (const [id, op] of Object.entries(backupData)) {
                        if (op && typeof op === 'object') {
                            const tag = op.handle || op.tag || '';
                            const name = sanitizeName(op.name, id);
                            const history = Array.isArray(op.history) ? op.history : [];
                            sanitized[id] = { name, tag, handle: tag, history };
                        }
                    }
                    if (Object.keys(sanitized).length > 0) {
                        db = sanitized;
                        localStorage.setItem('opsDB', JSON.stringify(db));
                        localStorage.setItem('operator_db', JSON.stringify(db));
                    }
                }
            }
        } catch (e) {
            // Тихо пропускаємо, якщо fetch заблоковано в деяких середовищах
        }
    }
    updateButtonStates();
    processInput();
});

const APP_CHANGELOG = [
    {
        version: "1.4.10",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Корона Головного бази (👑) перенесена у заголовок картки безпосередньо поруч з іменем оператора." },
            { category: "Fixed", text: "Видалено нижній бейдж «Головний (без заявок)» для оптимізації висоти та компактності карток." }
        ]
    },
    {
        version: "1.4.9",
        date: "2026-10-04",
        changes: [
            { category: "Fixed", text: "Приховано стрілки-лічильники (spin-arrows) для полів вводу хвилин та секунд у меню перерви." },
            { category: "Fixed", text: "Автоматичне блокування кнопки перерви та скидання активних таймерів під час форс-мажорів (⚡️ / 🌐 / ⏸)." },
            { category: "Fixed", text: "Вирівнювання Telegram-юзернейму по лівій напрямній картки (padding-left: 0)." }
        ]
    },
    {
        version: "1.4.8",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Власні поля вводу тривалості перерви (хвилини + секунди) разом зі швидкими пресетами (15хв, 30хв, 1год)." },
            { category: "Added", text: "Повний посекундний таймер та круговий анімований індикатор прогресу для довільних перерв." },
            { category: "Fixed", text: "Абсолютне закріплення випадаючого меню перерви безпосередньо під іконкою виклику." }
        ]
    },
    {
        version: "1.4.7",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Анімований круговий таймер-індикатор (SVG radial progress ring) для перерв та обіду." },
            { category: "Added", text: "Реальний посекундний зворотний відлік на бейджі перерви: (залишилось MM:SS • до HH:MM)." },
            { category: "Fixed", text: "Рефакторинг структури картки оператора: перенесення кнопок дій у нижній рядок до тегу та точне закріплення випадаючого меню перерви прямо під іконкою." }
        ]
    },
    {
        version: "1.4.6",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Таймери перерв та обіду (15 хв, 30 хв, 1 год) із фоновим зворотним відліком та автоповерненням." },
            { category: "Fixed", text: "Оптимізація заголовка картки оператора: повернення до компактного циклічного перемикача форс-мажорів та максимальний простір для імен." }
        ]
    },
    {
        version: "1.4.5",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Інтерактивна кнопка-корона (👑) на кожній картці оператора для швидкого призначення Головного бази." },
            { category: "Added", text: "Автоматичне правило єдиного активного Головного бази та виключення з розподілу заявок." }
        ]
    },
    {
        version: "1.4.4",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Мікро-тулбар із 3 прямими іконками статусів (⚡️ Світло / 🌐 Інтернет / ⏸ Офлайн) на кожній картці оператора." },
            { category: "Added", text: "Пряме перемикання та скидання статусу в один клік із миттєвою синхронізацією розрахунку." }
        ]
    },
    {
        version: "1.4.3",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Підтримка статусів форс-мажорів операторів: «Без світла» ⚡️, «Без інтернету» 🌐, «Офлайн» ⏸." },
            { category: "Added", text: "Автоматичний парсинг префіксів (б/с, без світла, б/і, без нету, офлайн, off тощо) та виключення з розрахунку." },
            { category: "Added", text: "Інтерактивний перемикач статусу на кожній картці оператора в 1 клік." }
        ]
    },
    {
        version: "1.4.2",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Підтримка синтаксису Головного бази «(г)» / «(g)» із вимкненням за замовчуванням та бейджем 👑." },
            { category: "Added", text: "Парсинг зміни «(до HH)» з динамічною перевіркою часу (минула зміна ⏳ / скоро кінець ⚠️ / активна 🕒)." }
        ]
    },
    {
        version: "1.4.1",
        date: "2026-10-04",
        changes: [
            { category: "Added", text: "Інтерактивний калькулятор розподілу заявок на активних операторів." },
            { category: "Added", text: "Автоматична синхронізація кількості операторів та миттєве копіювання результату." }
        ]
    },
    {
        version: "1.4.0",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Інтерактивний віджет версії v1.4.0 у лівому нижньому куті." },
            { category: "Added", text: "Вбудоване модальне вікно Changelog з фільтрацією за категоріями (Added / Fixed / Security)." }
        ]
    },
    {
        version: "1.3.5",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Фірмовий векторний Telegram SVG-фавікон та apple-touch-icon." }
        ]
    },
    {
        version: "1.3.4",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Відстеження та архівація історії зміни власників ID операторів (history)." },
            { category: "Added", text: "В експорті Excel аркуш «Звільнені» включає як поточних, так і історичних звільнених співробітників." }
        ]
    },
    {
        version: "1.3.3",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Повний рестайлінг інтерфейсу під автентичну тему Telegram Desktop / Web Dark Theme." }
        ]
    },
    {
        version: "1.3.2",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Неблокуючі плаваючі сповіщення (Toast notifications) при копіюванні тегів замість alert()." },
            { category: "Added", text: "Інтерактивний зворотний зв'язок на кнопці «Copy to Clipboard»." }
        ]
    },
    {
        version: "1.3.1",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Outline/Ghost редизайн кнопок та реактивний менеджер станів." }
        ]
    },
    {
        version: "1.3.0",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Фільтрація статусів (Усі / Активні / Звільнені) у модальному вікні редагування бази." },
            { category: "Added", text: "Багатосторінковий Excel-експорт (employees_report.xlsx) із 3 вкладками." }
        ]
    },
    {
        version: "1.2.9",
        date: "2026-10-01",
        changes: [
            { category: "Added", text: "Клієнтський експорт бази операторів у Excel." },
            { category: "Security", text: "Політика Zero-Leak: DEFAULT_DB = {} залишається суворо порожнім." }
        ]
    },
    {
        version: "1.2.8",
        date: "2026-10-01",
        changes: [
            { category: "Fixed", text: "Автоматична санітизація імен операторів у loadDB() (очищення технічних шаблонів Оп #id)." }
        ]
    }
];

let changelogCategoryFilter = 'all';

function toggleChangelogModal() {
    const modal = document.getElementById('changelogModal');
    if (!modal) return;
    const shouldOpen = modal.style.display !== 'flex';
    modal.style.display = shouldOpen ? 'flex' : 'none';
    if (shouldOpen) {
        changelogCategoryFilter = 'all';
        const filterGroup = modal.querySelector('.status-filter-group');
        if (filterGroup) {
            filterGroup.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
            const allBtn = filterGroup.querySelector('.btn-filter');
            if (allBtn) allBtn.classList.add('active');
        }
        renderChangelog();
    }
}

function filterChangelog(category, btn) {
    changelogCategoryFilter = category || 'all';
    if (btn && btn.parentElement) {
        btn.parentElement.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    renderChangelog();
}

function renderChangelog() {
    const container = document.getElementById('changelogContainer');
    if (!container) return;
    container.innerHTML = '';

    const filteredReleases = APP_CHANGELOG.map(rel => {
        const filteredChanges = rel.changes.filter(ch => {
            if (changelogCategoryFilter === 'all') return true;
            return ch.category.toLowerCase() === changelogCategoryFilter.toLowerCase();
        });
        return { ...rel, changes: filteredChanges };
    }).filter(rel => rel.changes.length > 0);

    if (filteredReleases.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--tg-text-muted); padding:24px;">Немає записів у цій категорії.</div>';
        return;
    }

    filteredReleases.forEach(rel => {
        const card = document.createElement('div');
        card.className = 'changelog-card';
        card.innerHTML = `
            <div class="changelog-ver-header">
                <span class="changelog-ver-title">v${escapeHtml(rel.version)}</span>
                <span class="changelog-ver-date">${escapeHtml(rel.date)}</span>
            </div>
            <ul class="changelog-list">
                ${rel.changes.map(ch => `
                    <li>
                        <span class="changelog-tag ${ch.category.toLowerCase()}">${escapeHtml(ch.category)}</span>
                        ${escapeHtml(ch.text)}
                    </li>
                `).join('')}
            </ul>
        `;
        container.appendChild(card);
    });
}
