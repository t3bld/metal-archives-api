FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start:api"]
