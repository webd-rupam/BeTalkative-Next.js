// userChat/[userId]/page.js
"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, setDoc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaPaperPlane, FaMicrophone, FaSmile, FaKeyboard, FaLink, FaEllipsisV, FaSearch, FaChevronUp, FaChevronDown, FaTimes } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { io } from "socket.io-client";
import { ClipLoader } from 'react-spinners';

export default function UserChat() {
  const params = useParams();
  const { userId } = params;
  const [userData, setUserData] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [showHoldMessage, setShowHoldMessage] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid;
  const messageEndRef = useRef(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByUser, setIsBlockedByUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    document.title = "BeTalkative - Chat";
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_ENDPOINT, {
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to socket server");
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    return () => newSocket.disconnect();
  }, []);

  // Join room when both users are available
  useEffect(() => {
    if (socket && currentUserId && userId) {
      const roomId = [userId, currentUserId].sort().join("_");
      console.log(`Joining room: ${roomId}`);
      socket.emit("joinRoom", { roomId, userId: currentUserId });
    }
  }, [socket, currentUserId, userId]);

  // Listen for incoming messages
  useEffect(() => {
    if (socket) {
      socket.on("receiveMessage", (data) => {
        console.log("Received message:", data);
        setMessages((prevMessages) => [...prevMessages, data]);
      });
    }

    return () => {
      if (socket) {
        socket.off("receiveMessage");
      }
    };
  }, [socket]);

  // Fetch user data
  useEffect(() => {
    // Reset state when the chat changes
    setUserData(null);
    setMessages([]);
    setMessage("");

    // Fetch user data and messages
    const fetchUserData = async () => {
      try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          console.error("No such user document found!");
          router.push("/inbox");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [userId, router]);

  // Fetch messages from Firestore
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const chatId = [userId, currentUserId].sort().join("_");
        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const messagesList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log("Messages from Firestore:", messagesList);
          setMessages(messagesList);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    if (currentUserId) {
      fetchMessages();
    }
  }, [userId, currentUserId]);

  useEffect(() => {
    // Check if the page has already been reloaded
    if (!sessionStorage.getItem('reloaded')) {
      // Mark that the page has been reloaded
      sessionStorage.setItem('reloaded', 'true');
      // Reload the page
      window.location.reload();
    } else {
      // Reset the flag so it won't reload again on a subsequent page load
      sessionStorage.removeItem('reloaded');
    }
  }, []);

  // Listen for deleted messages
  useEffect(() => {
    if (socket) {
      socket.on("messageDeleted", (data) => {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== data.messageId)
        );
      });

      socket.on("messageDeletedForMe", (data) => {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, deletedFor: [...(msg.deletedFor || []), data.userId] }
              : msg
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off("messageDeletedForMe");
      }
    };
  }, [socket]);

  // Listen for edited messages
  useEffect(() => {
    if (socket) {
      socket.on("messageEdited", (data) => {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === data.messageId ? { ...msg, text: data.newText, edited: true } : msg
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.off("messageEdited");
      }
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest(".message-menu")) {
        setOpenMenuId(null); // Close the menu
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  // Send message
  const sendMessage = async () => {
    if (message.trim() === "") return;

    const chatId = [userId, currentUserId].sort().join("_");

    try {
      const chatRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [userId, currentUserId],
          lastMessage: {
            text: message,
            senderId: currentUserId,
            timestamp: serverTimestamp(),
          },
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: {
            text: message,
            senderId: currentUserId,
            timestamp: serverTimestamp(),
          },
        });
      }

      const messagesRef = collection(db, "chats", chatId, "messages");
      const messageData = {
        text: message,
        senderId: currentUserId,
        timestamp: serverTimestamp(),
        replyTo: replyingTo ? {
          messageId: replyingTo.id,
          senderId: replyingTo.senderId,
          text: replyingTo.text,
        } : null,
      };

      await addDoc(messagesRef, messageData);

      if (socket) {
        socket.emit("sendMessage", {
          roomId: chatId,
          userId: currentUserId,
          message: { text: message, senderId: currentUserId, replyTo: messageData.replyTo },
        });
      }

      setMessage("");
      setReplyingTo(null); // Clear the reply context after sending
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Upload audio to Cloudinary
  const uploadAudioToCloudinary = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", "BetalkativeAudio");

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfnjq4nmv/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading audio to Cloudinary:", error);
      return null;
    }
  };

  // Scroll to the bottom of the chat
  useEffect(() => {
    // Scroll to the bottom of the chat after messages are loaded
    if (messages.length > 0 && messageEndRef.current) {
      setTimeout(() => {
        messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      }, 100); // Adjust the delay if needed
    }
  }, [messages, userId, currentUserId]);

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    setMessage((prevMessage) => prevMessage + emoji.native);
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(audioBlob);
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setShowHoldMessage(true);

      // Hide the "Hold to record" message after 2 seconds
      setTimeout(() => {
        setShowHoldMessage(false);
      }, 2000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  // Stop recording audio and send the message
  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowHoldMessage(false); // Hide the "Hold to record" message

      // Wait for the audioBlob to be set
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(audioBlob); // Set the audioBlob state
        audioChunksRef.current = []; // Clear the chunks

        // Automatically send the audio message
        const chatId = [userId, currentUserId].sort().join("_");
        try {
          const chatRef = doc(db, "chats", chatId);
          const chatDoc = await getDoc(chatRef);

          if (!chatDoc.exists()) {
            await setDoc(chatRef, {
              participants: [userId, currentUserId],
              lastMessage: {
                text: "Voice message",
                senderId: currentUserId,
                timestamp: serverTimestamp(),
              },
            });
          } else {
            await updateDoc(chatRef, {
              lastMessage: {
                text: "Voice message",
                senderId: currentUserId,
                timestamp: serverTimestamp(),
              },
            });
          }

          const messagesRef = collection(db, "chats", chatId, "messages");
          const audioUrl = await uploadAudioToCloudinary(audioBlob); // Upload audio to Cloudinary
          const messageData = {
            senderId: currentUserId,
            timestamp: serverTimestamp(),
            audioUrl: audioUrl, // Include the audio URL
          };

          await addDoc(messagesRef, messageData); // Add the audio message to Firestore

          if (socket) {
            socket.emit("sendMessage", {
              roomId: chatId,
              userId: currentUserId,
              message: { senderId: currentUserId, audioUrl: audioUrl },
            });
          }

          setAudioBlob(null); // Clear the audioBlob after sending
        } catch (error) {
          console.error("Error sending audio message:", error);
        }
      };
    }
  };

  // Add a ref for the file input
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) { // 10MB in bytes
      alert("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }
  
    try {
      // Upload the file to Cloudinary
      const fileUrl = await uploadFileToCloudinary(file);
  
      // Send the file URL as a message
      const chatId = [userId, currentUserId].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatRef);
  
      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [userId, currentUserId],
          lastMessage: {
            text: "File",
            senderId: currentUserId,
            timestamp: serverTimestamp(),
          },
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: {
            text: "File",
            senderId: currentUserId,
            timestamp: serverTimestamp(),
          },
        });
      }
  
      const messagesRef = collection(db, "chats", chatId, "messages");
      const messageData = {
        senderId: currentUserId,
        timestamp: serverTimestamp(),
        fileUrl: fileUrl, // Include the file URL
        fileType: file.type.split("/")[0], // "image", "video", or "audio"
      };
  
      await addDoc(messagesRef, messageData);
  
      if (socket) {
        socket.emit("sendMessage", {
          roomId: chatId,
          userId: currentUserId,
          message: { senderId: currentUserId, fileUrl: fileUrl, fileType: file.type.split("/")[0] },
        });
      }
    } catch (error) {
      console.error("Error sending file:", error);
    }
  };

  // Upload file to Cloudinary
  const uploadFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "BetalkativeFiles"); // Replace with your Cloudinary upload preset

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfnjq4nmv/upload", // Replace with your Cloudinary cloud name
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading file to Cloudinary:", error);
      return null;
    }
  };

  // Function to open the modal with the selected media
  const openMediaModal = (mediaUrl, mediaType) => {
    setSelectedMedia({ url: mediaUrl, type: mediaType });
  };

  // Function to close the modal
  const closeMediaModal = () => {
    setSelectedMedia(null);
  };

  // Function to format the date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';  // Return an empty string or some fallback if timestamp is invalid
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';  // Same here, check if timestamp is valid
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groupedMessages = {};
    messages.forEach((message) => {
      const date = formatDate(message.timestamp);
      if (!groupedMessages[date]) {
        groupedMessages[date] = [];
      }
      groupedMessages[date].push(message);
    });
    return groupedMessages;
  };

  const groupedMessages = groupMessagesByDate(messages);

  const handleDeleteMessage = async (messageId, deleteType) => {
    const chatId = [userId, currentUserId].sort().join("_");
    const messageRef = doc(db, "chats", chatId, "messages", messageId);

    try {
      if (deleteType === "forMe") {
        // Update local state immediately
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? { ...msg, deletedFor: [...(msg.deletedFor || []), currentUserId] }
              : msg
          )
        );

        // Update Firestore
        await updateDoc(messageRef, {
          deletedFor: arrayUnion(currentUserId),
        });
      } else if (deleteType === "forEveryone") {
        // Update local state immediately
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== messageId)
        );

        // Update Firestore
        await deleteDoc(messageRef);
      }

      // Notify the backend via Socket.IO
      if (socket) {
        socket.emit("deleteMessage", {
          roomId: chatId,
          messageId: messageId,
          deleteType: deleteType,
          userId: currentUserId,
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleEditMessage = async (messageId, currentText) => {
    // Find the message in the messages array
    const messageToEdit = messages.find((msg) => msg.id === messageId);

    if (!messageToEdit) {
      console.error("Message not found");
      return;
    }

    // Get the message timestamp
    const messageTimestamp = messageToEdit.timestamp;

    // Check if the message is older than 10 minutes
    const currentTime = new Date();
    const messageTime = messageTimestamp.toDate(); // Convert Firestore timestamp to JavaScript Date
    const timeDifferenceInMinutes = (currentTime - messageTime) / (1000 * 60); // Difference in minutes

    if (timeDifferenceInMinutes > 10) {
      alert("You can only edit messages within 10 minutes of sending.");
      return;
    }

    // Proceed with editing the message
    const newText = prompt("Edit your message:", currentText);
    if (newText === null || newText.trim() === "") return;

    const chatId = [userId, currentUserId].sort().join("_");
    const messageRef = doc(db, "chats", chatId, "messages", messageId);

    try {
      await updateDoc(messageRef, {
        text: newText,
        edited: true,
      });

      // Notify the other user via Socket.IO
      if (socket) {
        socket.emit("editMessage", {
          roomId: chatId,
          messageId: messageId,
          newText: newText,
        });
      }
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  // Check block status
  useEffect(() => {
    if (!currentUserId || !userId) return;
  
    // Set up real-time listeners for block status
    const blockRefByCurrent = doc(db, "blockedUsers", `${currentUserId}_${userId}`);
    const blockRefByUser = doc(db, "blockedUsers", `${userId}_${currentUserId}`);
  
    // Listener for current user blocking the other user
    const unsubscribeBlockByCurrent = onSnapshot(blockRefByCurrent, (doc) => {
      setIsBlocked(doc.exists());
    });
  
    // Listener for the other user blocking the current user
    const unsubscribeBlockByUser = onSnapshot(blockRefByUser, (doc) => {
      setIsBlockedByUser(doc.exists());
    });
  
    // Cleanup listeners on component unmount
    return () => {
      unsubscribeBlockByCurrent();
      unsubscribeBlockByUser();
    };
  }, [currentUserId, userId]);

  // Handle unblock user
  const handleUnblockUser = async () => {
    const blockRef = doc(db, "blockedUsers", `${currentUserId}_${userId}`);

    try {
      await deleteDoc(blockRef);
      setIsBlocked(false);
      console.log("User unblocked successfully!");
    } catch (error) {
      console.error("Error unblocking user:", error);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value === "") {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
    } else {
      const results = messages.filter((msg) =>
        msg.text && msg.text.toLowerCase().includes(e.target.value.toLowerCase())
      );
      setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);
    }
  };

  // Handle search navigation
  const handleSearchNavigation = (direction) => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === "up") {
      newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    } else {
      newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    }

    setCurrentSearchIndex(newIndex);
    const messageElement = document.getElementById(`message-${searchResults[newIndex].id}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleReplyMessage = (message) => {
    setReplyingTo(message);
    setShowEmojiPicker(false); // Close emoji picker if open
  };

  // Highlight search results in messages
  const highlightSearchResult = (text) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, "gi");
    return text.split(regex).map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-400 text-black">
          {part}
        </span>
      ) : (
        part
      )
    );
  };


  if (!userData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-black overflow-x-hidden">
      {/* Chat Header */}
      <div className="flex sticky top-0 items-center p-4 bg-[#111] border-b border-gray-700">
        <button
          onClick={() => router.push("/inbox")}
          className="mr-3 p-2 text-gray-400 hover:text-white"
        >
          <FaArrowLeft className="text-xl relative right-2 md:right-0" />
        </button>
  
        <Link href={`/userProfile/${userId}`} className="flex items-center flex-1 relative right-3 md:right-0">
          <Image
            src={userData.profilePic || "/nullPic.png"}
            alt={userData.username}
            width={40}
            height={40}
            className="object-cover rounded-full"
          />
          <span className="text-white font-semibold ml-2">{userData.displayName}</span>
        </Link>
  
        {/* Search Icon */}
        <button
          onClick={() => setShowSearchBar(!showSearchBar)}
          className="p-2 text-gray-400 hover:text-white"
        >
          <FaSearch className="text-xl" />
        </button>
      </div>
  
      {/* Search Bar */}
      {showSearchBar && (
        <div className="p-4 bg-[#111] border-b border-gray-700">
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search messages..."
              className="flex-1 p-2 bg-gray-800 text-white rounded-lg focus:outline-none"
            />
            <button
              onClick={() => handleSearchNavigation("up")}
              className="ml-2 p-2 text-gray-400 hover:text-white"
            >
              <FaChevronUp />
            </button>
            <button
              onClick={() => handleSearchNavigation("down")}
              className="ml-2 p-2 text-gray-400 hover:text-white"
            >
              <FaChevronDown />
            </button>
            {/* Close Button */}
            <button
              onClick={() => {
                setShowSearchBar(false); // Hide the search bar
                setSearchQuery(""); // Clear the search query
                setSearchResults([]); // Clear the search results
                setCurrentSearchIndex(-1); // Reset the search index
              }}
              className="ml-2 p-2 text-gray-400 hover:text-white"
            >
              <FaTimes className="text-xl" />
            </button>
          </div>
        </div>
      )}
  
      {/* Block Messages */}
      {isBlocked && (
        <div className="h-32 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <p className="text-gray-400">You have blocked this user.</p>
            <button
              onClick={handleUnblockUser}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Unblock
            </button>
          </div>
        </div>
      )}
  
      {isBlockedByUser && (
        <div className="h-24 flex items-center justify-center bg-gray-800">
          <p className="text-gray-400">You can't communicate with this user at this moment!</p>
        </div>
      )}
  
      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        {Object.entries(groupedMessages).map(([date, messages]) => (
          <div key={date}>
            <div className="text-center text-gray-400 text-sm my-4">
              {date}
            </div>
  
            {messages.map((msg) => {
              // Ensure deletedFor is an array
              const deletedFor = Array.isArray(msg.deletedFor) ? msg.deletedFor : [];
  
              // Check if the message is deleted for the current user
              return !deletedFor.includes(currentUserId) ? (
                <div
                  key={msg.id}
                  id={`message-${msg.id}`}
                  className={`flex ${msg.senderId === currentUserId ? "justify-end" : "justify-start"} mb-2 relative ${
                    // Updated condition: Apply light green background only when the other user replies to you
                    msg.replyTo && msg.senderId !== currentUserId && msg.replyTo.senderId === currentUserId
                      ? "bg-green-100/15"
                      : ""
                  }`}
                >
                  {/* Message Content */}
                  <div
                    className={`relative md:max-w-[30%] max-w-[58%] px-2 py-1 rounded-lg ${msg.senderId === currentUserId ? "bg-blue-600 text-white" : "bg-gray-700 text-white"
                      } ${searchResults[currentSearchIndex]?.id === msg.id ? "border-4 border-yellow-400" : ""
                      }`}
                    style={{ wordWrap: "break-word", whiteSpace: "normal" }}
                  >
                    {/* Reply Context */}
                    {msg.replyTo && (
                      <div
                        className="bg-gray-200 p-2 rounded-lg mb-1 cursor-pointer hover:bg-gray-300"
                        onClick={() => {
                          // Find the referenced message element
                          const referencedMessage = document.getElementById(`message-${msg.replyTo.messageId}`);
                          if (referencedMessage) {
                            // Scroll to the referenced message
                            referencedMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  
                            // Temporarily apply a light yellow background with transition
                            referencedMessage.style.transition = "background-color 0.5s ease-in-out"; // Smooth transition for background color
                            referencedMessage.style.backgroundColor = "rgba(255, 255, 0, 0.3)"; // Light yellow background
  
                            // Remove the highlight after 5 seconds
                            setTimeout(() => {
                              referencedMessage.style.backgroundColor = ""; // Reset background color
                            }, 4000); // Highlight lasts for 5 seconds
                          }
                        }}
                      >
                        <p className="text-[12px] text-gray-600">{msg.replyTo.senderId === currentUserId ? "You" : userData.displayName}</p>
                        <p className="text-sm text-gray-800">{msg.replyTo.text}</p>
                      </div>
                    )}
  
                    {/* Message Text */}
                    {msg.text && (
                      <p>
                        {highlightSearchResult(msg.text)}
                        {msg.edited && <span className="text-xs text-gray-400 ml-2">(edited)</span>}
                      </p>
                    )}
  
                    {/* Audio Message */}
                    {msg.audioUrl && (
                      <audio className="max-w-48 md:max-w-72" controls>
                        <source src={msg.audioUrl} type="audio/wav" />
                      </audio>
                    )}
  
                    {/* Image Message */}
                    {msg.fileUrl && msg.fileType === "image" && (
                      <img
                        src={msg.fileUrl}
                        alt="Sent image"
                        className="md:max-w-52 max-w-44 h-auto rounded-lg"
                        onClick={() => openMediaModal(msg.fileUrl, "image")}
                      />
                    )}
  
                    {/* Video Message */}
                    {msg.fileUrl && msg.fileType === "video" && (
                      <video controls className="md:max-w-52 max-w-44 h-auto rounded-lg" onClick={() => openMediaModal(msg.fileUrl, "video")}>
                        <source src={msg.fileUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    )}
  
                    {/* Audio File */}
                    {msg.fileUrl && msg.fileType === "audio" && (
                      <audio className="max-w-52 md:max-w-72" controls>
                        <source src={msg.fileUrl} type="audio/wav" />
                      </audio>
                    )}
  
                    {/* Timestamp */}
                    <div className="text-[10px] text-gray-300 mt-1">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
  
                  {/* Three Dots Menu */}
                  <div
                    className={`absolute ${msg.senderId === currentUserId ? "left-[calc(100%)]" : "right-[calc(100%)]"
                      } top-0`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent event bubbling
                        setOpenMenuId(openMenuId === msg.id ? null : msg.id); // Toggle menu
                      }}
                      className="text-gray-400 hover:text-white transition-all duration-150 ease-in-out"
                    >
                      <FaEllipsisV className="w-4" />
                    </button>
  
                    {openMenuId === msg.id && (
                      <div
                        className={`absolute z-20 mt-2 w-48 bottom-1 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 transition-all ease-in-out duration-200 message-menu 
                        ${msg.senderId === currentUserId ? "right-10" : "left-10"}`}
                      >
                        <div className="py-1">
                          {msg.senderId === currentUserId ? (
                            <>
                              {/* Edit Button */}
                              {((new Date() - msg.timestamp.toDate()) / (1000 * 60)) <= 10 && (
                                <button
                                  onClick={() => handleEditMessage(msg.id, msg.text)}
                                  className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMessage(msg.id, "forMe")}
                                className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Delete for Me
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg.id, "forEveryone")}
                                className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Delete for Everyone
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleDeleteMessage(msg.id, "forMe")}
                              className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                            >
                              Delete for Me
                            </button>
                          )}
                          {/* Add Reply Button */}
                          <button
                            onClick={() => handleReplyMessage(msg)}
                            className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <></>
              );
            })}
          </div>
        ))}
        <div ref={messageEndRef}></div>
      </div>
  
      {/* Modal for Enlarged Media */}
      {selectedMedia && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
          <div className="relative">
            {/* Close Button */}
            <button
              onClick={closeMediaModal}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
  
            {/* Media Content */}
            {selectedMedia.type === "image" && (
              <img
                src={selectedMedia.url}
                alt="Enlarged media"
                className="max-w-[90vw] max-h-[90vh] rounded-lg"
              />
            )}
            {selectedMedia.type === "video" && (
              <video
                controls
                autoPlay
                className="max-w-[90vw] max-h-[90vh] rounded-lg"
              >
                <source src={selectedMedia.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
      )}
  
      {/* Message Input */}
      {!isBlocked && !isBlockedByUser && (
        <form
          className="p-4 bg-[#111] border-t border-gray-700"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          {/* Reply Preview */}
          {replyingTo && (
            <div className="bg-gray-700 p-2 rounded-lg mb-2">
              <p className="text-sm text-gray-400">Replying to {replyingTo.senderId === currentUserId ? "yourself" : userData.displayName}</p>
              <p className="text-sm text-white">{replyingTo.text}</p>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          )}
  
          <div className="flex items-center relative">
            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute left-2 text-gray-400 hover:text-white"
            >
              {showEmojiPicker ? (
                <FaKeyboard className="text-lg relative left-1" />
              ) : (
                <FaSmile className="text-lg relative left-1" />
              )}
            </button>
  
            {/* Input Field */}
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault(); // Prevent default behavior (e.g., new line)
                  sendMessage(); // Send the message
                }
              }}
              placeholder="Type a message..."
              className="flex-1 p-2 bg-gray-800 text-white rounded-lg focus:outline-none pr-12 pl-10"
            />
  
            {/* Emoji Picker Dropup */}
            {showEmojiPicker && (
              <div className="absolute bottom-14 left-0">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="dark"
                  previewPosition="none"
                />
              </div>
            )}
  
            {/* Audio and File Icons */}
            {!message.trim() && (
              <div className="absolute right-4 flex space-x-5">
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecordingAndSend}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecordingAndSend}
                  className="text-gray-400 hover:text-white"
                >
                  <FaMicrophone className="text-lg" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="text-gray-400 hover:text-white"
                >
                  <FaLink />
                </button>
              </div>
            )}
  
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*, video/*, audio/*"
              onChange={handleFileChange}
            />
  
            {/* Send Button (only for text messages) */}
            {message.trim() && (
              <button
                type="button"
                onClick={sendMessage} // Call sendMessage directly
                className="ml-3 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <FaPaperPlane className="text-xl" />
              </button>
            )}
          </div>
  
          {/* Hold to Record Message */}
          {showHoldMessage && (
            <div className="absolute bottom-16 right-14 bg-gray-500 p-2 rounded-lg text-white text-sm">
              Hold to record, release to send
            </div>
          )}
        </form>
      )}
    </div>
  );
}