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


## Docker ile Hızlı Başlangıç

Projeyi bilgisayarınıza klonlayın:

```bash
git clone https://github.com/rumeysakolip/secure-door-project.git
cd secure-door-project
```

Ortam değişkenleri dosyasını oluşturun:

```bash
cp .env.example .env
```

Windows PowerShell kullanıyorsanız:

```powershell
Copy-Item .env.example .env
```

Projeyi Docker ile başlatın:

```bash
docker compose up --build
```

Servislere aşağıdaki adreslerden erişebilirsiniz:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Projeyi durdurmak için:

```bash
docker compose down
```

Veritabanı verileri Docker volume içerisinde kalıcı olarak saklanır. Verileri de tamamen silmek için:

```bash
docker compose down -v
```