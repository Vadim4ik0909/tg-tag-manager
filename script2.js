const DEFAULT_DB = {
    "1": { name: "Тестовий Оператор", handle: "@test_op" }
};

function loadDB() {
    try {
        const raw = localStorage.getItem('opsDB');
        if (!raw) return { ...DEFAULT_DB };
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...DEFAULT_DB };
    } catch (error) {
        return { ...DEFAULT_DB };
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

// Логіка роботи
function processInput() {
    const input = document.getElementById('inputIds').value || '';
    const grid = document.getElementById('operatorGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const parts = input.match(/\d+/g) || [];

    parts.forEach(id => {
        const op = db[id];
        const div = document.createElement('div');

        if (!op) {
            div.className = 'card';
            div.style.borderColor = 'var(--warn)';
            div.innerHTML = `⚠️ ${id}: Немає в базі`;
        } else {
            div.className = 'card active';
            div.innerHTML = `<input type="checkbox" checked onchange="this.parentElement.classList.toggle('active'); updateTags()">
                             <strong>${op.name}</strong><br><small>${op.handle}</small>`;
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
    if (confirm("Скинути базу до стандартної?")) {
        localStorage.removeItem('opsDB');
        db = { ...DEFAULT_DB };
        location.reload();
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



