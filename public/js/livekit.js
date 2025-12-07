let room;
let isMuted = true;
let isCamOn = false; // start with camera OFF
let isRecording = false
let isScreenSharing = false
const platformId = "miskills"

document.getElementById("joinBtn").onclick = () => {
    const scheduleId = document.getElementById("scheduleId").value;
    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const occurrenceId = document.getElementById("occurrenceId").value;

    socket.emit("joinRoom", {
        platformId,
        scheduleId,
        username,
        occurrenceId,
        userId
    });
};

socket.on("livekit-auth", async ({ url, token }) => {
    room = new LivekitClient.Room({
        autoSubscribe: true
    });

    room
        .on("participantConnected", (p) => {
            console.log("Participant connected:", p.identity);
            addPlaceholder(p.identity);
        })
        .on("participantDisconnected", (p) => {
            removeTile(p.identity);
        })
        .on("trackSubscribed", (track, pub, participant) => {
            attachTrack(track, participant.identity);
        })
        .on("trackUnsubscribed", (track, pub, participant) => {
            detachTrack(track, participant.identity);
        });

    await room.connect(url, token);

    // show self tile
    addPlaceholder(room?.localParticipant?.identity);

    console.log('room participants', room?.remoteParticipants)

    // add already existing participants




    room?.remoteParticipants?.forEach((id, participant) => {
        console.log("Existing participant:", participant);
        addPlaceholder(participant);

        participant?.tracks?.forEach(pub => {
            if (pub.isSubscribed && pub.track) {
                attachTrack(pub.track, participant.identity);
            }
        });
    })
});

function addPlaceholder(identity) {
    let tile = document.getElementById("tile-" + identity);
    if (!tile) {
        tile = document.createElement("div");
        tile.id = "tile-" + identity;
        tile.className = "tile";

        const placeholder = document.createElement("div");
        placeholder.className = "placeholder";
        placeholder.innerText = identity.toUpperCase();
        tile.appendChild(placeholder);

        document.getElementById("videos").appendChild(tile);
    }
    return tile;
}

async function attachTrack(track, identity) {
    console.log('Attaching track:', track.kind, 'for', identity);

    let tile = document.getElementById("tile-" + identity);
    if (!tile) {
        tile = addPlaceholder(identity);
    }

    // remove old element if any
    let oldEl = document.getElementById("media-" + identity + "-" + track.kind);
    if (oldEl) oldEl.remove();

    const el = track.attach();
    el.id = "media-" + identity + "-" + track.kind;
    el.autoplay = true;
    el.playsInline = true;

    if (track.kind === "video") {
        // remove placeholder when video starts
        const placeholder = tile.querySelector(".placeholder");
        if (placeholder) placeholder.remove();
        tile.appendChild(el);
    } else if (track.kind === "audio") {
        // make sure we never mute remote audio
        el.muted = identity === room?.localParticipant?.identity;
        try {
            await el.play();
        } catch (err) {
            console.warn("Autoplay blocked, waiting for gesture", err);
        }
        // ✅ append audio even if no video tile
        document.body.appendChild(el);
    }
}


function detachTrack(track, identity) {
    const el = document.getElementById("media-" + identity + "-" + track.kind);
    if (el) {
        track.detach(el);
        el.remove();
    }
}

function removeTile(identity) {
    const tile = document.getElementById("tile-" + identity);
    if (tile) tile.remove();
}

// Control buttons
document.getElementById("muteBtn").onclick = async () => {
    isMuted = !isMuted;
    console.log('muted?', isMuted)
    if (!room.localParticipant.microphoneTrack && !isMuted) {
        const [micTrack] = await LivekitClient.createLocalTracks({ audio: true });
        await room.localParticipant.publishTrack(micTrack);
    }
    room.localParticipant.setMicrophoneEnabled(!isMuted);
};

