# Install the app dependencies in a full Node docker image
FROM registry.access.redhat.com/ubi8/nodejs-16:latest

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Copy the dependencies into a Slim Node docker image
FROM registry.access.redhat.com/ubi8/nodejs-16-minimal:latest

# appcheck for custom metrics
FROM node:latest
WORKDIR /app
ADD package.json ./
RUN npm install
ENV SYSDIG_AGENT_CONF 'app_checks: [{name: node, check_module: prometheus, pattern: {comm: node}, conf: { url: "http://custom-metrics-metrics-ch-al.logging-cluster-bfce6900ddaebdf3b99ec3d81c10b2c8-0000.us-south.containers.appdomain.cloud:3000/metrics" }}]'
ADD server.js ./
ENTRYPOINT [ "node", "server.js" ]

# Install app dependencies
COPY --from=0 /opt/app-root/src/node_modules /opt/app-root/src/node_modules
COPY . /opt/app-root/src

ENV NODE_ENV production
ENV PORT 3000

CMD ["npm", "start"]
