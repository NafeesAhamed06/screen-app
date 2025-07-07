const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myPeer = new Peer(undefined);
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const audioimg = document.getElementById("audio-img");
const videoimg = document.getElementById("video-img");
const isHost = urlParams.get("admin") === "true";
let localStream;

document.getElementById("host").muted = true;

socket.on("host-already-exists", () => {
  alert(
    "A host is already in this room. You have been redirected as a participant."
  );

  // Redirect to same room without ?admin=true
  const url = new URL(window.location.href);
  url.searchParams.delete("admin"); // remove admin param
  window.location.href = url.toString();
});

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (message !== "") {
    socket.emit("chat-message", message);
    chatInput.value = "";
  }
});

// Receive message
socket.on("chat-message", (data) => {
  const msgElement = document.createElement("p");
  msgElement.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  chatMessages.appendChild(msgElement);

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function askUsername() {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#0008;display:flex;justify-content:center;align-items:center;z-index:9999;">
        <div style="background:white;padding:20px;border-radius:8px;text-align:center;">
          <h3>Enter your username</h3>
          <input type="text" id="usernameInput" placeholder="Your name" style="padding:5px;width:80%;">
          <br><br>
          <button id="submitUsername" style="padding:5px 10px;">Join</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("submitUsername").onclick = () => {
      const username = document.getElementById("usernameInput").value.trim();
      if (username) {
        setCookie("username", username, 7); // save for 7 days
        document.body.removeChild(modal);
        resolve(username);
      }
    };
  });
}

socket.on("room-closed", () => {
  alert("This room is no longer available.");
  window.location.href = "/end-call";
});

// function createFakeVideoTrack() {
//   const canvas = document.createElement("canvas");
//   canvas.width = 640;
//   canvas.height = 480;
//   const ctx = canvas.getContext("2d");

//   // Start capturing stream
//   const stream = canvas.captureStream(15); // 15 fps

//   // Animate to force browser to render
//   function drawBlackFrame() {
//     ctx.fillStyle = "black";
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//     requestAnimationFrame(drawBlackFrame);
//   }
//   drawBlackFrame();

//   return stream.getVideoTracks()[0];
// }

// function createFakeVideoTrack(hostName) {
//   const canvas = document.createElement("canvas");
//   canvas.width = 640;
//   canvas.height = 480;
//   const ctx = canvas.getContext("2d");

//   // Load "video off" icon
//   const videoOffIcon = new Image();
//   videoOffIcon.src = "/img/videocamm.png"; // Path to your icon
//   videoOffIcon.style.filter = "invert(1)"; // Invert colors for better visibility
//   // Start capturing stream
//   const stream = canvas.captureStream(15); // 15 fps

//   function drawPlaceholder() {
//     // Black background
//     ctx.fillStyle = "black";
//     ctx.fillRect(0, 0, canvas.width, canvas.height);

//     // Draw video-off icon (centered)
//     const iconSize = 64;
//     ctx.drawImage(
//       videoOffIcon,
//       (canvas.width - iconSize) / 2,
//       (canvas.height - iconSize) / 2 - 40, // slightly above name
//       iconSize,
//       iconSize
//     );

//     // Draw host name (centered)
//     ctx.font = "30px Poppins";
//     ctx.fillStyle = "white";
//     ctx.textAlign = "center";

//     ctx.fillText(hostName.toUpperCase(), canvas.width / 2, canvas.height / 2 + 40);

//     requestAnimationFrame(drawPlaceholder);
//   }

//   videoOffIcon.onload = () => {
//     drawPlaceholder();
//   };

//   return stream.getVideoTracks()[0];
// }

function createFakeVideoTrack(hostName) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  // Load "video off" icon
  const videoOffIcon = new Image();
  videoOffIcon.src = "/img/videocamm.png"; // Path to your icon

  const stream = canvas.captureStream(60); // 15 fps

  // Position and velocity
  let x = Math.random() * (canvas.width - 100);
  let y = Math.random() * (canvas.height - 100);
  let dx = 2;
  let dy = 2;

  function drawPlaceholder() {
    // Clear canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw video-off icon and host name
    const iconSize = 48;
    ctx.drawImage(videoOffIcon, x, y, iconSize, iconSize);

    ctx.font = "16px Poppins";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(hostName.toUpperCase(), x + iconSize / 2, y + iconSize + 25);

    // Move
    x += dx;
    y += dy;

    // Bounce off walls
    if (x <= 0 || x + iconSize >= canvas.width) dx = -dx;
    if (y <= 0 || y + iconSize + 25 >= canvas.height) dy = -dy;

    requestAnimationFrame(drawPlaceholder);
  }

  videoOffIcon.onload = () => {
    drawPlaceholder();
  };

  return stream.getVideoTracks()[0];
}

// const shareSButton = document.getElementById("share-screen");
// shareSButton.addEventListener("click", () => {
//   navigator.mediaDevices
//     .getDisplayMedia({ video: true })
//     .then((screenStream) => {
//       const newVideoTrack = screenStream.getVideoTracks()[0];

//       // Replace video track for all connected users
//       for (const userId in senders) {
//         senders[userId].replaceTrack(newVideoTrack);
//       }

