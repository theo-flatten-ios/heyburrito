FROM node:20-slim

RUN apt-get update && apt-get install -y git

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm ci
COPY . /usr/src/app
CMD [ "npm", "start" ]