FROM node:22
RUN apt-get update && apt-get install -y python3 python3-pip
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "fast-start"]
