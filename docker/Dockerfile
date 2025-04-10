FROM node:20

LABEL maintainer="PRADEEP G"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Clone game source code
RUN git clone https://github.com/pradeepgattamaneni/pacman.git .

# Install app dependencies
RUN npm install

# Install the @splunk/otel package
RUN npm install @splunk/otel
# Set appropriate permissions
RUN chmod -R go+r /usr/src/app/node_modules/@splunk/otel


# Expose port 8080
EXPOSE 8080

# Run container
CMD ["npm", "start"]