document.getElementById("camBtn").onclick = async () => {
    isCamOn = !isCamOn;
    if (!room.localParticipant.cameraTrack && isCamOn) {
        const [camTrack] = await LivekitClient.createLocalTracks({ video: true });
        await room.localParticipant.publishTrack(camTrack);
        attachTrack(camTrack, room.localParticipant.identity);
    } else {
        room.localParticipant.setCameraEnabled(isCamOn);
    }
};

document.getElementById("shareBtn").onclick = async () => {
    await room.localParticipant.setScreenShareEnabled(true);
    isScreenSharing = !isScreenSharing
    const tracks = await LivekitClient.createLocalTracks({ screen: true });
    for (const t of tracks) {
        await room.localParticipant.publishTrack(t);
        attachTrack(t, room.localParticipant.identity + "-screen");
    }
};

// document.getElementById("unmuteAllBtn").onclick = () => {
//     document.querySelectorAll("audio").forEach(a => {
//         a.muted = false;
//         a.play().catch(console.warn);
//     });
// };

document.getElementById("roomRecording").onclick = async () => {
    const role = document.getElementById("role").value;

    if (role !== "host") {
        alert("only host can trigger recording")
        return
    }

    if (!isRecording) {
        startRoomRecording()
    } else {
        stopRoomRecording()
    }
}


document.getElementById("screenRecording").onclick = async () => {

    const role = document.getElementById("role").value;

    if (role !== "host") {
        alert("only host can trigger recording")
        return
    }

    if (!isRecording) {
        startScreenRecording()

    } else {
        stopScreenRecording()
    }
}


// Simple Screen Recording Controls
const startScreenRecording = () => {


    const scheduleId = document.getElementById("scheduleId").value;
    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const occurrenceId = document.getElementById("occurrenceId").value;
    const role = document.getElementById("role").value;



    if (!isScreenSharing) {
        alert("Please start screen sharing first before recording your screen.");
        return;
    }

    socket.emit("startScreenRecording", {
        occurrenceId,
        scheduleId,
        userId,
        username,
        role,
    });

    isRecording = !isRecording
    document.getElementById("recordingStatus").innerHTML = "Recording started"
};

const stopScreenRecording = () => {

    const scheduleId = document.getElementById("scheduleId").value;
    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const occurrenceId = document.getElementById("occurrenceId").value;
    const role = document.getElementById("role").value;

    socket.emit("stopScreenRecording", {
        scheduleId,
        occurrenceId,
        userId,
        username,
        role,
    });
    isRecording = !isRecording
    document.getElementById("recordingStatus").innerHTML = "Recording stopped"
};
// Room Recording Controls
const startRoomRecording = () => {

    const scheduleId = document.getElementById("scheduleId").value;
    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const occurrenceId = document.getElementById("occurrenceId").value;
    const role = document.getElementById("role").value;


    socket.emit("startRoomRecording", {
        occurrenceId,
        scheduleId,
        userId,
        username,
        role,
    });

    isRecording = !isRecording
    document.getElementById("recordingStatus").innerHTML = "Recording stopped"
};

const stopRoomRecording = () => {

    const scheduleId = document.getElementById("scheduleId").value;
    const userId = document.getElementById("userId").value;
    const username = document.getElementById("username").value;
    const occurrenceId = document.getElementById("occurrenceId").value;
    const role = document.getElementById("role").value;


    socket.emit("stopRoomRecording", {
        scheduleId,
        occurrenceId,
        userId,
        username,
        role,
    });

    isRecording = !isRecording
    document.getElementById("recordingStatus").innerHTML = "Recording stopped"
};


socket.on("recordingStatus", (data) => {
    console.log("Recording", data)
})


document.getElementById("endRoom").onclick = async () => {
    await socket.emit("endRoom", {
      scheduleId: document.getElementById("scheduleId"),
      occurrenceId:  document.getElementById("occurrenceId"),
      platformId: platformId,
      userId:  document.getElementById("userId")
    });
    alert("room ended")
}

