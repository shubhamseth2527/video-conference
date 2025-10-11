const socket = io(); 
let username = ""; 
let localStream, peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let selectedBgImage = null;
let selfieSegmentation;
let ctx, outputCanvas, localVideo, remoteVideo, videoContainer, controlPanel;
const screenshotBtn  = document.getElementById("screenshot-btn");
const downloadBtn = document.getElementById("download-btn");
const thumbnailContainer = document.getElementById("thumbnail-container");
const instruction = document.getElementById("instruction");
const documents = [
  { name: "Aadhaar", ext: "png", message: "📸 Please show your Aadhaar card" },
  { name: "PAN", ext: "jpg", message: "📸 Now show your PAN card" },
  { name: "Voter", ext: "png", message: "📸 Finally, show your Voter ID card" },
];
let sessionFolder = null; // global

function getEpoch() {
  return Date.now(); //
}
let currentIndex = 0;
let capturedFiles = [];
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
const userUUID = generateUUID();
// Helper: format datetime
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// Helper: take screenshot from video
function takeScreenshot(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function handleScreenshot() {
  const videoEl = document.getElementById("local-video");
  if (!videoEl) return alert("Video not found!");

  if (currentIndex >= documents.length) {
    instruction.textContent =
      "All documents captured successfully! Click 'Download All' to save files.";
    screenshotBtn.disabled = true;
    downloadBtn.style.display = "inline-block";
    return;
  }

   // Set folder name once
  if (!sessionFolder) sessionFolder = Date.now();

  const doc = documents[currentIndex];
  const timestamp = getTimestamp();
  const fileName = `${doc.name}_${timestamp}.${doc.ext}`;

  const canvas = takeScreenshot(videoEl);
  const thumb = document.createElement("img");
  thumb.src = canvas.toDataURL(`image/${doc.ext}`);
  thumb.title = doc.name;
  thumb.style.width = "100px";
  thumb.style.border = "2px solid #4CAF50";
  thumb.style.borderRadius = "6px";
  thumbnailContainer.appendChild(thumb);

  // Store in-memory blob for later upload
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, `image/${doc.ext}`)
  );
  capturedFiles.push({ fileName, blob });

  currentIndex++;

  if (currentIndex < documents.length) {
    instruction.textContent = documents[currentIndex].message;
  } else {
    instruction.textContent = "✅ All documents captured successfully! Click 'Download All' to save files.";
    screenshotBtn.disabled = true;
    downloadBtn.style.display = "inline-block";
  }
}

async function handleDownload() {
  if (capturedFiles.length === 0) {
    alert("No screenshots taken!");
    return;
  }

  // Upload each file now (delayed until this point)
  const uploadedUrls = [];
  for (const fileObj of capturedFiles) {
    const { fileName, blob } = fileObj;
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("username", username);
    formData.append("folder", sessionFolder);

    const res = await fetch("/upload", { method: "POST", body: formData });

    if (!res.ok) {
      const text = await res.text();
      console.error("Upload failed:", text);
      return alert("Upload failed. See console.");
    }

    const data = await res.json();
    uploadedUrls.push(data.filePath);
  }

  instruction.textContent = "📁 All files uploaded and downloaded!";
}

screenshotBtn.addEventListener("click", () => {
  if (currentIndex === 0) {
    instruction.textContent = documents[0].message;
  }
  handleScreenshot();
});

downloadBtn.addEventListener("click", handleDownload);


document.addEventListener("DOMContentLoaded", () => {
  // === DOM elements ===
  const roomInput = document.getElementById("room-id");
  const usernameInput = document.getElementById("username");
  const joinButton = document.getElementById("join-button");
  videoContainer = document.getElementById("video-container");
  localVideo = document.getElementById("local-video");
  remoteVideo = document.getElementById("remote-video");
  controlPanel = document.querySelector(".control-panel");
  outputCanvas = document.getElementById("output-canvas");
  ctx = outputCanvas.getContext("2d");
  const bgButton = document.getElementById("bg-button");

  // ===== Join Room =====
  joinButton.addEventListener("click", async () => {
    const roomId = roomInput.value;
    const username = usernameInput.value;
    if (!roomId || !username) return alert("Enter Room ID and Username");

    videoContainer.style.display = "block";
    if (controlPanel) controlPanel.style.display = "flex";

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localVideo.srcObject = localStream;

      // Start segmentation after video stream is set
      initSegmentation();

    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      return;
    }
   instruction.textContent = "Click 'Screenshot' to capture your Aadhaar card.";
    socket.emit("joinRoom", { roomId, username });
  });

  // ===== WebRTC Handling =====
  socket.on("userJoined", async ({ id }) => {
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track =>
      peerConnection.addTrack(track, localStream)
    );
    peerConnection.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
    peerConnection.onicecandidate = e => {
      if (e.candidate)
        socket.emit("iceCandidate", { to: id, candidate: e.candidate });
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("webrtcOffer", { to: id, from: socket.id, sdp: offer });
  });

  socket.on("webrtcOffer", async (data) => {
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track =>
      peerConnection.addTrack(track, localStream)
    );
    peerConnection.ontrack = e => (remoteVideo.srcObject = e.streams[0]);
    peerConnection.onicecandidate = e => {
      if (e.candidate)
        socket.emit("iceCandidate", { to: data.from, candidate: e.candidate });
    };

    await peerConnection.setRemoteDescription(data.sdp);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("webrtcAnswer", { to: data.from, sdp: answer });
  });

  socket.on("webrtcAnswer", async (data) =>
    await peerConnection.setRemoteDescription(data.sdp)
  );
  socket.on("iceCandidate", candidate =>
    peerConnection && peerConnection.addIceCandidate(candidate)
  );
  socket.on("userLeft", id => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  });

  // ===== Background Button =====
  bgButton.onclick = () => {
    bgThumbnails.style.display =
      bgThumbnails.style.display === "flex" ? "none" : "flex";
  };

  // Select background image
  document.querySelectorAll(".bg-thumb").forEach(img => {
    img.addEventListener("click", () => {
      selectedBgImage = new Image();
      selectedBgImage.src = img.src;
      bgThumbnails.style.display = "none"; // hide after select
    });
  });
});


// ===== Segmentation Logic =====
function initSegmentation() {
  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  });
  selfieSegmentation.setOptions({ modelSelection: 1 });
  selfieSegmentation.onResults(drawWithBackground);

  // Resize canvas to match video
  localVideo.addEventListener("loadedmetadata", () => {
    outputCanvas.width = localVideo.videoWidth;
    outputCanvas.height = localVideo.videoHeight;
  });

  async function sendFrame() {
    if (localVideo.readyState >= 2) {
      await selfieSegmentation.send({ image: localVideo });
    }
    requestAnimationFrame(sendFrame);
  }
  sendFrame();
}

function drawWithBackground(results) {
  if (!ctx || !localVideo) return;

  const width = outputCanvas.width;
  const height = outputCanvas.height;
  ctx.clearRect(0, 0, width, height);

  if (selectedBgImage && results.segmentationMask) {
    // === Step 1: Draw the selected background first ===
    ctx.drawImage(selectedBgImage, 0, 0, width, height);

    // === Step 2: Cut out the person area from the background using mask ===
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(results.segmentationMask, 0, 0, width, height);

    // === Step 3: Draw the real person video on top ===
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(localVideo, 0, 0, width, height);

    // Reset mode
    ctx.globalCompositeOperation = "source-over";
  } else {
    // fallback: just show the normal video
    ctx.drawImage(localVideo, 0, 0, width, height);
  }
}






