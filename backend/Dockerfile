FROM node:20

WORKDIR /app

# 1. Önce paket listesini kopyala
COPY package*.json ./

# 2. Prisma şemasını erkenden kopyala ki npm install onu görebilsin
COPY prisma ./prisma/

# 3. Kütüphaneleri kur
RUN npm install

# 4. Kalan tüm kodları kopyala
COPY . .

# 5. İŞTE CAN ALICI NOKTA: Prisma beynini (Client) oluştur!
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
