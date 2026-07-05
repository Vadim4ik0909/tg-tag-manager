// Повна база операторів
let db = JSON.parse(localStorage.getItem('opsDB')) || {
    "1": { name: "Лілія", handle: "@lilialilia111" },
    "2": { name: "Krystyna", handle: "@krystyna_sss" },
    "6": { name: "звільнився", handle: "@praskly" },
    "9": { name: "Viktor", handle: "@Diehummer" },
    "13": { name: "звільнився", handle: "@mokssikk" },
    "17": { name: "Tatiana", handle: "@Tatiana_on17" },
    "29": { name: "B", handle: "@TaraskinSHK" },
    "30": { name: "Roman", handle: "@dragoliuk" },
    "31": { name: "Даня", handle: "@goshhdamn" },
    "33": { name: "ANYA.", handle: "@reisew" },
    "34": { name: "звільнився", handle: "@Olga_Kolyadaa" },
    "36": { name: "звільнився", handle: "@ilonsssii" },
    "39": { name: "Макс DZ ;)", handle: "@Max_Improve" },
    "41": { name: "Maria Tkachuk", handle: "@maria63" },
    "43": { name: "Сергій", handle: "@etherlast" },
    "47": { name: "Любов", handle: "@mai_liubov" },
    "51": { name: "Наталя", handle: "@natali0109k" },
    "52": { name: "VOLODYA ST JS52", handle: "@volodya_saaa" },
    "60": { name: "Ann Makarchuk", handle: "@ann_makarchuk" },
    "73": { name: "Льоша JS73", handle: "@JliMon4uK" },
    "92": { name: "звільнився", handle: "@Elfen_king" },
    "95": { name: "Roman Semchuk", handle: "@op95js" },
    "100": { name: "Діма М", handle: "@Makhmud2008" },
    "101": { name: "Стьопа", handle: "@STE1509PAN" },
    "105": { name: "Тарас", handle: "@t346633" },
    "106": { name: "Іванка Фалімонова", handle: "@ifalimonova" }
};

// Логіка роботи
function processInput() {
    const input = document.getElementById('inputIds').value;
    const grid = document.getElementById('operatorGrid');
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
    const activeCards = document.querySelectorAll('.card.active:not([style*="border-color: var(--warn)"])');
    const tags = Array.from(activeCards).map(c => c.dataset.handle);
    document.getElementById('tagResult').value = tags.join(' ');
    document.getElementById('opCounter').innerText = `Вибрано: ${tags.length}`;
}

function clearCache() {
    if (confirm("Скинути базу до стандартної?")) {
        localStorage.removeItem('opsDB');
        location.reload();
    }
}

function copyTags() {
    const area = document.getElementById('tagResult');
    area.select();
    document.execCommand('copy');
    alert("Скопійовано!");
}