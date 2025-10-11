import express from "express";
import http from "http";
import multer from "multer"
import fs from "fs";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
let username = "admin";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));
app.get('/favicon.ico', (req, res) => res.status(204).end());


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { username } = req.body;
    const folderName = username || "guest";
    const uploadPath = path.join(__dirname, "public/uploads", `${folderName}`);
    fs.mkdirSync(uploadPath , { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });
app.post("/upload", upload.single("file"), (req, res) => {
    
    const { folder } = req.body;
    const fileName = req.file.filename;
    const filePath = `/uploads/${folder }/${fileName}`;
    res.json({ success: true, filePath });
});


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
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
