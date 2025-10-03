FROM node:18-bullseye

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install && \
    npx playwright install-deps && \
    npx playwright install chromium

COPY . .

CMD ["node", "app.js"]
