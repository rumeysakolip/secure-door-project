document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status');

    try {
        const response = await fetch('http://localhost:3000/');
        const data = await response.json();
        statusEl.textContent = data.message;
    } catch (error) {
        statusEl.textContent = 'Backend bağlantı kurulamadı';
        console.error('Hata:', error);
    }
});
