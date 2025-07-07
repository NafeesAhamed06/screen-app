const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

app.set("view engine", "ejs");
app.use(express.static("public"));

// Track active rooms
const activeRooms = {};
const roomUsers = {};
const roomHosts = {}

// app.get("/", (req, res) => {
// const newRoomId = `${uuidV4()}`;
//   activeRooms[newRoomId] = true; // Mark room as active
//   res.redirect(`/${newRoomId}?admin=true`);
// });
// app.get("/", (req, res) => {
//   res.render("room-not-available"); // Show "Room Not Available" by default
// });
app.get("/create-room", (req, res) => {
  const newRoomId = `${uuidV4()}`;
  activeRooms[newRoomId] = true; // Mark room as active
  res.redirect(`/${newRoomId}?admin=true`);
});


app.get("/end-call", (req, res) => {
    res.render("end-call"); // Show "Room Not Available"
})
app.get("/", (req, res) => {
    res.render("room-not-available"); // Show "Room Not Available"
})
app.get("/:room", (req, res) => {
  if (activeRooms[req.params.room]) {
    if(req.query.admin === "true") {
      console.log(`Admin access to room ${req.params.room}`);
      res.render("rooms-admin", { roomId: req.params.room });
    }else{
      res.render("rooms-user", { roomId: req.params.room });
    }
  } else {
    res.render("room-not-available"); // Show "Room Not Available"
  }
});

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId, isHost, username) => {
    console.log(userId)
    if (!activeRooms[roomId]) {
      socket.emit('room-closed')
      return
    }

    // Check if host already exists
    if (isHost && roomHosts[roomId]) {
      console.log(`Host already exists in ${roomId}, rejecting new host.`);
      socket.emit('host-already-exists');
      return;
    }

    socket.join(roomId)
    socket.roomId = roomId
    socket.isHost = isHost
    socket.username = username

    // Track host
    if (isHost) {
      roomHosts[roomId] = userId;
    }


    // Track usernames in this room
    if (!roomUsers[roomId]) roomUsers[roomId] = {}
    roomUsers[roomId][userId] = username

    console.log(`${username} joined room ${roomId}`)
    
    // Send updated participant list to host
    io.to(roomId).emit('update-participants', roomUsers[roomId], roomHosts[roomId]);

    // Broadcast chat messages
    socket.on('chat-message', (message) => {
      io.to(roomId).emit('chat-message', {
        username: socket.username,
        message: message,
      });
    });

    // Notify others
    socket.to(roomId).broadcast.emit('user-connected', userId, username)

    socket.on('disconnect', () => {
      console.log(`${username} disconnected from room ${roomId}`)

      if (socket.isHost) {
        console.log(`Host left room ${roomId}, closing room.`)
        socket.to(roomId).broadcast.emit('host-ended')

        const room = io.sockets.adapter.rooms[roomId]
        if (room) {
          const clientIds = Object.keys(room.sockets)
          clientIds.forEach(clientId => {
            io.to(clientId).emit('room-closed')
            io.sockets.sockets[clientId].disconnect(true)
          })
        }

        delete activeRooms[roomId];
        delete roomUsers[roomId];
        delete roomHosts[roomId];
      } else {
        delete roomUsers[roomId][userId]
        io.to(roomId).emit('update-participants', roomUsers[roomId], roomHosts[roomId])
        socket.to(roomId).broadcast.emit('user-disconnected', userId)
      }
    })
  })
})

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
