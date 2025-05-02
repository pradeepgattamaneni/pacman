FROM node:current-alpine

LABEL maintainer="PRADEEP G"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install app dependencies
# Development
#RUN npm install
# Production
RUN npm install

# Install the @splunk/otel package
RUN npm install @splunk/otel
RUN npm install @opentelemetry/api

# Set appropriate permissions
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel

COPY . .

# Expose port 8080
EXPOSE 8080