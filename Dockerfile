FROM node:20-slim
WORKDIR /app
COPY . .
ENV PORT=8080
USER node
CMD ["node","backend/server.js"]
