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
  }
});
const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const audioimg = document.getElementById("audio-img");
let localStream;

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

navigator.mediaDevices
  .getUserMedia({
    video: false,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream);
    localStream = stream;

    myPeer.on("call", (call) => {
      call.answer(stream);
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
      connectToNewUser(userId, stream);
    });
  });

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

myPeer.on("open", async (id) => {
  let username = getCookie("username");
  if (!username) {
    username = await askUsername();
  }
  socket.emit("join-room", ROOM_ID, id, false, username);
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
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

function leave() {
  location.href = "/end-call";
}
