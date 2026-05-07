FROM node:20-alpine

# OpenSSL لـ Prisma + netcat لـ wait script + tzdata للمنطقة الزمنية
RUN apk add --no-cache openssl netcat-openbsd tzdata

WORKDIR /app

# Cache layer للـ dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

# Copy source code
COPY . .

# مجلدات الرفع (تتم عبر volume بالـ runtime)
RUN mkdir -p uploads/pdfs uploads/images

# script لانتظار DB ثم تشغيل migrations ثم السيرفر
COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
