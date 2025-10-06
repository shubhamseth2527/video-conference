const socket = io();

let localStream, peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let selectedBgImage = null;
let selfieSegmentation;
let ctx, outputCanvas, localVideo, remoteVideo, videoContainer, controlPanel;

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
  const bgThumbnails = document.getElementById("bg-thumbnails");

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

document.getElementById("bg-none").addEventListener("click", () => {
    selectedBgImage = null;
    document.getElementById("bg-thumbnails").style.display = "none";
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






