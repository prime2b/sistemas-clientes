FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.mjs ./
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=3100 SQLITE_FILE=/data/center-cell.sqlite BIND_HOST=0.0.0.0
EXPOSE 3100
CMD ["node", "server.mjs"]
