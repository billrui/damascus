FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create storage directories
RUN mkdir -p storage/receipts

EXPOSE 3001

CMD ["node", "src/app.js"]
