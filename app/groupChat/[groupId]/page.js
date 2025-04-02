"use client";
import { useEffect, useState, useRef } from "react";
import { db, auth, storage } from "../../firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, updateDoc, arrayUnion, deleteDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaPaperPlane, FaMicrophone, FaSmile, FaKeyboard, FaLink, FaEllipsisV, FaSearch, FaChevronUp, FaChevronDown, FaTimes } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { io } from "socket.io-client";
import { ClipLoader } from 'react-spinners';


export default function GroupChat() {
  const params = useParams();
  const { groupId } = params;
  const [groupData, setGroupData] = useState(null);
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
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [membersData, setMembersData] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);

  // Tagging feature states
  const [isTagging, setIsTagging] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);

  // Search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [currentuserId, setCurrentUserId] = useState(null);

  // Handle search input change
  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value === "") {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
    } else {
      // Search messages
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

  // Highlight search results in messages
  const highlightSearchResult = (text, taggedUsers) => {
    if (!text) return text;
  
    const words = text.split(" ");
    const result = [];
    let currentTag = "";
  
    words.forEach((word, index) => {
      if (word.startsWith("@")) {
        currentTag = word;
      } else if (currentTag) {
        currentTag += " " + word;
      } else {
        result.push(<span key={index}>{word} </span>);
      }
  
      if (currentTag && (index === words.length - 1 || !words[index + 1]?.startsWith("@"))) {
        const username = currentTag.slice(1).trim(); // Trim whitespace
        const taggedUser = membersData.find((member) =>
          member.displayName.toLowerCase() === username.toLowerCase() // Case-insensitive compare
        );
  
        if (taggedUser) {
          result.push(
            <Link
              key={index}
              href={taggedUser.id === currentUserId ? "/profile" : `/userProfile/${taggedUser.id}`}
              className="font-bold text-blue-400 hover:text-blue-600"
            >
              {currentTag}{" "}
            </Link>
          );
        } else {
          result.push(<span key={index}>{currentTag} </span>);
        }
  
        currentTag = "";
      }
    });
  
    return result;
  };
  
  // Render search bar
  const renderSearchBar = () => (
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
        <button
          onClick={() => {
            setShowSearchBar(false);
            setSearchQuery("");
            setSearchResults([]);
            setCurrentSearchIndex(-1);
          }}
          className="ml-2 p-2 text-gray-400 hover:text-white"
        >
          <FaTimes className="text-xl" />
        </button>
      </div>
    </div>
  );

  // Render header with search icon in the right corner
  const renderHeader = () => {
    // Calculate the number of tagged messages for the current user
    const taggedMessageCount = messages.filter(
      (msg) =>
        (msg.taggedUsers?.includes(currentUserId) || // Messages where the current user is tagged
          msg.replyTo?.senderId === currentUserId) && // Messages that are replies to the current user's messages
        !msg.readBy?.includes(currentUserId) // Messages not read by the current user
    ).length;
  
    return (
      <div className="flex sticky z-10 top-0 items-center p-4 bg-[#111] border-b border-gray-700">
        {/* Back Button and Group Info */}
        <div className="flex items-center flex-1">
          <button
            onClick={() => router.push("/inbox")}
            className="mr-3 p-2 text-gray-400 hover:text-white"
          >
            <FaArrowLeft className="text-xl relative right-2 md:right-0" />
          </button>
  
          <Link href={`/groupProfile/${groupId}`}>
            <div className="flex items-center">
              {/* Constrain the image container */}
              <div className="w-10 h-10 flex-shrink-0">
                <Image
                  src={groupData.profilePic || "/nullPic.png"}
                  alt={groupData.name}
                  width={40}
                  height={40}
                  className="object-cover rounded-full w-full h-full"
                />
              </div>
              <div className="ml-2">
                <span className="text-white font-semibold">{groupData.name}</span>
                <div className="text-xs text-gray-400">
                  {membersData
                    .slice(0, 3)
                    .map((member, index) => (
                      <span key={member.id}>
                        {member.id === currentUserId ? "You" : member.displayName}
                        {index < Math.min(2, membersData.length - 1) ? ", " : ""}
                      </span>
                    ))}
                  {membersData.length > 3 && <span className="text-gray-400">, ...</span>}
                </div>
              </div>
            </div>
          </Link>
        </div>
  
        {/* Tagged Message Notification */}
        {taggedMessageCount > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
              {taggedMessageCount}
            </span>
          </div>
        )}
  
        {/* Search Icon (Aligned to the Right) */}
        <button
          onClick={() => setShowSearchBar(!showSearchBar)}
          className="p-2 text-gray-400 hover:text-white"
        >
          <FaSearch className="text-xl" />
        </button>
      </div>
    );
  };
  // Handle input change for tagging
  const handleInputChange = (e) => {
    const text = e.target.value;
    setMessage(text);
  
    if (text.endsWith("@")) {
      setIsTagging(true);
      setFilteredMembers(membersData); // Show all members initially
    } else if (isTagging) {
      const searchTerm = text.split("@").pop().toLowerCase();
      const filtered = membersData.filter((member) =>
        member.displayName.toLowerCase().includes(searchTerm)
      );
      setFilteredMembers(filtered);
    } else {
      setIsTagging(false);
    }
  };

  // Handle member selection from the dropdown
  const handleMemberSelect = (member) => {
    const text = message.split("@").slice(0, -1).join("@"); // Remove the "@" part
    setMessage(`${text}@${member.displayName} `); // Add the selected member's name
    setIsTagging(false);
    setTaggedUsers((prev) => [...prev, member.id]); // Add to tagged users list
  };

  useEffect(() => {
    document.title = "BeTalkative - Group Chat";
  }, []);


useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentUserId(user.uid); // Set currentUserId in state
    } else {
      setCurrentUserId(null); // Clear currentUserId if user is signed out
      router.push("/login"); // Redirect to login page
    }
  });

  return () => unsubscribeAuth(); // Cleanup on unmount
}, [router]);

  // Fetch group data and member details in real-time
  useEffect(() => {
    const docRef = doc(db, "groups", groupId);

    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupData(data);

        // Fetch member details
        const members = data.members || [];
        const memberDetails = await Promise.all(
          members.map(async (memberId) => {
            const userDoc = await getDoc(doc(db, "users", memberId));
            if (userDoc.exists()) {
              return { id: memberId, ...userDoc.data() };
            } else {
              return { id: memberId, name: "Unknown User", profilePic: "/nullPic.png" };
            }
          })
        );

        setMembersData(memberDetails);
      } else {
        console.error("No such group document found!");
        router.push("/inbox");
      }
    });

    return () => unsubscribe();
  }, [groupId, router]);

  // Fetch group messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const messagesRef = collection(db, "groups", groupId, "messages");
        const q = query(messagesRef, orderBy("timestamp", "asc"));
  
        const unsubscribe = onSnapshot(q, async (snapshot) => {
          const messagesList = await Promise.all(
            snapshot.docs.map(async (messageDoc) => {
              const messageData = messageDoc.data();
              const userDoc = await getDoc(doc(db, "users", messageData.senderId));
              const senderName = userDoc.data()?.displayName || "Unknown User";
              const senderProfilePic = userDoc.data()?.profilePic || "/nullPic.png";
              return {
                id: messageDoc.id,
                ...messageData,
                senderName,
                senderProfilePic,
              };
            })
          );
  
          // Mark tagged and replied messages as read
          const messagesToMarkAsRead = messagesList.filter(
            (msg) =>
              (msg.taggedUsers?.includes(currentUserId) || // Messages where the current user is tagged
              msg.replyTo?.senderId === currentUserId) && // Messages that are replies to the current user's messages
              !msg.readBy?.includes(currentUserId) // Messages not read by the current user
          );
  
         // In the messages fetching useEffect, modify the messagesToMarkAsRead section:
if (messagesToMarkAsRead.length > 0 && currentUserId) {  // Add currentUserId check
  const batch = writeBatch(db);
  messagesToMarkAsRead.forEach((msg) => {
    const messageRef = doc(db, "groups", groupId, "messages", msg.id);
    batch.update(messageRef, {
      readBy: arrayUnion(currentUserId),
    });
  });
  await batch.commit();
}
          setMessages(messagesList);
        });
  
        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };
  
    if (groupId) {
      fetchMessages();
    }
  }, [groupId, currentUserId]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]); // This effect runs whenever `messages` changes


  useEffect(() => {
    // This effect handles scrolling to the bottom when messages change
    const scrollToBottom = () => {
      if (messageEndRef.current) {
        // Use setTimeout to ensure the DOM has updated
        setTimeout(() => {
          messageEndRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }, 100);
      }
    };
  
    scrollToBottom();
  
    // Optional: Add a listener for new messages if needed
  }, [messages, groupId]); // Add any other dependencies that should trigger scroll

  useEffect(() => {
    // This effect handles the initial scroll when the component mounts
    if (messageEndRef.current) {
      // Small delay to ensure all elements are rendered
      setTimeout(() => {
        messageEndRef.current.scrollIntoView({
          behavior: "auto", // Use 'auto' for initial load
          block: "end",
        });
      }, 300);
    }
  }, []); // Empty dependency array means this runs once on mount`

  useEffect(() => {
    if (!membersData.length) return;
  
    const unsubscribes = membersData.map(member => {
      const userRef = doc(db, "users", member.id);
      return onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setMembersData(prev => prev.map(m => 
            m.id === member.id ? {...m, ...doc.data()} : m
          ));
        }
      });
    });
  
    return () => unsubscribes.forEach(unsub => unsub());
  }, [membersData]);

  // Send group message
  const sendMessage = async () => {
    if (message.trim() === "") return;
  
    try {
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const senderName = userDoc.data()?.displayName || "Unknown User";
      const senderProfilePic = userDoc.data()?.profilePic || "/nullPic.png";
  
      // Extract mentions with user IDs
      const mentions = [];
      const words = message.split(' ');
      for (const word of words) {
        if (word.startsWith('@')) {
          const username = word.slice(1);
          const user = membersData.find(m => 
            m.displayName.toLowerCase() === username.toLowerCase()
          );
          if (user) {
            mentions.push({
              username,
              userId: user.id
            });
          }
        }
      }
  
      // Include taggedUsers from the replied message
      const repliedToTaggedUsers = replyingTo?.taggedUsers || [];
  
      const messagesRef = collection(db, "groups", groupId, "messages");
      const messageData = {
        text: message,
        senderId: currentUserId,
        senderName,
        senderProfilePic,
        timestamp: serverTimestamp(),
        replyTo: replyingTo
          ? {
              messageId: replyingTo.id,
              senderId: replyingTo.senderId,
              senderName: replyingTo.senderName,
              text: replyingTo.text,
            }
          : null,
        mentions: mentions.length > 0 ? mentions : null, // Add mentions data
        taggedUsers: [...taggedUsers, ...repliedToTaggedUsers],
      };
  
      await addDoc(messagesRef, messageData);
  
      // Update the group's last message
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        lastMessage: {
          text: message,
          senderId: currentUserId,
          senderName,
          senderProfilePic,
          timestamp: serverTimestamp(),
        },
      });
  
      if (socket) {
        socket.emit("sendGroupMessage", {
          groupId,
          userId: currentUserId,
          message: {
            text: message,
            senderId: currentUserId,
            senderName,
            senderProfilePic,
            replyTo: messageData.replyTo,
            taggedUsers: messageData.taggedUsers,
            mentions: messageData.mentions, // Include mentions in socket emission
          },
        });
      }
  
      setMessage("");
      setTaggedUsers([]);
      setReplyingTo(null);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

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

      setTimeout(() => {
        setShowHoldMessage(false);
      }, 2000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  // Stop recording audio and send the message
  const stopRecordingAndSend = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowHoldMessage(false);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(audioBlob);
        audioChunksRef.current = [];

        const audioUrl = await uploadAudioToCloudinary(audioBlob);

        const messagesRef = collection(db, "groups", groupId, "messages");
        const messageData = {
          senderId: currentUserId,
          timestamp: serverTimestamp(),
          audioUrl: audioUrl,
        };

        await addDoc(messagesRef, messageData);

        if (socket) {
          socket.emit("sendGroupMessage", {
            groupId,
            userId: currentUserId,
            message: { senderId: currentUserId, audioUrl: audioUrl },
          });
        }

        setAudioBlob(null);
      };
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

  // Handle file upload
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
  
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) { // 10MB in bytes
      alert("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }
  
    // Proceed with upload if file is under size limit
    const fileUrl = await uploadFileToCloudinary(file);
  
    const messagesRef = collection(db, "groups", groupId, "messages");
    const messageData = {
      senderId: currentUserId,
      timestamp: serverTimestamp(),
      fileUrl: fileUrl,
      fileType: file.type.split("/")[0],
    };
  
    await addDoc(messagesRef, messageData);
  
    if (socket) {
      socket.emit("sendGroupMessage", {
        groupId,
        userId: currentUserId,
        message: { senderId: currentUserId, fileUrl: fileUrl, fileType: file.type.split("/")[0] },
      });
    }
  };
  
  // Upload file to Cloudinary
  const uploadFileToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "BetalkativeFiles");

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
      console.error("Error uploading file to Cloudinary:", error);
      return null;
    }
  };

  // Open media modal
  const openMediaModal = (mediaUrl, mediaType) => {
    setSelectedMedia({ url: mediaUrl, type: mediaType });
  };

  // Close media modal
  const closeMediaModal = () => {
    setSelectedMedia(null);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
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

  // Handle delete message
  const handleDeleteMessage = async (messageId, deleteType) => {
    const messageRef = doc(db, "groups", groupId, "messages", messageId);

    try {
      if (deleteType === "forMe") {
        await updateDoc(messageRef, {
          deletedFor: arrayUnion(currentUserId),
        });
      } else if (deleteType === "forEveryone") {
        await deleteDoc(messageRef);
      }

      if (socket) {
        socket.emit("deleteGroupMessage", {
          groupId,
          messageId,
          deleteType,
          userId: currentUserId,
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Handle edit message
  const handleEditMessage = async (messageId, currentText) => {
    const newText = prompt("Edit your message:", currentText);
    if (newText === null || newText.trim() === "") return;

    const messageRef = doc(db, "groups", groupId, "messages", messageId);

    try {
      await updateDoc(messageRef, {
        text: newText,
        edited: true,
      });

      if (socket) {
        socket.emit("editGroupMessage", {
          groupId,
          messageId,
          newText,
        });
      }
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleReplyMessage = (message) => {
    setReplyingTo(message);
    setShowEmojiPicker(false); // Close emoji picker if open
  };

  const processMessageText = (text, mentions = []) => {
    if (!text) return text;
    if (!mentions || mentions.length === 0) return text;
  
    const elements = [];
    let remainingText = text;
    
    mentions.forEach((mention) => {
      const mentionText = `@${mention.username}`;
      const index = remainingText.indexOf(mentionText);
      
      if (index !== -1) {
        // Add text before mention
        if (index > 0) {
          elements.push(remainingText.substring(0, index));
        }
        
        // Find current display name
        const user = membersData.find(m => m.id === mention.userId);
        const displayName = user?.displayName || mention.username;
        
        // Add mention as a link
        elements.push(
          <Link
            key={`${mention.userId}-${index}`}
            href={mention.userId === currentUserId ? "/profile" : `/userProfile/${mention.userId}`}
            className="font-bold text-blue-400 hover:text-blue-600"
          >
            @{displayName}
          </Link>
        );
        
        // Update remaining text
        remainingText = remainingText.substring(index + mentionText.length);
      }
    });
    
    // Add any remaining text
    if (remainingText) {
      elements.push(remainingText);
    }
    
    return elements.length > 0 ? elements : text;
  };

  if (!groupData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  // Check if the current user is a member of the group
  const isMember = groupData.members.includes(currentUserId);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-black overflow-x-hidden">
      {renderHeader()}

      {showSearchBar && renderSearchBar()}

      {/* Group Chat Messages */}
      {isMember ? (
        <div className="flex-1 p-4 overflow-y-auto">
          {Object.entries(groupedMessages).map(([date, messages]) => (
            <div key={date}>
              <div className="text-center text-gray-400 text-sm my-4">
                {date}
              </div>

              {messages.map((msg) => {
  const deletedFor = Array.isArray(msg.deletedFor) ? msg.deletedFor : [];
  const isTagged =
    msg.taggedUsers?.includes(currentUserId) || // Messages where the current user is tagged
    msg.replyTo?.senderId === currentUserId; // Messages that are replies to the current user's messages
  return !deletedFor.includes(currentUserId) ? (
    <div
      key={msg.id}
      id={`message-${msg.id}`}
      className={`flex ${msg.senderId === currentUserId ? "justify-end" : "justify-start"} mb-2 relative ${isTagged ? "bg-green-100/15" : ""
        }`}
    >
                    {/* Profile Picture */}
                    {msg.senderId !== currentUserId && (
                      <Link href={`/userProfile/${msg.senderId}`} className="flex-shrink-0 mr-2">
                        <Image
                          src={msg.senderProfilePic || "/nullPic.png"}
                          alt="Sender's profile"
                          width={30}
                          height={30}
                          className="rounded-full"
                        />
                      </Link>
                    )}

                    {/* Message Container */}
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
                            const referencedMessage = document.getElementById(`message-${msg.replyTo.messageId}`);
                            if (referencedMessage) {
                              referencedMessage.scrollIntoView({ behavior: "smooth", block: "center" });
                              referencedMessage.style.transition = "background-color 0.5s ease-in-out";
                              referencedMessage.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
                              setTimeout(() => {
                                referencedMessage.style.backgroundColor = "";
                              }, 4000);
                            }
                          }}
                        >
                          <p className="text-[12px] text-gray-600">
                            {msg.replyTo.senderId === currentUserId ? "You" : msg.replyTo.senderName}
                          </p>
                          <p className="text-sm text-gray-800">{msg.replyTo.text}</p>
                        </div>
                      )}

                      {/* Sender's Name */}
                      {msg.senderId !== currentUserId && (
                        <div className="text-xs text-gray-300 font-semibold mb-1">
                          {msg.senderName}
                        </div>
                      )}

                      {/* Message Content */}
                     {msg.text && (
  <p>
    {processMessageText(msg.text, msg.mentions)}
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
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === msg.id ? null : msg.id);
                        }}
                        className="text-gray-400 hover:text-white transition-all duration-150 ease-in-out"
                      >
                        <FaEllipsisV className="w-4" />
                      </button>

                     {/* Inside the message menu section */}
{openMenuId === msg.id && (
  <div
    className={`fixed z-20 mt-1 w-48 top-10 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 transition-all ease-in-out duration-200 message-menu 
      ${msg.senderId === currentUserId ? "right-10" : "left-10"}`}
  >
    <div className="py-1 relative z-20">
      {/* Edit Button (only for sender's own messages within 10 minutes) */}
      {msg.senderId === currentUserId && 
        ((new Date() - msg.timestamp.toDate()) / (1000 * 60)) <= 10 && (
        <button
          onClick={() => {
            handleEditMessage(msg.id, msg.text);
            setOpenMenuId(null);
          }}
          className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
        >
          Edit
        </button>
      )}
      
      {/* Delete for Me (always shown) */}
      <button
        onClick={() => {
          handleDeleteMessage(msg.id, "forMe");
          setOpenMenuId(null);
        }}
        className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
      >
        Delete for Me
      </button>
      
      {/* Delete for Everyone (shown for sender or admin) */}
      {(msg.senderId === currentUserId || groupData.admins?.includes(currentUserId)) && (
        <button
          onClick={() => {
            handleDeleteMessage(msg.id, "forEveryone");
            setOpenMenuId(null);
          }}
          className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
        >
          Delete for Everyone
        </button>
      )}
      
      {/* Reply Button */}
      <button
        onClick={() => {
          handleReplyMessage(msg);
          setOpenMenuId(null);
        }}
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
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-lg">Only members can chat here.</p>
        </div>
      )}

      {/* Modal for Enlarged Media */}
      {selectedMedia && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
          <div className="relative">
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
      {isMember && (
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
              <p className="text-sm text-gray-400">
                Replying to {replyingTo.senderId === currentUserId ? "yourself" : replyingTo.senderName}
              </p>
              <p className="text-sm text-white">{replyingTo.text}</p>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Tagging Dropdown */}
          {isTagging && (
            <div className="absolute bottom-16 left-4 bg-gray-800 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 w-64">
              {/* Dropdown Header with Close Button */}
              <div className="flex justify-between items-center p-2 border-b border-gray-700">
                <span className="text-sm text-gray-300">Tag Members</span>
                <button
                  onClick={() => setIsTagging(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <FaTimes className="text-sm" />
                </button>
              </div>

              {/* Search Bar Inside Dropdown */}
              <input
                type="text"
                placeholder="Search members..."
                className="w-full p-2 bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
                onChange={(e) => {
                  const searchTerm = e.target.value.toLowerCase();
                  const filtered = membersData.filter((member) =>
                    member.displayName.toLowerCase().includes(searchTerm)
                  );
                  setFilteredMembers(filtered);
                }}
              />

              {/* Member List */}
              <div className="max-h-32 overflow-y-auto">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => handleMemberSelect(member)}
                    className={`p-2 hover:bg-gray-700 cursor-pointer ${taggedUsers.includes(member.id) ? "bg-green-100/15" : ""
                      }`}
                  >
                    <div className="flex items-center">
                      <Image
                        src={member.profilePic || "/nullPic.png"}
                        alt={member.displayName}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                      <span className="ml-2 text-sm text-white">
                        {member.displayName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center relative">
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

            <input
              type="text"
              value={message}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 p-2 bg-gray-800 text-white rounded-lg focus:outline-none pr-12 pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault(); // Prevent default behavior (e.g., new line)
                  sendMessage(); // Send the message
                }
              }}
            />

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

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*, video/*, audio/*"
              onChange={handleFileChange}
            />

            {message.trim() && (
              <button
                type="button"
                onClick={sendMessage}
                className="ml-3 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <FaPaperPlane className="text-xl" />
              </button>
            )}
          </div>

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