const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myPeer = new Peer(undefined, {
  config: {
    iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "fa9979a6e783100976d5e7ae",
        credential: "XZhecIMeIDmPqIUs",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "fa9979a6e783100976d5e7ae",
        credential: "XZhecIMeIDmPqIUs",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "fa9979a6e783100976d5e7ae",
        credential: "XZhecIMeIDmPqIUs",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "fa9979a6e783100976d5e7ae",
        credential: "XZhecIMeIDmPqIUs",
      },
    ],
  },
});
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
const shareSButton = document.getElementById("share-screen"); // Ensure this element exists in your HTML
const isHost = urlParams.get("admin") === "true";
let localStream;

let originalVideoTrack;
let originalAudioTrack;

const videoSenders = {};
const audioSenders = {};

let isScreenSharing = false;
let screenVideoTrack = null; // Renamed for clarity
let screenAudioTrack = null; // New: to store the system audio track

document.getElementById("host").muted = true;

socket.on("host-already-exists", () => {
  alert(
    "A host is already in this room. You have been redirected as a participant."
  );

  const url = new URL(window.location.href);
  url.searchParams.delete("admin");
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

socket.on("chat-message", (data) => {
  const msgElement = document.createElement("p");
  msgElement.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  chatMessages.appendChild(msgElement);
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

function createFakeVideoTrack(hostName) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(30); // 30 fps to keep browser happy

  function drawPlaceholder() {
    // Black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "24px Poppins";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(hostName.toUpperCase(), canvas.width / 2, canvas.height / 2);

    requestAnimationFrame(drawPlaceholder); // Keep refreshing
  }

  drawPlaceholder();

  return stream.getVideoTracks()[0];
}

shareSButton.addEventListener("click", () => {
  if (!isScreenSharing) {
    originalVideoTrack = localStream.getVideoTracks()[0];
    originalAudioTrack = localStream.getAudioTracks()[0];

    navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: true }) // Screen + system audio
      .then((screenStream) => {
        // Capture microphone audio
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((micStream) => {
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];
            const micAudioTrack = micStream.getAudioTracks()[0];

            // 🎙️ Combine system audio and mic audio
            const mixedAudioStream = new MediaStream();

            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();

            // System audio
            if (screenAudioTrack) {
              const systemSource = audioContext.createMediaStreamSource(
                new MediaStream([screenAudioTrack])
              );
              systemSource.connect(destination);
            }

            // Microphone audio
            const micSource = audioContext.createMediaStreamSource(
              new MediaStream([micAudioTrack])
            );
            micSource.connect(destination);

            // Combine into one stream
            mixedAudioStream.addTrack(destination.stream.getAudioTracks()[0]);

            // Replace tracks
            for (const userId in videoSenders) {
              videoSenders[userId].replaceTrack(screenVideoTrack);
            }

            for (const userId in audioSenders) {
              audioSenders[userId].replaceTrack(
                mixedAudioStream.getAudioTracks()[0]
              );
            }

            localStream.removeTrack(originalVideoTrack);
            localStream.addTrack(screenVideoTrack);

            localStream.removeTrack(originalAudioTrack);
            localStream.addTrack(mixedAudioStream.getAudioTracks()[0]);

            myVideo.srcObject = localStream;
            isScreenSharing = true;
            videoimg.src = "/img/videocam_off.png";

            screenVideoTrack.onended = () => {
              stopScreenShare();
              micStream.getTracks().forEach((track) => track.stop()); // Stop mic when done
            };
          });
      })
      .catch((error) => {
        console.error("Could not start screen share:", error);
        isScreenSharing = false;
      });
  } else {
    stopScreenShare();
  }
});

function stopScreenShare() {
  if (screenVideoTrack) {
    screenVideoTrack.stop();
    screenVideoTrack = null;
  }
  if (screenAudioTrack) {
    screenAudioTrack.stop();
    screenAudioTrack = null;
  }

  if (originalVideoTrack) {
    for (const userId in videoSenders) {
      videoSenders[userId].replaceTrack(originalVideoTrack);
    }
    const currentLocalVideoTrack = localStream.getVideoTracks()[0];
    if (currentLocalVideoTrack) localStream.removeTrack(currentLocalVideoTrack);
    localStream.addTrack(originalVideoTrack);
  }

  if (originalAudioTrack) {
    for (const userId in audioSenders) {
      audioSenders[userId].replaceTrack(originalAudioTrack);
    }
    const currentLocalAudioTrack = localStream.getAudioTracks()[0];
    if (currentLocalAudioTrack) localStream.removeTrack(currentLocalAudioTrack);
    localStream.addTrack(originalAudioTrack);
  }

  myVideo.srcObject = localStream;
  isScreenSharing = false;
  videoimg.src = "/img/videocam.png"; // Your icon for camera on
}

