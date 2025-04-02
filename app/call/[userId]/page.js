"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { FaPhoneSlash } from "react-icons/fa";
import { auth } from "../../firebase";

export default function CallPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { userId } = params;
  const callType = searchParams.get("type"); // "voice" or "video"
  const currentUserId = auth.currentUser?.uid;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState("calling"); // calling, inCall, ended
  const socketRef = useRef(null);
  const peerRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const socket = io("http://localhost:4500/"); // Change this if necessary
    socketRef.current = socket;

    // Handle connection errors
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      alert("Connection failed. Please check your network.");
    });

    const roomId = [userId, currentUserId].sort().join("_");

    // Join the room
    socket.emit("joinRoom", { roomId, userId: currentUserId });

    // Handle incoming call
    socket.on("callReceived", async ({ offer, callerId }) => {
      const stream = await initializeLocalStream(callType);
      setLocalStream(stream);

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
      });

      peer.on("signal", (data) => {
        socket.emit("callAnswer", { roomId, answer: data, calleeId: currentUserId });
      });

      peer.on("stream", (remoteStream) => {
        setRemoteStream(remoteStream);
        setCallStatus("inCall");
      });

      peer.on("icecandidate", (candidate) => {
        if (candidate) {
          socket.emit("iceCandidate", { roomId, candidate, userId: currentUserId });
        }
      });

      // Set remote description (offer) and signal the answer
      if (peer) {
        try {
          await peer.signal(offer); // Make sure this is done after offer is received
        } catch (error) {
          console.error("Error setting offer:", error);
        }
      }
      peerRef.current = peer;
    });

    // Handle call answer
    socket.on("callAnswered", ({ answer }) => {
      if (peerRef.current && peerRef.current.connected) {
        try {
          peerRef.current.signal(answer); // Set the remote description (answer)
        } catch (error) {
          console.error("Error setting answer:", error);
        }
      }
    });

    // Handle ICE candidates
    socket.on("iceCandidateReceived", ({ candidate }) => {
      if (peerRef.current) {
        try {
          peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [userId, currentUserId, callType]);

  // Initialize local stream (audio/video)
  const initializeLocalStream = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  // Initiate the call
  useEffect(() => {
    if (!socketRef.current || !currentUserId) return;

    const roomId = [userId, currentUserId].sort().join("_");

    initializeLocalStream(callType).then((stream) => {
      setLocalStream(stream);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
      });

      peer.on("signal", (data) => {
        socketRef.current.emit("initiateCall", { roomId, offer: data, callerId: currentUserId });
      });

      peer.on("stream", (remoteStream) => {
        setRemoteStream(remoteStream);
        setCallStatus("inCall");
      });

      peer.on("icecandidate", (candidate) => {
        if (candidate) {
          socketRef.current.emit("iceCandidate", { roomId, candidate, userId: currentUserId });
        }
      });

      peerRef.current = peer;
    });
  }, [callType, currentUserId, userId]);

  // End the call
  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setCallStatus("ended");
    window.location.href = `/userChat/${userId}/`; // Redirect to chat page after ending the call
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      {/* Call Status */}
      <div className="text-2xl mb-4">
        {callStatus === "calling" && "Calling..."}
        {callStatus === "inCall" && "In Call"}
        {callStatus === "ended" && "Call Ended"}
      </div>

      {/* Remote Video */}
      {callType === "video" && remoteStream && (
        <video
          ref={(ref) => {
            if (ref) ref.srcObject = remoteStream;
          }}
          autoPlay
          className="w-full h-full max-w-4xl max-h-[70vh] rounded-lg"
        />
      )}

      {/* Local Video */}
      {callType === "video" && localStream && (
        <video
          ref={(ref) => {
            if (ref) ref.srcObject = localStream;
          }}
          autoPlay
          muted
          className="w-40 h-40 rounded-lg absolute bottom-4 right-4"
        />
      )}

      {/* End Call Button */}
      <button
        onClick={endCall}
        className="mt-4 p-4 bg-red-500 text-white rounded-full hover:bg-red-600"
      >
        <FaPhoneSlash className="text-2xl" />
      </button>
    </div>
  );
}