//       // Replace video in local stream
//       localStream.removeTrack(localStream.getVideoTracks()[0]);
//       localStream.addTrack(newVideoTrack);
//       myVideo.srcObject = localStream;
//     });
// });

const shareSButton = document.getElementById("share-screen");
let isScreenSharing = false;
let screenTrack = null;

shareSButton.addEventListener("click", () => {
  if (!isScreenSharing) {
    // Start screen share
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then((screenStream) => {
        screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track for all connected users
        for (const userId in senders) {
          senders[userId].replaceTrack(screenTrack);
        }

        // Replace video in local stream
        localStream.removeTrack(localStream.getVideoTracks()[0]);
        localStream.addTrack(screenTrack);
        myVideo.srcObject = localStream;

        isScreenSharing = true;
        // shareSButton.textContent = "Stop Screen Share";
        videoimg.src = "/img/videocam_off.png";


        // Handle when user stops sharing from browser
        screenTrack.onended = () => {
          stopScreenShare();
        };
      });
  } else {
    // Stop screen share
    stopScreenShare();
  }
});

function stopScreenShare() {
  if (screenTrack) screenTrack.stop(); // Stop the current screen track
  let username = getCookie("username");

  // Create a fake placeholder video track (DVD animation)
  const fakeTrack = createFakeVideoTrack(username); // Pass host name
  for (const userId in senders) {
    senders[userId].replaceTrack(fakeTrack);
  }

  // Replace video in local stream
  localStream.removeTrack(localStream.getVideoTracks()[0]);
  localStream.addTrack(fakeTrack);
  myVideo.srcObject = localStream;

  isScreenSharing = false;
  // shareSButton.textContent = "Start Screen Share";
  videoimg.src = "/img/videocam.png";

}

// Get mic audio + fake video
navigator.mediaDevices.getUserMedia({ audio: true }).then((micStream) => {
  let username = getCookie("username");

  const fakeVideoTrack = createFakeVideoTrack(username);
  localStream = new MediaStream([
    fakeVideoTrack,
    ...micStream.getAudioTracks(),
  ]);
  addHostVideoStream(myVideo, localStream);

  myPeer.on("call", (call) => {
    console.log("Connecting to new user: 106");
    call.answer(localStream);
    const video = document.createElement("video");
    call.on("stream", (userVideoStream) => {
      const hasVideo = userVideoStream.getVideoTracks().length > 0;

      if (hasVideo) {
        console.log("This stream has a video track");
        addHostVideoStream(video, userVideoStream);
      } else {
        console.log("This stream has no video track");
        addVideoStream(video, userVideoStream);
      }
    });
  });

  socket.on("user-connected", (userId) => {
    connectToNewUser(userId, localStream);
  });
});

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

myPeer.on("open", async (id) => {
  const isHost =
    new URLSearchParams(window.location.search).get("admin") === "true";
  let username = getCookie("username");
  if (!username) {
    username = await askUsername();
  }
  socket.emit("join-room", ROOM_ID, id, isHost, username);
});

let hostname;

socket.on("update-participants", (participants, hostPeerId) => {
  if (isHost) {
    const participantDiv = document.getElementById("participants");
    participantDiv.innerHTML = "<h3>Participants:</h3>";
    for (const [peerId, username] of Object.entries(participants)) {
      if (peerId === hostPeerId) {
        participantDiv.innerHTML += `<p>${username} (HOST)</p>`;
      } else {
        participantDiv.innerHTML += `<p>${username}</p>`;
      }
    }
  }
});

const senders = {}; // Keep track of userId -> sender

function connectToNewUser(userId, stream) {
  console.log("Connecting to new user:", userId);
  const call = myPeer.call(userId, stream, {
    metadata: { role: "admin" }, // 👈 send "I am admin"
  });
  call.peerConnection.getSenders().forEach((sender) => {
    if (sender.track && sender.track.kind === "video") {
      senders[userId] = sender;
    }
  });
  const video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    const hasVideo = userVideoStream.getVideoTracks().length > 0;

    if (hasVideo) {
      console.log("This stream has a video track");
      addHostVideoStream(video, userVideoStream);
    } else {
      console.log("This stream has no video track");
      addVideoStream(video, userVideoStream);
    }
  });
  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.classList.add("hidden");
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });

  videoGrid.append(video);
}
function addHostVideoStream(video, stream) {
  const vid = document.getElementById("host");
  vid.srcObject = stream;
  vid.addEventListener("loadedmetadata", () => {
    vid.play();
  });
}
let isAudio = true;
let isVideo = true;
function muteA() {
  console.log("turned off audio");
  isAudio = !isAudio;
  localStream.getAudioTracks()[0].enabled = isAudio;
  if (isAudio) {
    audioimg.src = "/img/mic.png";
  } else {
    audioimg.src = "/img/mic_off.png";
  }
}

function muteV() {
  console.log("turned off video");
  isVideo = !isVideo;
  localStream.getVideoTracks()[0].enabled = isVideo;
  if (isVideo) {
    videoimg.src = "/img/videocam.png";
  } else {
    videoimg.src = "/img/videocam_off.png";
  }
}

function leave() {
  location.href = "/end-call";
}