navigator.mediaDevices
  .getUserMedia({ audio: true, video: false })
  .then((micStream) => {
    let username = getCookie("username");

    const fakeVideoTrack = createFakeVideoTrack(username);
    localStream = new MediaStream([
      fakeVideoTrack,
      ...micStream.getAudioTracks(),
    ]);

    originalVideoTrack = fakeVideoTrack;
    originalAudioTrack = micStream.getAudioTracks()[0];

    addHostVideoStream(myVideo, localStream);

    myPeer.on("call", (call) => {
      console.log("Connecting to new user:", call.peer);
      call.answer(localStream);
      const video = document.createElement("video");
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
      call.on("close", () => {
        video.remove();
        delete peers[call.peer];
      });
    });

    socket.on("user-connected", (userId) => {
      connectToNewUser(userId, localStream);
    });
  });

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
    delete videoSenders[userId];
    delete audioSenders[userId];
  }
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

socket.on("update-participants", (participants, hostPeerId) => {
  if (isHost) {
    const participantDiv = document.getElementById("participants");
    if (participantDiv) {
      // Check if participantDiv exists
      participantDiv.innerHTML = "<h3>Participants:</h3>";
      for (const [peerId, username] of Object.entries(participants)) {
        if (peerId === hostPeerId) {
          participantDiv.innerHTML += `<p>${username} (HOST)</p>`;
        } else {
          participantDiv.innerHTML += `<p>${username}</p>`;
        }
      }
    }
  }
});

function connectToNewUser(userId, stream) {
  console.log("Connecting to new user:", userId);
  const call = myPeer.call(userId, stream, {
    metadata: { role: "admin" },
  });

  call.peerConnection.getSenders().forEach((sender) => {
    if (sender.track) {
      if (sender.track.kind === "video") {
        videoSenders[userId] = sender;
      } else if (sender.track.kind === "audio") {
        audioSenders[userId] = sender;
      }
    }
  });

  const video = document.createElement("video");
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });
  call.on("close", () => {
    video.remove();
    delete peers[userId];
    delete videoSenders[userId];
    delete audioSenders[userId];
  });

  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.muted = false; // Remote videos should not be muted
  video.classList.add("hidden");
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

function addHostVideoStream(video, stream) {
  const vid = document.getElementById("host"); // Assuming 'host' is the ID for the local video element
  if (vid) {
    vid.srcObject = stream;
    vid.muted = true; // Your own video should typically be muted
    vid.addEventListener("loadedmetadata", () => {
      vid.play();
    });
  }
}

let isAudio = true;
let isVideo = true;

function muteA() {
  console.log("toggling audio");
  isAudio = !isAudio;
  if (localStream && localStream.getAudioTracks().length > 0) {
    localStream.getAudioTracks()[0].enabled = isAudio;
  }
  if (isAudio) {
    audioimg.src = "/img/mic.png";
  } else {
    audioimg.src = "/img/mic_off.png";
  }
}

function muteV() {
  console.log("toggling video");
  isVideo = !isVideo;
  if (localStream && localStream.getVideoTracks().length > 0) {
    localStream.getVideoTracks()[0].enabled = isVideo;
  }
  if (isVideo) {
    videoimg.src = "/img/videocam.png";
  } else {
    videoimg.src = "/img/videocam_off.png";
  }
}

function leave() {
  // Disconnect from PeerJS
  myPeer.disconnect();
  // Close all peer connections
  for (const userId in peers) {
    if (peers[userId]) {
      peers[userId].close();
    }
  }
  // Stop local media tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  // Emit leave room event to server
  socket.emit("leave-room", ROOM_ID, myPeer.id);
  location.href = "/end-call";
}
