FROM node:20

WORKDIR /app

# 1. Önce paket listesini kopyala
COPY package*.json ./

# 2. Prisma şemasını erkenden kopyala
COPY prisma ./prisma/

# 3. Kütüphaneleri kur
RUN npm install

# 4. Prisma Client oluştur
RUN npx prisma generate

# 5. Kalan tüm kodları kopyala
COPY . .

# 6. Başlangıç scriptine çalıştırma izni ver
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# 4. Prisma Client oluşturmadan önce geçici DATABASE_URL tanımlıyoruz
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dummy_db?schema=public"
RUN npx prisma generate