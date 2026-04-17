FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package.json
RUN npm install
COPY tsconfig.json tsconfig.json
COPY src src
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY package.json package.json
RUN npm install --omit=dev
COPY --from=builder /app/dist dist

EXPOSE 13101
CMD ["npm", "run", "start"]
