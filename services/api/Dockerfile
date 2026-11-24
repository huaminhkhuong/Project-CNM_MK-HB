FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# The API start script uses tsx to run the TypeScript entrypoint, so keep
# workspace dev dependencies inside the runtime image for this project.
RUN npm ci --workspace services/api --include-workspace-root=false

COPY services/api ./services/api
COPY data/rules.json ./data/rules.json

RUN npm run prisma:generate -w services/api

EXPOSE 4000

CMD ["npm", "run", "start", "-w", "services/api"]
