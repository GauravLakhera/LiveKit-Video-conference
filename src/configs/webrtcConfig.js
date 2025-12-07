export const webrtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302" // free public STUN
    },
    {
      urls: [
        "turn:relay1.expressturn.com:3478?transport=udp",
        "turn:relay1.expressturn.com:3478?transport=tcp"
      ],
      username: "000000002071051916",
      credential: "qNJ3kuPjvB0S1QFnFYHdBaJ/lZw="
    }
  ],
  // optional extra settings
  iceCandidatePoolSize: 5
};
