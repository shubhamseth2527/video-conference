import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("joinRoom", ({ roomId, username }) => {
        socket.join(roomId);
        socket.to(roomId).emit("userJoined", { id: socket.id, username });
        console.log(`${username} joined room ${roomId}`);
    });

    socket.on("webrtcOffer", (data) => {
        io.to(data.to).emit("webrtcOffer", data);
    });

    socket.on("webrtcAnswer", (data) => {
        io.to(data.to).emit("webrtcAnswer", data);
    });

    socket.on("iceCandidate", (data) => {
        io.to(data.to).emit("iceCandidate", data.candidate);
    });

    socket.on("disconnecting", () => {
        const rooms = socket.rooms;
        rooms.forEach(roomId => {
            socket.to(roomId).emit("userLeft", socket.id);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
