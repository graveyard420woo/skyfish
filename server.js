// server.js

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// This line tells Express to serve all the files from the project's root folder
app.use(express.static(__dirname));

// Route for the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// This is the core of our real-time logic
io.on('connection', (socket) => {
  console.log('A user connected with ID:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected with ID:', socket.id);
  });

  // TODO: Add listeners for game events like 'islandMove'
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running! Open your browser to http://localhost:${PORT}`);
});```

**Step 4: Run the Server**

In your terminal, while still in the project directory, run the following command:

```bash
node server.js