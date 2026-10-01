const DEFAULT_DB = {};

function loadDB() {
    try {
        const raw = localStorage.getItem('opsDB') || localStorage.getItem('operator_db');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return parsed;
    } catch (error) {
        return {};
    }
}

let db = loadDB();
let editingDbList = [];

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
            name: db[id]?.name || '',
            handle: db[id]?.handle || ''
        }));
        
        // Сортуємо за числовим ID
        editingDbList.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
        
        const searchInput = document.getElementById('dbSearch');
        if (searchInput) searchInput.value = '';
        
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
            if (handleInput) editingDbList[origIdx].handle = handleInput.value;
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
            if (!searchQuery) return true;
            return (
                String(item.id).toLowerCase().includes(searchQuery) ||
                String(item.name).toLowerCase().includes(searchQuery) ||
                String(item.handle).toLowerCase().includes(searchQuery)
            );
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

        row.innerHTML = `
            <input type="text" class="row-id" placeholder="ID" value="${escapeHtml(item.id)}" title="Номер ID">
            <input type="text" class="row-name" placeholder="Ім'я" value="${escapeHtml(item.name)}" title="Ім'я оператора">
            <input type="text" class="row-handle" placeholder="@тег" value="${escapeHtml(item.handle)}" title="Telegram-тег">
            <button type="button" class="btn-del" title="Видалити запис" onclick="deleteDbRow(${originalIndex})">🗑️</button>
        `;
        container.appendChild(row);
    });
}

