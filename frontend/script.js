const API_CONFIG = Object.freeze({
    baseUrl: 'http://localhost:3000',
    // Arıza route'u backend'e bağlandığında false yapılmalıdır.
    useMockData: true
});

const AUTH_TOKEN_KEY = 'securelab_auth_token';
const appState = {
    currentUser: null,
    kullanicilar: [],
    kartlar: [],
    yetkilendirmeler: []
};

class ApiError extends Error {
    constructor(message, status = 0, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

function getAuthToken() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
    if (typeof token !== 'string' || !token.trim()) {
        throw new Error('Geçerli bir oturum anahtarı alınamadı.');
    }

    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    appState.currentUser = null;
}

function buildAuthHeaders() {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function redirectToLogin() {
    if (!window.location.pathname.endsWith('/login.html')) {
        window.location.replace('login.html');
    }
}

async function apiRequest(endpoint, options = {}) {
    const requestOptions = { ...options };
    const headers = new Headers(options.headers || {});
    const tokenHeaders = buildAuthHeaders();

    Object.entries(tokenHeaders).forEach(([name, value]) => headers.set(name, value));

    if (requestOptions.body && !(requestOptions.body instanceof FormData) && typeof requestOptions.body !== 'string') {
        headers.set('Content-Type', 'application/json');
        requestOptions.body = JSON.stringify(requestOptions.body);
    }

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    requestOptions.headers = headers;

    let response;
    try {
        response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, requestOptions);
    } catch (error) {
        throw new ApiError('Backend bağlantısı kurulamadı. Servisin çalıştığını kontrol edin.', 0);
    }

    const responseText = await response.text();
    let responseData = null;

    if (responseText) {
        try {
            responseData = JSON.parse(responseText);
        } catch (error) {
            if (!response.ok) {
                throw new ApiError('Sunucudan geçersiz bir hata yanıtı alındı.', response.status);
            }
            throw new ApiError('Sunucudan beklenen JSON yanıtı alınamadı.', response.status);
        }
    }

    if (!response.ok) {
        const message = responseData?.message
            || responseData?.hata
            || (response.status === 403
                ? 'Bu işlem için yetkiniz bulunmuyor.'
                : 'İstek tamamlanamadı.');

        if (response.status === 401 && endpoint !== '/api/auth/login') {
            clearAuthToken();
            redirectToLogin();
        }

        throw new ApiError(message, response.status, responseData);
    }

    return responseData;
}

function handleApiError(error) {
    if (error instanceof ApiError) {
        if (error.status === 403) return 'Bu işlem için yetkiniz bulunmuyor.';
        if (error.status >= 500) return 'Sunucuda bir sorun oluştu. Lütfen daha sonra tekrar deneyin.';
        return error.message;
    }

    return 'Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.';
}

function getStateCell(container) {
    if (!(container instanceof HTMLTableSectionElement)) return container;

    const row = document.createElement('tr');
    const cell = document.createElement('td');
    const table = container.closest('table');
    cell.colSpan = table?.querySelectorAll('thead th').length || 1;
    row.appendChild(cell);
    container.replaceChildren(row);
    return cell;
}

function showLoading(container) {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'integration-state integration-loading';
    target.textContent = 'Veriler yükleniyor…';
}

function showEmpty(container, message = 'Kayıt bulunamadı.') {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'integration-state integration-empty';
    target.textContent = message;
}

function showError(container, message) {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'integration-state integration-error';
    target.textContent = message;
    target.hidden = false;
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createBadge(text, variant = 'neutral') {
    return createElement('span', `badge badge-${variant}`, text);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setInlineMessage(element, message = '', type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.className = `inline-message inline-message-${type}`;
    element.hidden = !message;
}

function normalizeDateValue(value) {
    const cleanedValue = String(value || '').trim().replace(/\s*\([^)]*\)\s*$/, '');
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanedValue);
    return isoDate ? `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}` : cleanedValue;
}

function applyTableFilter(filterInput) {
    const table = document.getElementById(filterInput.dataset.tableFilter);
    const tableBody = table?.querySelector('tbody');
    if (!tableBody) return;

    const rows = Array.from(tableBody.querySelectorAll('tr:not(.filter-empty-row)'))
        .filter((row) => !row.classList.contains('integration-state-row'));
    let emptyRow = tableBody.querySelector('.filter-empty-row');

    if (!emptyRow) {
        emptyRow = document.createElement('tr');
        emptyRow.className = 'filter-empty-row';
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = table.querySelectorAll('thead th').length || 1;
        emptyCell.textContent = 'Seçilen tarihe uygun kayıt bulunamadı.';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
    }

    const filterValue = normalizeDateValue(filterInput.value).toLocaleLowerCase('tr-TR');
    let visibleCount = 0;

    rows.forEach((row) => {
        const rowDate = normalizeDateValue(row.dataset.date || row.cells[0]?.textContent)
            .toLocaleLowerCase('tr-TR');
        const visible = !filterValue || rowDate.includes(filterValue);
        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    emptyRow.hidden = visibleCount !== 0 || rows.length === 0;
    const countElement = document.getElementById(filterInput.dataset.countTarget);
    if (countElement) countElement.textContent = `${visibleCount} kayıt`;
}

function initTableFilters() {
    document.querySelectorAll('[data-table-filter]').forEach((filterInput) => {
        filterInput.addEventListener('input', () => applyTableFilter(filterInput));
        filterInput.addEventListener('change', () => applyTableFilter(filterInput));
    });
}

function refreshTableFilter(tableId) {
    const filter = document.querySelector(`[data-table-filter="${tableId}"]`);
    if (filter) applyTableFilter(filter);
}

function initNavigation() {
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

    if (!menuToggle || !navigation) return;

    menuToggle.addEventListener('click', () => {
        setMenuState(!document.body.classList.contains('menu-open'));
    });
    menuBackdrop?.addEventListener('click', () => setMenuState(false));
    navigation.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuState(false));
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMenuState(false);
    });
}

