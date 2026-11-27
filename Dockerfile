FROM node:26-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node . .
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node","backend/server.js"]
