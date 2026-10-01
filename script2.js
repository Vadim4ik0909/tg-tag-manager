const DEFAULT_DB = {};

function loadDB() {
    try {
        const raw = localStorage.getItem('opsDB');
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

function ensureDbEditor() {
    const editor = document.getElementById('dbEditor');
    if (editor) {
        editor.value = JSON.stringify(db, null, 2);
    }
}

function toggleModal() {
    const modal = document.getElementById('dbModal');
    if (!modal) return;

    const shouldOpen = modal.style.display !== 'flex';
    modal.style.display = shouldOpen ? 'flex' : 'none';

    if (shouldOpen) {
        ensureDbEditor();
    }
}

function saveDB() {
    const editor = document.getElementById('dbEditor');
    if (!editor) return;

    try {
        const parsed = JSON.parse(editor.value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('DB must be an object');
        }

        db = parsed;
        localStorage.setItem('opsDB', JSON.stringify(db));
        toggleModal();
        processInput();
    } catch (error) {
        alert('Невалідний JSON бази. Перевірте синтаксис.');
    }
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
                            importedDB[String(id).trim()] = { name: String(name).trim(), handle };
                        }
                    });
                } else if (parsed && typeof parsed === 'object') {
                    for (const [key, val] of Object.entries(parsed)) {
                        if (val && typeof val === 'object') {
                            const tag = val.handle || val.tag || val.telegram || val.тег || '';
                            let handle = String(tag).trim();
                            if (handle && !handle.startsWith('@')) handle = '@' + handle;
                            const name = val.name || val['ім\'я'] || `Оп ${key}`;
                            if (handle) {
                                importedDB[String(key).trim()] = { name: String(name).trim(), handle };
                            }
                        }
                    }
                }

                if (Object.keys(importedDB).length === 0) {
                    throw new Error('У файлі JSON не знайдено валідних записів операторів');
                }

                db = importedDB;
                localStorage.setItem('opsDB', JSON.stringify(db));
                ensureDbEditor();
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
                ensureDbEditor();
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
                             <strong>${op.name} (#${id})</strong><br><small>${op.handle}</small>`;
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
        db = {};
        ensureDbEditor();
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
    ensureDbEditor();
    processInput();
});
