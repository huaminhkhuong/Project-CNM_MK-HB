FROM node:20-alpine

WORKDIR /app

# Cài đặt tini để xử lý tiến trình PID 1 và chuyển tiếp tín hiệu tắt (SIGTERM) tức thì
RUN apk add --no-cache tini

COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Cài đặt dependencies cho workspace services/api và dọn dẹp cache để tối ưu kích thước image
RUN npm ci --workspace services/api --include-workspace-root=false \
    && npm cache clean --force

COPY services/api ./services/api

RUN npm run prisma:generate -w services/api
RUN chmod +x ./services/api/docker-entrypoint.sh

WORKDIR /app/services/api

EXPOSE 4000

# Sử dụng tini làm init system (PID 1) để nhận tín hiệu tắt và dọn dẹp tiến trình con
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