function initLogout() {
    document.querySelectorAll('.logout-link').forEach((link) => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                // Logout endpoint'i durum tutmuyor; yerel token her durumda temizlenir.
            } finally {
                clearAuthToken();
                window.location.assign('login.html');
            }
        });
    });
}

async function getCurrentUser() {
    const response = await apiRequest('/api/auth/me');
    if (!response?.user?.kullaniciId) {
        throw new ApiError('Oturum kullanıcı bilgisi doğrulanamadı.', 401);
    }
    appState.currentUser = response.user;
    return response.user;
}

async function requireAuthentication() {
    if (!getAuthToken()) {
        redirectToLogin();
        return false;
    }

    try {
        await getCurrentUser();
        return true;
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            clearAuthToken();
            redirectToLogin();
            return false;
        }

        const pageStatus = document.querySelector('[data-page-status]');
        if (pageStatus) showError(pageStatus, handleApiError(error));
        return false;
    }
}

function getRoleDestination(role) {
    const destinations = {
        admin: 'admin.html',
        hoca: 'index.html',
        sistem: 'index.html'
    };
    return destinations[role] || null;
}

function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const emailInput = document.getElementById('login-email');
    const pinInput = document.getElementById('login-pin');
    const submitButton = document.getElementById('login-submit');
    const message = document.getElementById('login-message');
    const forgotLink = document.getElementById('forgot-password');

    forgotLink?.addEventListener('click', (event) => {
        event.preventDefault();
        setInlineMessage(message, 'Şifre sıfırlama endpointi backend’de bulunmuyor.', 'warning');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const eposta = emailInput.value.trim();
        const pin = pinInput.value;

        if (!eposta || !pin) {
            setInlineMessage(message, 'E-posta ve PIN / şifre alanları zorunludur.', 'error');
            return;
        }

        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Giriş yapılıyor…';
        setInlineMessage(message);

        try {
            const response = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: { eposta, pin }
            });

            const destination = getRoleDestination(response?.user?.rol);
            if (!response?.token || !destination) {
                throw new ApiError('Giriş yanıtındaki token veya rol bilgisi doğrulanamadı.');
            }

            setAuthToken(response.token);
            window.location.assign(destination);
        } catch (error) {
            clearAuthToken();
            setInlineMessage(message, handleApiError(error), 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
}

async function getKullanicilar() {
    return apiRequest('/api/kullanicilar');
}

function renderKullanicilar(data) {
    appState.kullanicilar = Array.isArray(data) ? data : [];
    setText('admin-user-count', String(appState.kullanicilar.length));
    setText('auth-user-count', String(appState.kullanicilar.length));
    setText('auth-user-count-badge', `${appState.kullanicilar.length} tanımlı kullanıcı`);

    const select = document.getElementById('auth-full-name');
    if (!select) return;

    const placeholder = createElement('option', '', appState.kullanicilar.length
        ? 'Kullanıcı seçin'
        : 'Kayıtlı kullanıcı bulunamadı');
    placeholder.value = '';
    select.replaceChildren(placeholder);

    appState.kullanicilar.forEach((user) => {
        const option = createElement('option', '', `${user.ad || ''} ${user.soyad || ''}`.trim());
        option.value = String(user.kullaniciId);
        option.dataset.role = user.rol || '';
        select.appendChild(option);
    });
}

async function getKartlar() {
    return apiRequest('/api/kartlar');
}

function renderKartlar(data) {
    appState.kartlar = Array.isArray(data) ? data : [];
    setText('admin-card-count', String(appState.kartlar.length));

    const list = document.getElementById('rfid-card-options');
    if (!list) return;
    list.replaceChildren();
    appState.kartlar.forEach((card) => {
        const option = document.createElement('option');
        option.value = card.kartUid;
        option.label = card.durum || '';
        list.appendChild(option);
    });
}

async function getKapilar() {
    return apiRequest('/api/kapilar');
}

function renderKapilar(data) {
    const doors = Array.isArray(data) ? data : [];
    const activeDoors = doors.filter((door) => door.durum === 'aktif');
    setText('admin-door-count', String(doors.length));
    setText('admin-door-state', doors.length ? `${activeDoors.length} aktif` : 'Kayıt yok');
    setText('admin-door-detail', doors.length
        ? `${doors.length} kapı kaydından ${activeDoors.length} tanesi aktif`
        : 'Backend kapı kaydı döndürmedi');
    setText('admin-door-status', doors[0]?.durum ? humanizeEnum(doors[0].durum) : 'Kayıt yok');
}

async function getCihazlar() {
    return apiRequest('/api/cihazlar');
}

function renderCihazlar(data) {
    const devices = Array.isArray(data) ? data : [];
    const activeDevices = devices.filter((device) => device.durum === 'aktif');
    setText('admin-device-count', String(devices.length));
    setText('admin-device-state', devices.length ? `${activeDevices.length} aktif` : 'Kayıt yok');
    setText('admin-device-detail', devices.length
        ? `${devices.length} cihaz kaydından ${activeDevices.length} tanesi aktif`
        : 'Backend cihaz kaydı döndürmedi');
}

async function getCihazDurumlari() {
    return apiRequest('/api/cihaz-durumlari');
}

function renderCihazDurumlari(data) {
    const statuses = Array.isArray(data) ? data : [];
    const latest = [...statuses].sort((a, b) => {
        return new Date(b.olcumTamani || b.kayitTamani || 0) - new Date(a.olcumTamani || a.kayitTamani || 0);
    })[0];

    setText('admin-device-connection', latest?.baglantiDurumu
        ? humanizeEnum(latest.baglantiDurumu)
        : 'Durum kaydı yok');
}

async function getKartYetkilendirmeler() {
    return apiRequest('/api/kart-yetkilendirmeler');
}

function humanizeEnum(value) {
    const labels = {
        aktif: 'Aktif',
        pasif: 'Pasif',
        askida: 'Askıda',
        iptal: 'İptal',
        kayip: 'Kayıp',
        hasarli: 'Hasarlı',
        bakimda: 'Bakımda',
        devredisi: 'Devre dışı',
        arizali: 'Arızalı',
        emekli: 'Emekli',
        cevrimici: 'Çevrimiçi',
        cevrimdisi: 'Çevrimdışı',
        hatali: 'Hatalı',
        hoca: 'Hoca',
        admin: 'Yönetici',
        sistem: 'Sistem',
        kart: 'RFID Kart',
        pin: 'PIN',
        izin: 'İzin verildi',
        red: 'Reddedildi'
    };
    return labels[value] || String(value || '—');
}

function renderYetkilendirmeler(data) {
    appState.yetkilendirmeler = Array.isArray(data) ? data : [];
    const tableBody = document.getElementById('authorization-table-body');
    if (!tableBody) return;

    const activeCount = appState.yetkilendirmeler.filter((item) => item.durum === 'aktif').length;
    const passiveCount = appState.yetkilendirmeler.length - activeCount;
    setText('auth-active-count', String(activeCount));
    setText('auth-passive-count', String(passiveCount));
    setText('auth-table-count', `${appState.yetkilendirmeler.length} yetki`);

    if (!appState.yetkilendirmeler.length) {
        showEmpty(tableBody, 'Tanımlı kart yetkisi bulunamadı.');
        return;
    }

    const fragment = document.createDocumentFragment();
    appState.yetkilendirmeler.forEach((permission) => {
        const row = document.createElement('tr');
        const user = permission.kullanici || {};
        const nameCell = createElement('td', 'cell-primary', `${user.ad || ''} ${user.soyad || ''}`.trim() || 'Bilinmeyen');
        const roleCell = document.createElement('td');
        roleCell.appendChild(createBadge(humanizeEnum(user.rol), user.rol === 'hoca' ? 'info' : 'neutral'));
        const cardCell = document.createElement('td');
        cardCell.appendChild(createElement('code', '', permission.kartUid || '—'));
        const pinCell = createElement('td', 'cell-secondary', 'API tarafından paylaşılmaz');
        const statusCell = document.createElement('td');
        const isActive = permission.durum === 'aktif';
        statusCell.appendChild(createBadge(isActive ? 'Yetkili' : humanizeEnum(permission.durum), isActive ? 'success' : 'danger'));
        const actionCell = document.createElement('td');
        const button = createElement('button', `switch-btn ${isActive ? 'btn-passive' : 'btn-active'}`, isActive ? 'Yetkiyi Kaldır' : 'Yetki Ver');
        button.type = 'button';
        button.dataset.permissionId = String(permission.kartYetkiId);
        button.dataset.currentStatus = permission.durum;
        actionCell.appendChild(button);
        row.append(nameCell, roleCell, cardCell, pinCell, statusCell, actionCell);
        fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
}

async function getErisimKayitlari(limit = 100, offset = 0) {
    return apiRequest(`/api/erisim-kayitlari?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);
}

function createAccessRow(record, compact = false) {
    const row = document.createElement('tr');
    const eventDate = record.olayTamani || record.kayitTamani;
    row.dataset.date = formatDate(eventDate);

    const dateCell = document.createElement('td');
    if (compact) {
        dateCell.className = 'cell-primary';
        dateCell.textContent = formatTime(eventDate);
    } else {
        dateCell.append(
            createElement('span', 'cell-primary', formatDate(eventDate)),
            createElement('span', 'cell-secondary', formatTime(eventDate))
        );
    }

    const user = record.kullanici;
    const userCell = createElement('td', 'cell-primary', user
        ? `${user.ad || ''} ${user.soyad || ''}`.trim()
        : 'Bilinmeyen');
    const roleCell = createElement('td', '', user ? humanizeEnum(user.rol) : '—');
    const methodCell = createElement('td', '', humanizeEnum(record.dogrulamaYontemi));
    const doorCell = createElement('td', '', record.kapi?.ad || '—');
    const resultCell = document.createElement('td');
    const allowed = record.sonuc === 'izin';
    const resultText = allowed
        ? 'İzin verildi'
        : `Reddedildi${record.redNedeni ? `: ${record.redNedeni}` : ''}`;
    resultCell.appendChild(createBadge(resultText, allowed ? 'success' : 'danger'));

    if (compact) {
        row.append(dateCell, userCell, roleCell, methodCell, resultCell);
    } else {
        row.append(dateCell, userCell, roleCell, methodCell, doorCell, resultCell);
    }
    return row;
}

function renderAccessTable(tableId, data, compact = false) {
    const table = document.getElementById(tableId);
    const tableBody = table?.querySelector('tbody');
    if (!tableBody) return;
    const records = Array.isArray(data) ? data : [];

    if (!records.length) {
        showEmpty(tableBody, 'Erişim kaydı bulunamadı.');
        const countTarget = tableId === 'admin-access-table' ? 'admin-access-count' : 'history-access-count';
        setText(countTarget, '0 kayıt');
        return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach((record) => fragment.appendChild(createAccessRow(record, compact)));
    tableBody.replaceChildren(fragment);
    refreshTableFilter(tableId);
}

function renderAccessMetrics(data) {
    const records = Array.isArray(data) ? data : [];
    const allowed = records.filter((record) => record.sonuc === 'izin').length;
    const denied = records.filter((record) => record.sonuc === 'red').length;
    const card = records.filter((record) => record.dogrulamaYontemi === 'kart').length;
    const pin = records.filter((record) => record.dogrulamaYontemi === 'pin').length;

    setText('history-success-count', `${allowed} Kayıt`);
    setText('history-denied-count', `${denied} Kayıt`);
    setText('history-card-count', `${card} Geçiş`);
    setText('history-pin-count', `${pin} Geçiş`);
}

function renderAdminLastAccess(data) {
    const records = Array.isArray(data) ? data : [];
    const latest = records[0];
    setText('admin-last-access-time', latest ? formatTime(latest.olayTamani || latest.kayitTamani) : '—');
    setText('admin-last-access-result', latest ? humanizeEnum(latest.sonuc) : 'Kayıt yok');
    setText('admin-last-access-detail', latest
        ? `${humanizeEnum(latest.dogrulamaYontemi)} • ${latest.kapi?.ad || 'Kapı bilgisi yok'}`
        : 'Backend erişim kaydı döndürmedi');
    setText('admin-last-attempt', latest
        ? `${formatTime(latest.olayTamani || latest.kayitTamani)} (${humanizeEnum(latest.sonuc)})`
        : 'Kayıt yok');
}

async function initAdminPage() {
    const tableBody = document.querySelector('#admin-access-table tbody');
    const status = document.getElementById('admin-api-status');
    showLoading(tableBody);
    setInlineMessage(status, 'Yönetim verileri yükleniyor…', 'info');

    const requests = [
        ['kullanicilar', getKullanicilar(), renderKullanicilar],
        ['kartlar', getKartlar(), renderKartlar],
        ['kapilar', getKapilar(), renderKapilar],
        ['cihazlar', getCihazlar(), renderCihazlar],
        ['cihazDurumlari', getCihazDurumlari(), renderCihazDurumlari],
        ['erisimKayitlari', getErisimKayitlari(10, 0), (data) => {
            renderAccessTable('admin-access-table', data, true);
            renderAdminLastAccess(data);
        }]
    ];

    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const errors = [];
    results.forEach((result, index) => {
        const [name, , render] = requests[index];
        if (result.status === 'fulfilled') {
            render(result.value);
        } else {
            errors.push(`${name}: ${handleApiError(result.reason)}`);
        }
    });

    if (errors.length) {
        if (!tableBody.children.length) showError(tableBody, 'Erişim kayıtları yüklenemedi.');
        setInlineMessage(status, `Bazı yönetim verileri alınamadı: ${errors.join(' ')}`, 'error');
    } else {
        setInlineMessage(status, 'Yönetim verileri backend üzerinden güncellendi.', 'success');
    }
}

async function initAuthorizationPage() {
    const tableBody = document.getElementById('authorization-table-body');
    const form = document.getElementById('authorization-form');
    const message = document.getElementById('authorization-message');
    const userSelect = document.getElementById('auth-full-name');
    const roleSelect = document.getElementById('auth-role');
    const rfidInput = document.getElementById('rfidInput');

    showLoading(tableBody);
    try {
        const [users, cards, permissions] = await Promise.all([
            getKullanicilar(),
            getKartlar(),
            getKartYetkilendirmeler()
        ]);
        renderKullanicilar(users);
        renderKartlar(cards);
        renderYetkilendirmeler(permissions);
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setInlineMessage(message, handleApiError(error), 'error');
        return;
    }

    userSelect?.addEventListener('change', () => {
        const user = appState.kullanicilar.find((item) => String(item.kullaniciId) === userSelect.value);
        if (roleSelect) roleSelect.value = user?.rol || '';
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const user = appState.kullanicilar.find((item) => String(item.kullaniciId) === userSelect.value);
        const kartUid = rfidInput.value.trim();
        const knownCard = appState.kartlar.find((card) => card.kartUid === kartUid);

        if (!user || !kartUid) {
            setInlineMessage(message, 'Kullanıcı ve RFID kart UID alanları zorunludur.', 'error');
            return;
        }
        if (!knownCard) {
            setInlineMessage(message, 'Bu UID kart listesinde bulunamadı. Backend kart okuyucu endpointi sunmuyor; kayıtlı bir kart UID’si seçin.', 'warning');
            return;
        }

        const submitButton = form.querySelector('[type="submit"]');
        submitButton.disabled = true;
        setInlineMessage(message, 'Yetki kaydediliyor…', 'info');

        try {
            await apiRequest('/api/kart-yetkilendirmeler', {
                method: 'POST',
                body: {
                    kartUid,
                    kullaniciId: String(user.kullaniciId),
                    birimId: user.birimId ?? null,
                    yetkilendiren: appState.currentUser?.kullaniciId ?? null
                }
            });
            renderYetkilendirmeler(await getKartYetkilendirmeler());
            form.reset();
            roleSelect.value = '';
            setInlineMessage(message, 'Kart yetkisi başarıyla kaydedildi.', 'success');
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
        } finally {
            submitButton.disabled = false;
        }
    });

    tableBody?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-permission-id]');
        if (!button) return;

        const previousStatus = button.dataset.currentStatus;
        const nextStatus = previousStatus === 'aktif' ? 'pasif' : 'aktif';
        button.disabled = true;
        setInlineMessage(message, 'Yetki durumu güncelleniyor…', 'info');

        try {
            await apiRequest(`/api/kart-yetkilendirmeler/${encodeURIComponent(button.dataset.permissionId)}`, {
                method: 'PUT',
                body: { durum: nextStatus }
            });
            renderYetkilendirmeler(await getKartYetkilendirmeler());
            setInlineMessage(message, 'Yetki durumu backend üzerinde güncellendi.', 'success');
        } catch (error) {
            button.disabled = false;
            setInlineMessage(message, `${handleApiError(error)} Arayüzdeki önceki durum korundu.`, 'error');
        }
    });
}

function fetchCardId() {
    const message = document.getElementById('authorization-message');
    setInlineMessage(message, 'Son okutulan kartı döndüren bir backend endpointi bulunmuyor. Kayıtlı UID’yi elle seçin.', 'warning');
}

async function renewCode() {
    const button = document.getElementById('renew-code-button');
    const code = document.getElementById('dailyCode');
    const message = document.getElementById('pin-message');
    if (!button || !code) return;

    button.disabled = true;
    setInlineMessage(message, 'Yeni PIN oluşturuluyor…', 'info');
    try {
        const user = appState.currentUser || await getCurrentUser();
        const response = await apiRequest(`/api/kullanicilar/${encodeURIComponent(user.kullaniciId)}/sifre-yenile`, {
            method: 'POST'
        });
        const newPin = response?.veri?.yeniPin;
        if (!newPin) throw new ApiError('Backend yanıtında yeni PIN alanı bulunamadı.');
        code.textContent = newPin;
        setInlineMessage(message, 'Yeni PIN oluşturuldu. Güvenli biçimde saklayın; sayfadan ayrıldığınızda tekrar gösterilmez.', 'success');
    } catch (error) {
        code.textContent = '••••••';
        setInlineMessage(message, handleApiError(error), 'error');
    } finally {
        button.disabled = false;
    }
}

function initTemporaryPinPage() {
    document.getElementById('renew-code-button')?.addEventListener('click', renewCode);
}

async function initAccessHistoryPage() {
    const tableBody = document.querySelector('#history-access-table tbody');
    showLoading(tableBody);
    try {
        const records = await getErisimKayitlari(100, 0);
        renderAccessTable('history-access-table', records, false);
        renderAccessMetrics(records);
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('history-access-count', '0 kayıt');
    }
}

function initIssueHistoryPage() {
    const status = document.getElementById('fault-integration-status');
    const tableBody = document.querySelector('#fault-records-table tbody');

    // TODO(frontend-integration): issueReportService bir Express route'una bağlandığında gerçek GET isteği eklenmeli.
    setInlineMessage(status, 'Arıza servisi henüz backend route’una bağlanmamış. Aşağıdaki kayıtlar MOCK veridir.', 'warning');

    if (API_CONFIG.useMockData) {
        tableBody?.querySelectorAll('tr').forEach((row) => {
            row.dataset.mock = 'true';
            row.querySelectorAll('a').forEach((link) => {
                link.removeAttribute('href');
                link.setAttribute('aria-disabled', 'true');
                link.title = 'Gerçek fotoğraf URL’si bulunmuyor';
            });
        });
        setText('fault-record-count', `MOCK • ${tableBody?.querySelectorAll('tr').length || 0} kayıt`);
        refreshTableFilter('fault-records-table');
    } else {
        tableBody?.replaceChildren();
        showEmpty(tableBody, 'Arıza servisi bağlı değil; üretim modunda mock veri gösterilmiyor.');
        setText('fault-record-count', '0 kayıt');
    }
}

function updateFileName(input) {
    const labelText = document.getElementById('fileNameText');
    if (labelText && input.files?.length) labelText.textContent = input.files[0].name;
}

function initIssueReportPage() {
    const form = document.getElementById('issue-report-form');
    const message = document.getElementById('issue-report-message');
    // TODO(frontend-integration): issueReportService için POST route'u ve fotoğraf content-type sözleşmesi oluşturulduğunda bağlanmalı.
    setInlineMessage(message, 'Arıza servisi henüz backend route’una bağlanmamış. Bildirim ve fotoğraf gönderimi şu anda devre dışıdır.', 'warning');
    form?.addEventListener('submit', (event) => {
        event.preventDefault();
        setInlineMessage(message, 'Bildirim gönderilmedi: backend arıza route’u mevcut değil.', 'error');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initTableFilters();
    initLogout();

    const page = document.body.dataset.page;
    if (page === 'login') {
        initLogin();
        return;
    }

    if (document.body.dataset.authRequired === 'true') {
        const authenticated = await requireAuthentication();
        if (!authenticated) return;
    }

    const initializers = {
        admin: initAdminPage,
        authorization: initAuthorizationPage,
        'temporary-pin': initTemporaryPinPage,
        'access-history': initAccessHistoryPage,
        'issue-history': initIssueHistoryPage,
        'issue-report': initIssueReportPage
    };

    const initializePage = initializers[page];
    if (initializePage) await initializePage();
});

