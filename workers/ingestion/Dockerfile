FROM node:22-alpine

WORKDIR /app

COPY package.json tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY workers/ingestion ./workers/ingestion

RUN npm install
RUN npm run build --workspace @eventscout/shared
RUN npm run build --workspace @eventscout/ingestion-worker

CMD ["node", "workers/ingestion/dist/index.js"]

