const API_CONFIG = Object.freeze({
    baseUrl: '',
    // Geliştirme fallback'i gerekirse true yapılabilir; üretimde sahte veri gösterilmez.
    useMockData: false
});

const AUTH_TOKEN_KEY = 'securelab_auth_token';
const appState = {
    currentUser: null,
    kullanicilar: [],
    kartlar: [],
    kapilar: [],
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
    return sessionStorage.getItem(AUTH_TOKEN_KEY)
        || localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token, persist = false) {
    if (typeof token !== 'string' || !token.trim()) {
        throw new Error('Geçerli bir oturum anahtarı alınamadı.');
    }

    const selectedStorage = persist ? localStorage : sessionStorage;
    const unusedStorage = persist ? sessionStorage : localStorage;
    unusedStorage.removeItem(AUTH_TOKEN_KEY);
    selectedStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
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

function revealAuthenticatedPage() {
    document.documentElement.classList.remove('auth-pending');
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
            || responseData?.error
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
    row.className = 'integration-state-row';
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
    target.className = 'api-state integration-loading';
    target.textContent = 'Veriler yükleniyor…';
}

function showEmpty(container, message = 'Kayıt bulunamadı.') {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'api-state integration-empty';
    target.textContent = message;
}

function showError(container, message) {
    if (!container) return;
    const target = getStateCell(container);
    target.className = 'api-state form-message-error integration-error';
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
    element.className = `form-message form-message-${type}`;
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
        emptyCell.textContent = filterInput.dataset.emptyMessage || 'Seçilen filtreye uygun kayıt bulunamadı.';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
    }

    const filterValue = normalizeDateValue(filterInput.value).toLocaleLowerCase('tr-TR');
    const filterMode = filterInput.dataset.filterMode || 'date';
    let visibleCount = 0;

    rows.forEach((row) => {
        const searchableValue = filterMode === 'text'
            ? row.textContent
            : row.dataset.date || row.cells[0]?.textContent;
        const normalizedRowValue = normalizeDateValue(searchableValue).toLocaleLowerCase('tr-TR');
        const visible = !filterValue || normalizedRowValue.includes(filterValue);
        row.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    emptyRow.hidden = visibleCount !== 0 || rows.length === 0;
    const countElement = document.getElementById(filterInput.dataset.countTarget);
    const countLabel = filterInput.dataset.countLabel || 'kayıt';
    if (countElement) countElement.textContent = `${visibleCount} ${countLabel}`;

    const clearButton = document.querySelector(`[data-filter-clear="${filterInput.id}"]`);
    if (clearButton) clearButton.disabled = !filterInput.value;
}

function initTableFilters() {
    document.querySelectorAll('[data-table-filter]').forEach((filterInput) => {
        filterInput.addEventListener('input', () => applyTableFilter(filterInput));
        filterInput.addEventListener('change', () => applyTableFilter(filterInput));
    });

    document.querySelectorAll('[data-filter-clear]').forEach((button) => {
        const filterInput = document.getElementById(button.dataset.filterClear);
        if (!filterInput) return;
        button.addEventListener('click', () => {
            filterInput.value = '';
            applyTableFilter(filterInput);
            filterInput.focus();
        });
    });
}

function refreshTableFilter(tableId) {
    const filter = document.querySelector(`[data-table-filter="${tableId}"]`);
    if (!filter) return;

    const listId = filter.getAttribute('list');
    const suggestions = listId ? document.getElementById(listId) : null;
    const table = document.getElementById(tableId);
    if (suggestions && table) {
        const dates = new Set(
            Array.from(table.querySelectorAll('tbody tr[data-date]'))
                .map((row) => row.dataset.date)
                .filter(Boolean)
        );
        const fragment = document.createDocumentFragment();
        dates.forEach((date) => {
            const option = document.createElement('option');
            option.value = date;
            fragment.appendChild(option);
        });
        suggestions.replaceChildren(fragment);
    }

    applyTableFilter(filter);
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
        const user = await getCurrentUser();
        if (!enforceRoleAccess(user)) return false;
        revealAuthenticatedPage();
        return true;
    } catch (error) {
        clearAuthToken();
        redirectToLogin();
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

function enforceRoleAccess(user) {
    const role = user?.rol || '';
    const allowedRoles = String(document.body.dataset.roles || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    document.querySelectorAll('a[href="admin.html"]').forEach((link) => {
        if (role !== 'admin') link.hidden = true;
    });

    document.querySelectorAll('.sidebar-meta-row').forEach((meta) => {
        const name = `${user?.ad || ''} ${user?.soyad || ''}`.trim();
        const strong = meta.querySelector('strong');
        const small = meta.querySelector('small');
        if (strong && name) strong.textContent = name;
        if (small) small.textContent = humanizeEnum(role);
    });

    if (allowedRoles.length && !allowedRoles.includes(role)) {
        const destination = getRoleDestination(role) || 'login.html';
        window.location.replace(`${destination}?yetki=reddedildi`);
        return false;
    }
    return true;
}

async function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const emailInput = document.getElementById('login-identity');
    const pinInput = document.getElementById('login-password');
    const submitButton = document.getElementById('login-submit');
    const message = document.getElementById('login-message');
    const forgotButton = document.getElementById('forgot-password-button');
    const passwordToggle = document.getElementById('password-toggle');
    const rememberInput = document.getElementById('login-remember');

    if (getAuthToken()) {
        try {
            const user = await getCurrentUser();
            const destination = getRoleDestination(user?.rol);
            if (destination) {
                window.location.replace(destination);
                return;
            }
        } catch (error) {
            clearAuthToken();
        }
    }

    forgotButton?.addEventListener('click', async () => {
        const eposta = emailInput.value.trim();
        if (!eposta) {
            setInlineMessage(message, 'Önce e-posta adresinizi yazın.', 'error');
            emailInput.focus();
            return;
        }

        forgotButton.disabled = true;
        setInlineMessage(message, 'Yeni giriş şifresi oluşturuluyor…', 'info');
        try {
            const response = await apiRequest('/api/auth/forgot-password', {
                method: 'POST',
                body: { eposta }
            });
            setInlineMessage(
                message,
                response?.temporaryPin
                    ? `Yeni giriş şifreniz: ${response.temporaryPin}`
                    : (response?.message || 'Sıfırlama isteği alındı.'),
                'success'
            );
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
        } finally {
            forgotButton.disabled = false;
        }
    });

    passwordToggle?.addEventListener('click', () => {
        const willShow = pinInput.type === 'password';
        pinInput.type = willShow ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(willShow));
        passwordToggle.setAttribute('aria-label', willShow ? 'Şifreyi gizle' : 'Şifreyi göster');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const eposta = emailInput.value.trim();
        const pin = pinInput.value;

        if (!eposta || !pin) {
            setInlineMessage(message, 'E-posta ve PIN / şifre alanları zorunludur.', 'error');
            return;
        }

        const originalContent = Array.from(submitButton.childNodes, (node) => node.cloneNode(true));
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

            setAuthToken(response.token, Boolean(rememberInput?.checked));
            window.location.assign(destination);
        } catch (error) {
            clearAuthToken();
            setInlineMessage(message, handleApiError(error), 'error');
            submitButton.disabled = false;
            submitButton.replaceChildren(...originalContent);
        }
    });
}

async function getKullanicilar() {
    return apiRequest('/api/kullanicilar');
}

async function getKullaniciOzeti() {
    return apiRequest('/api/kullanicilar/ozet');
}

function renderKullanicilar(data) {
    appState.kullanicilar = Array.isArray(data) ? data : [];
    setText('admin-user-count', String(appState.kullanicilar.length));
    setText('auth-user-count', String(appState.kullanicilar.length));
    setText('auth-user-count-badge', `${appState.kullanicilar.length} tanımlı kullanıcı`);
    setText('authorization-user-count', String(appState.kullanicilar.length));
    setText('admin-user-detail', `${appState.kullanicilar.length} kullanıcı backend’den alındı`);

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
    setText('admin-card-detail', `${appState.kartlar.length} kart backend’den alındı`);

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
    appState.kapilar = doors;
    const activeDoors = doors.filter((door) => door.durum === 'aktif');
    setText('admin-door-count', String(doors.length));
    setText('admin-door-state', doors.length ? `${activeDoors.length} aktif` : 'Kayıt yok');
    setText('admin-door-detail', doors.length
        ? `${doors.length} kapı kaydından ${activeDoors.length} tanesi aktif`
        : 'Backend kapı kaydı döndürmedi');
    setText('admin-door-status', doors[0]?.durum ? humanizeEnum(doors[0].durum) : 'Kayıt yok');
    setText('dashboard-door-value', String(doors.length));
    setText('dashboard-door-detail', doors.length
        ? `${activeDoors.length} kapı aktif`
        : 'Backend kapı kaydı döndürmedi');
    setText('dashboard-door-state', doors[0]?.durum ? humanizeEnum(doors[0].durum) : 'Kayıt yok');
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
    setText('dashboard-device-state', devices.length
        ? `${activeDevices.length}/${devices.length} aktif`
        : 'Kayıt yok');
}

async function getCihazDurumlari() {
    return apiRequest('/api/cihaz-durumlari');
}

function renderCihazDurumlari(data) {
    const statuses = Array.isArray(data) ? data : [];
    const latest = [...statuses].sort((a, b) => {
        return new Date(b.sonHeartbeat || b.guncellenmeTarihi || 0) - new Date(a.sonHeartbeat || a.guncellenmeTarihi || 0);
    })[0];

    setText('admin-device-connection', latest?.cihazDurumTip
        ? humanizeEnum(latest.cihazDurumTip)
        : 'Durum kaydı yok');
    setText('admin-device-state', latest?.cihazDurumTip
        ? humanizeEnum(latest.cihazDurumTip)
        : 'Durum kaydı yok');
    setText('dashboard-heartbeat', latest?.sonHeartbeat || latest?.guncellenmeTarihi
        ? formatDateTime(latest.sonHeartbeat || latest.guncellenmeTarihi)
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
        red: 'Reddedildi',
        OPEN: 'Açık',
        IN_PROGRESS: 'İnceleniyor',
        RESOLVED: 'Çözüldü'
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
    setText('authorization-active-count', String(activeCount));
    setText('authorization-passive-count', String(passiveCount));
    setText('authorization-system-state', 'Yetkiler güncel');

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
    refreshTableFilter('authorized-users-table');
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
        const countTargets = {
            'admin-access-table': 'admin-access-count',
            'history-access-table': 'history-access-count',
            'dashboard-access-table': 'dashboard-access-count'
        };
        const countTarget = countTargets[tableId];
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
    setText('dashboard-success-value', String(allowed));
    setText('dashboard-denied-value', String(denied));
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
    setText('admin-last-access', latest
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
        setText('admin-system-state', 'Sistem verileri güncel');
        setText('admin-infra-state', 'Canlı API');
    }

    const remoteDoorButton = document.getElementById('remote-door-button');
    if (remoteDoorButton) {
        remoteDoorButton.disabled = !appState.kapilar.length;
        remoteDoorButton.addEventListener('click', async () => {
            const door = appState.kapilar.find((item) => item.durum === 'aktif') || appState.kapilar[0];
            const message = document.getElementById('remote-door-message');
            if (!door) return;
            if (!window.confirm(`${door.ad} uzaktan açılsın mı?`)) return;
            remoteDoorButton.disabled = true;
            setInlineMessage(message, 'Kapı açma komutu gönderiliyor…', 'info');
            try {
                const response = await apiRequest(`/api/kapilar/${encodeURIComponent(door.kapiId)}/ac`, {
                    method: 'POST',
                    body: { reason: 'Yönetim paneli manuel açma işlemi' }
                });
                setInlineMessage(message, response?.message || 'Kapı açma komutu gönderildi.', 'success');
            } catch (error) {
                setInlineMessage(message, handleApiError(error), 'error');
            } finally {
                remoteDoorButton.disabled = false;
            }
        });
    }
}

async function initDashboardPage() {
    const tableBody = document.querySelector('#dashboard-access-table tbody');
    showLoading(tableBody);

    const requests = [
        ['users', getKullaniciOzeti(), (summary) => {
            const totalUsers = Number(summary?.toplam || 0);
            const activeUsers = Number(summary?.aktif || 0);
            setText('dashboard-user-value', String(activeUsers));
            setText('dashboard-user-detail', `${totalUsers} kullanıcıdan ${activeUsers} tanesi aktif`);
        }],
        ['doors', getKapilar(), renderKapilar],
        ['devices', getCihazlar(), renderCihazlar],
        ['statuses', getCihazDurumlari(), renderCihazDurumlari],
        ['records', getErisimKayitlari(20, 0), (records) => {
            renderAccessMetrics(records);
            renderAccessTable('dashboard-access-table', records, false);
        }]
    ];
    const results = await Promise.allSettled(requests.map(([, request]) => request));
    const failures = [];
    results.forEach((result, index) => {
        const [name, , render] = requests[index];
        if (result.status === 'fulfilled') render(result.value);
        else failures.push(name);
    });

    if (failures.includes('records')) showError(tableBody, 'Erişim kayıtları yüklenemedi.');
    setText('dashboard-system-state', failures.length ? 'Bazı veriler alınamadı' : 'Sistem verileri güncel');
    setText('dashboard-infra-state', failures.length ? 'Kısmi bağlantı' : 'Canlı API');
}

async function initAuthorizationPage() {
    const tableBody = document.getElementById('authorization-table-body');
    const form = document.getElementById('authorization-form');
    const message = document.getElementById('authorization-message');
    const userSelect = document.getElementById('auth-full-name');
    const roleSelect = document.getElementById('auth-role');
    const rfidInput = document.getElementById('rfidInput');
    const fetchCardButton = document.getElementById('fetch-card-button');

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
        setText('authorization-system-state', 'Yetkiler yüklenemedi');
        setInlineMessage(message, handleApiError(error), 'error');
        return;
    }

    userSelect?.addEventListener('change', () => {
        const user = appState.kullanicilar.find((item) => String(item.kullaniciId) === userSelect.value);
        if (roleSelect) roleSelect.value = user?.rol || '';
    });
    fetchCardButton?.addEventListener('click', fetchCardId);
    loadLatestCardSummary();

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

async function loadLatestCardSummary() {
    try {
        const latest = await apiRequest('/api/kartlar/son-okutulan');
        setText('latest-card-uid', latest?.okunanUid || '—');
        setText('latest-card-state', latest?.okunanUid ? 'Hazır' : 'Bekliyor');
        setText('latest-card-detail', latest?.olayTamani
            ? `Son okuma: ${formatDateTime(latest.olayTamani)}`
            : 'Henüz kart okutulmadı');
    } catch (error) {
        setText('latest-card-uid', '—');
        setText('latest-card-state', 'Bağlantı yok');
        setText('latest-card-detail', handleApiError(error));
    }
}

async function fetchCardId() {
    const message = document.getElementById('authorization-message');
    const input = document.getElementById('rfidInput');
    const button = document.getElementById('fetch-card-button');
    if (!input || !button) return;

    button.disabled = true;
    setInlineMessage(message, 'Son okutulan kart alınıyor…', 'info');
    try {
        const latest = await apiRequest('/api/kartlar/son-okutulan');
        if (!latest?.okunanUid) throw new ApiError('Okutulmuş kart bulunamadı.');
        input.value = latest.okunanUid;
        setText('latest-card-uid', latest.okunanUid);
        setText('latest-card-state', 'Hazır');
        setText('latest-card-detail', latest?.olayTamani
            ? `Son okuma: ${formatDateTime(latest.olayTamani)}`
            : 'Kart okuyucudan alındı');
        setInlineMessage(message, `Son okutulan kart yüklendi: ${latest.okunanUid}`, 'success');
    } catch (error) {
        setInlineMessage(message, handleApiError(error), 'error');
    } finally {
        button.disabled = false;
    }
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
        setText('pin-current-state', 'Yeni PIN hazır');
        setText('pin-system-state', 'PIN backend üzerinden yenilendi');
        setInlineMessage(message, 'Yeni PIN oluşturuldu. Güvenli biçimde saklayın; sayfadan ayrıldığınızda tekrar gösterilmez.', 'success');
    } catch (error) {
        code.textContent = '••••••';
        setText('pin-current-state', 'Üretilemedi');
        setText('pin-system-state', 'PIN servisi hatası');
        setInlineMessage(message, handleApiError(error), 'error');
    } finally {
        button.disabled = false;
    }
}

function initTemporaryPinPage() {
    const button = document.getElementById('renew-code-button');
    if (!button) return;
    button.disabled = false;
    button.addEventListener('click', renewCode);
}

async function initAccessHistoryPage() {
    const tableBody = document.querySelector('#history-access-table tbody');
    showLoading(tableBody);
    try {
        const records = await getErisimKayitlari(100, 0);
        renderAccessTable('history-access-table', records, false);
        renderAccessMetrics(records);
        setText('history-system-state', 'Kayıtlar güncel');
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('history-access-count', '0 kayıt');
        setText('history-system-state', 'Kayıtlar yüklenemedi');
    }
}

async function getArizalar() {
    const response = await apiRequest('/api/arizalar');
    if (!response?.success || !Array.isArray(response.data)) {
        throw new ApiError('Arıza listesi yanıtı doğrulanamadı.');
    }
    return response.data;
}

function renderArizalar(data) {
    const records = Array.isArray(data) ? data : [];
    const tableBody = document.querySelector('#fault-records-table tbody');
    if (!tableBody) return;

    const openCount = records.filter((record) => record.durum === 'OPEN' || record.durum === 'IN_PROGRESS').length;
    const resolvedCount = records.filter((record) => record.durum === 'RESOLVED').length;
    const latest = records[0];
    setText('fault-open-count', String(openCount));
    setText('fault-resolved-count', String(resolvedCount));
    setText('fault-last-type', latest?.arizaTuru || 'Kayıt yok');
    setText('fault-period', latest ? formatDate(latest.olusturulma) : 'Kayıt yok');
    setText('fault-record-count', `${records.length} kayıt`);
    setText('fault-system-state', 'Arıza kayıtları güncel');

    if (!records.length) {
        showEmpty(tableBody, 'Arıza bildirimi bulunamadı.');
        return;
    }

    const fragment = document.createDocumentFragment();
    records.forEach((record) => {
        const row = document.createElement('tr');
        row.dataset.date = formatDate(record.olusturulma);

        const dateCell = document.createElement('td');
        dateCell.append(
            createElement('span', 'cell-primary', formatDate(record.olusturulma)),
            createElement('span', 'cell-secondary', formatTime(record.olusturulma))
        );
        const descriptionCell = document.createElement('td');
        descriptionCell.append(
            createElement('span', 'cell-primary', record.arizaTuru || 'Tür belirtilmedi'),
            createElement('span', 'cell-secondary', record.aciklama || 'Açıklama yok'),
            createElement('span', 'cell-secondary', record.bildiren ? `Bildiren: ${record.bildiren}` : 'Bildiren: Anonim')
        );
        const photoCell = document.createElement('td');
        if (record.fotografVerisi) {
            const link = createElement('a', 'section-link', record.fotografAdi || 'Görüntüle');
            link.href = record.fotografVerisi;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            photoCell.appendChild(link);
        } else {
            photoCell.className = 'cell-secondary';
            photoCell.textContent = 'Ek yok';
        }
        const statusCell = document.createElement('td');
        const variant = record.durum === 'RESOLVED'
            ? 'success'
            : record.durum === 'IN_PROGRESS' ? 'warning' : 'danger';
        if (appState.currentUser?.rol === 'admin') {
            const select = createElement('select', 'status-select');
            select.dataset.issueId = String(record.arizaId);
            [
                ['OPEN', 'Açık'],
                ['IN_PROGRESS', 'İnceleniyor'],
                ['RESOLVED', 'Çözüldü']
            ].forEach(([value, label]) => {
                const option = createElement('option', '', label);
                option.value = value;
                option.selected = value === record.durum;
                select.appendChild(option);
            });
            statusCell.appendChild(select);
        } else {
            statusCell.appendChild(createBadge(humanizeEnum(record.durum), variant));
        }
        row.append(dateCell, descriptionCell, photoCell, statusCell);
        fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
    refreshTableFilter('fault-records-table');
}

async function initIssueHistoryPage() {
    const status = document.getElementById('fault-integration-status');
    const tableBody = document.querySelector('#fault-records-table tbody');
    showLoading(tableBody);
    setInlineMessage(status, 'Arıza kayıtları backend’den yükleniyor…', 'info');

    try {
        renderArizalar(await getArizalar());
        setInlineMessage(status, 'Arıza servisi gerçek /api/arizalar endpointine bağlı.', 'success');
    } catch (error) {
        showError(tableBody, handleApiError(error));
        setText('fault-record-count', '0 kayıt');
        setText('fault-system-state', 'Arıza servisine ulaşılamadı');
        setInlineMessage(status, handleApiError(error), 'error');
    }

    tableBody?.addEventListener('change', async (event) => {
        const select = event.target.closest('[data-issue-id]');
        if (!select) return;
        select.disabled = true;
        setInlineMessage(status, 'Arıza durumu güncelleniyor…', 'info');
        try {
            await apiRequest(`/api/arizalar/${encodeURIComponent(select.dataset.issueId)}`, {
                method: 'PATCH',
                body: { status: select.value }
            });
            renderArizalar(await getArizalar());
            setInlineMessage(status, 'Arıza durumu güncellendi.', 'success');
        } catch (error) {
            select.disabled = false;
            setInlineMessage(status, handleApiError(error), 'error');
        }
    });
}

function updateFileName(input) {
    const labelText = document.getElementById('fileNameText');
    if (labelText && input.files?.length) labelText.textContent = input.files[0].name;
}

function initIssueReportPage() {
    const form = document.getElementById('issue-report-form');
    const message = document.getElementById('issue-report-message');
    const submitButton = document.getElementById('issue-report-submit');
    setInlineMessage(message, 'Bildirim metni ve isteğe bağlı fotoğraf güvenli biçimde gönderilir.', 'info');
    if (submitButton) submitButton.disabled = false;

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fullName = document.getElementById('report-full-name').value.trim();
        const emailUser = document.getElementById('report-email').value.trim();
        const issueType = document.getElementById('report-issue-type').value;
        const description = document.getElementById('report-description').value.trim();
        const photoFile = document.getElementById('filePicker').files?.[0]
            || document.getElementById('cameraInput').files?.[0]
            || null;

        if (!fullName || !emailUser || !issueType || !description) {
            setInlineMessage(message, 'Ad soyad, e-posta, arıza türü ve açıklama alanları zorunludur.', 'error');
            return;
        }

        const originalContent = Array.from(submitButton.childNodes, (node) => node.cloneNode(true));
        const reportedEmail = emailUser.includes('@') ? emailUser : `${emailUser}@subu.edu.tr`;
        submitButton.disabled = true;
        submitButton.textContent = 'Bildirim gönderiliyor…';
        setInlineMessage(message, 'Arıza bildirimi kaydediliyor…', 'info');

        try {
            if (photoFile && photoFile.size > 2_500_000) {
                throw new ApiError('Fotoğraf en fazla 2,5 MB olabilir.');
            }
            const photoData = photoFile ? await readFileAsDataUrl(photoFile) : null;
            const response = await apiRequest('/api/arizalar', {
                method: 'POST',
                body: {
                    reportedBy: `${fullName} (${reportedEmail})`.slice(0, 128),
                    issueType,
                    description,
                    photoName: photoFile?.name || null,
                    photoData
                }
            });
            if (!response?.success || !response?.report?.arizaId) {
                throw new ApiError('Arıza kayıt yanıtı doğrulanamadı.');
            }
            form.reset();
            setInlineMessage(message, response.message || 'Arıza bildirimi başarıyla kaydedildi.', 'success');
        } catch (error) {
            setInlineMessage(message, handleApiError(error), 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.replaceChildren(...originalContent);
        }
    });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new ApiError('Fotoğraf okunamadı.'));
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initTableFilters();
    initLogout();

    const page = document.body.dataset.page;
    if (page === 'login') {
        await initLogin();
        return;
    }

    if (document.body.dataset.authRequired === 'true') {
        const authenticated = await requireAuthentication();
        if (!authenticated) return;
    }

    const initializers = {
        admin: initAdminPage,
        dashboard: initDashboardPage,
        authorization: initAuthorizationPage,
        'temporary-pin': initTemporaryPinPage,
        'access-history': initAccessHistoryPage,
        'issue-history': initIssueHistoryPage,
        'issue-report': initIssueReportPage
    };

    const initializePage = initializers[page];
    if (initializePage) await initializePage();
});

