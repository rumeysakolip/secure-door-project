# Secure Door Project - Kart Okuyuculu Güvenlikli Kapı Sistemi

Kart okuyuculu güvenlikli kapı sistemi projesi. Docker Compose kullanılarak PostgreSQL, Node.js backend ve statik frontend ile geliştirilmiştir.

## Kurulum

Projeyi başlatmak için aşağıdaki komutu çalıştırın:

```bash
docker compose up --build
```

Bu komut PostgreSQL veritabanı, backend ve frontend servislerini otomatik olarak oluşturup başlatacaktır.

### Erişim Adresleri
- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3000
- **Veritabanı**: localhost:5432

### Ortam Değişkenleri
`.env.example` dosyasını `.env` olarak kopyalayın ve gerekli değerleri güncelleyin.