document.addEventListener('DOMContentLoaded', async () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const menuBackdrop = document.querySelector('.menu-backdrop');
    const navigation = document.querySelector('.navbar');

    function setMenuState(isOpen) {
        document.body.classList.toggle('menu-open', isOpen);

        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Menüyü kapat' : 'Menüyü aç');
        }
    }

    if (menuToggle && navigation) {
        menuToggle.addEventListener('click', () => {
            setMenuState(!document.body.classList.contains('menu-open'));
        });

        menuBackdrop?.addEventListener('click', () => setMenuState(false));

        navigation.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenuState(false));
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                setMenuState(false);
            }
        });
    }

    function normalizeDateValue(value) {
        const cleanedValue = value.trim().replace(/\s*\([^)]*\)\s*$/, '');
        const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanedValue);

        if (isoDate) {
            return `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}`;
        }

        return cleanedValue;
    }

    document.querySelectorAll('[data-table-filter]').forEach((filterInput) => {
        const table = document.getElementById(filterInput.dataset.tableFilter);
        if (!table) return;

        const tableBody = table.querySelector('tbody');
        const rows = Array.from(tableBody?.querySelectorAll('tr') || []);
        const countElement = document.getElementById(filterInput.dataset.countTarget);

        if (!tableBody || rows.length === 0) return;

        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyRow.className = 'filter-empty-row';
        emptyRow.hidden = true;
        emptyCell.colSpan = table.querySelectorAll('thead th').length || 1;
        emptyCell.textContent = 'Seçilen tarihe uygun kayıt bulunamadı.';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);

        function filterTable() {
            const filterValue = normalizeDateValue(filterInput.value).toLocaleLowerCase('tr-TR');
            let visibleCount = 0;

            rows.forEach((row) => {
                const rowDate = normalizeDateValue(
                    row.dataset.date || row.cells[0]?.textContent || ''
                ).toLocaleLowerCase('tr-TR');
                const isVisible = !filterValue || rowDate.includes(filterValue);

                row.hidden = !isVisible;
                if (isVisible) visibleCount += 1;
            });

            emptyRow.hidden = visibleCount !== 0;

            if (countElement) {
                countElement.textContent = `${visibleCount} kayıt`;
            }
        }

        filterInput.addEventListener('input', filterTable);
        filterInput.addEventListener('change', filterTable);
    });

    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    try {
        const response = await fetch('http://localhost:3000/');
        const data = await response.json();
        statusEl.textContent = data.message;
    } catch (error) {
        statusEl.textContent = 'Backend bağlantı kurulamadı';
        console.error('Hata:', error);
    }
});