function addNewDbRow() {
    syncEditingDbFromDom();
    editingDbList.unshift({ id: '', name: '', handle: '' });
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
        let cleanHandle = String(item.handle || '').trim();
        const cleanName = String(item.name || '').trim();

        if (!cleanId && !cleanHandle && !cleanName) {
            continue; // Пропускаємо порожні рядки
        }

        if (!cleanId) {
            alert(`Рядок #${i + 1}: ID не може бути порожнім`);
            hasErrors = true;
            break;
        }

        if (!cleanHandle) {
            alert(`Рядок #${i + 1} (ID: ${cleanId}): Telegram-тег не може бути порожнім`);
            hasErrors = true;
            break;
        }

        if (seenIds.has(cleanId)) {
            alert(`Помилка: дублікат ID "${cleanId}". Кожен номер повинен бути унікальним.`);
            hasErrors = true;
            break;
        }

        if (!cleanHandle.startsWith('@')) {
            cleanHandle = '@' + cleanHandle;
        }

        if (cleanId === '41' && cleanHandle === '@maria63') {
            cleanHandle = '@mariiia63';
        }

        seenIds.add(cleanId);
        newDb[cleanId] = {
            name: cleanName || `Оп ${cleanId}`,
            handle: cleanHandle
        };
    }

    if (hasErrors) return;

    db = newDb;
    localStorage.setItem('opsDB', JSON.stringify(db));
    localStorage.setItem('operator_db', JSON.stringify(db));
    toggleModal();
    processInput();
    alert(`Зміни успішно збережено! Всього операторів у базі: ${Object.keys(db).length}`);
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
                        const id = item.id || item.idVal || item['№ оп'] || item['номер'];
                        const tag = item.handle || item.tag || item.telegram || item.тег;
                        const name = item.name || item['ім\'я'] || item['имя'] || `Оп ${id}`;
                        if (id && tag) {
                            let handle = String(tag).trim();
                            if (!handle.startsWith('@')) handle = '@' + handle;
                            const cleanId = String(id).trim();
                            if (cleanId === '41' && handle === '@maria63') handle = '@mariiia63';
                            importedDB[cleanId] = { name: String(name).trim(), handle };
                        }
                    });
                } else if (parsed && typeof parsed === 'object') {
                    for (const [key, val] of Object.entries(parsed)) {
                        if (val && typeof val === 'object') {
                            const tag = val.handle || val.tag || val.telegram || val.тег || '';
                            let handle = String(tag).trim();
                            if (handle && !handle.startsWith('@')) handle = '@' + handle;
                            const cleanId = String(key).trim();
                            if (cleanId === '41' && handle === '@maria63') handle = '@mariiia63';
                            const name = val.name || val['ім\'я'] || `Оп ${key}`;
                            if (handle) {
                                importedDB[cleanId] = { name: String(name).trim(), handle };
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
                        if (/^(№\s*оп|id|номер|оп)/i.test(cleanKey) && idVal === null) {
                            idVal = row[key];
                        } else if (/(telegram|тег|handle|нік|tag)/i.test(cleanKey) && tagVal === null) {
                            tagVal = row[key];
                        } else if (/(ім'я|имя|name|піб)/i.test(cleanKey) && nameVal === null) {
                            nameVal = row[key];
                        }
                    }

                    if (idVal !== null && idVal !== undefined && tagVal) {
                        const id = String(idVal).trim();
                        let handle = String(tagVal).trim();
                        if (!handle.startsWith('@')) handle = '@' + handle;
                        if (id === '41' && handle === '@maria63') handle = '@mariiia63';
                        const name = nameVal ? String(nameVal).trim() : `Оп ${id}`;
                        if (id) {
                            importedDB[id] = { name, handle };
                        }
                    }
                });

                if (Object.keys(importedDB).length === 0) {
                    throw new Error('Не знайдено валідних колонок (ID/Тег) або рядків у таблиці');
                }

                db = importedDB;
                localStorage.setItem('opsDB', JSON.stringify(db));
                localStorage.setItem('operator_db', JSON.stringify(db));
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

// Логіка роботи
function processInput() {
    const grid = document.getElementById('operatorGrid');
    if (!grid) return;

    if (!db || Object.keys(db).length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; color: var(--warn); padding: 14px; background: rgba(231, 76, 60, 0.1); border-radius: 8px; border: 1px dashed var(--warn); font-size: 14px; text-align: center;">⚠️ База операторів порожня. Натисніть кнопку <strong>"Import Base"</strong> та оберіть файл з тегами (.xlsx / .json).</div>';
        updateTags();
        return;
    }

    const input = document.getElementById('inputIds')?.value || '';
    grid.innerHTML = '';
    const rawIds = input.match(/\d+/g) || [];
    const uniqueIds = [...new Set(rawIds)];

    uniqueIds.forEach(id => {
        const op = db[id];
        const div = document.createElement('div');

        if (!op) {
            div.className = 'card';
            div.style.borderColor = 'var(--warn)';
            div.innerHTML = `⚠️ #${id}: Немає в базі`;
        } else {
            div.className = 'card active';
            div.innerHTML = `<input type="checkbox" checked onchange="this.parentElement.classList.toggle('active'); updateTags()">
                             <strong>${escapeHtml(op.name)} (#${escapeHtml(id)})</strong><br><small>${escapeHtml(op.handle)}</small>`;
            div.dataset.handle = op.handle;
        }

        grid.appendChild(div);
    });

    updateTags();
}

function updateTags() {
    const activeCards = Array.from(document.querySelectorAll('.card.active'));
    const tags = activeCards
        .map(card => card.dataset.handle)
        .filter(Boolean);

    const resultArea = document.getElementById('tagResult');
    const counter = document.getElementById('opCounter');

    if (resultArea) resultArea.value = tags.join(' ');
    if (counter) counter.innerText = `Вибрано: ${tags.length}`;
}

function clearCache() {
    if (confirm("Скинути базу до порожньої?")) {
        localStorage.removeItem('opsDB');
        localStorage.removeItem('operator_db');
        db = {};
        processInput();
    }
}

function copyTags() {
    const area = document.getElementById('tagResult');
    if (!area) return;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(area.value)
            .then(() => alert('Скопійовано!'))
            .catch(() => fallbackCopy(area));
        return;
    }

    fallbackCopy(area);
}

function fallbackCopy(area) {
    area.focus();
    area.select();
    document.execCommand('copy');
    alert('Скопійовано!');
}

window.addEventListener('DOMContentLoaded', () => {
    processInput();
});
