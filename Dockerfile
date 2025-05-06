# Use Node.js to run the backend
FROM node:18

# Go into our app
WORKDIR /app

# Copy package files and install libraries
COPY package*.json ./
RUN npm install

# Copy all code
COPY . .

# Use port 80 like in main.js
EXPOSE 80

# Start the server
CMD ["node", "main.js"]
