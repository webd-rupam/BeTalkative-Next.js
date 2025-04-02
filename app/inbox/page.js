// inbox/page.js
"use client";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  getDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaSearch, FaTimes, FaEllipsisV, FaUsers } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";
import { ClipLoader } from "react-spinners";

export default function Inbox() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]); // All users from the database
  const [filteredUsers, setFilteredUsers] = useState([]); // Filtered users based on search
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [chatUsers, setChatUsers] = useState([]); // Users with whom the current user has chatted
  const [groupChats, setGroupChats] = useState([]); // Groups the current user is part of
  const currentUserId = auth.currentUser?.uid;
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "BeTalkative - Inbox";
  }, []);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Just now"; // Handle null or undefined timestamps
  
    // Convert Firestore Timestamp to JavaScript Date if necessary
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
  
    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };
  // Fetch all users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef);
        const querySnapshot = await getDocs(q);
        const usersList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch users with whom the current user has chatted
  useEffect(() => {
    if (!currentUserId) return;

    const fetchChatUsers = async () => {
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participants", "array-contains", currentUserId));
    
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const chatUsersList = [];
        for (const doc of snapshot.docs) {
          const participants = doc.data().participants;
          const otherUserId = participants.find((id) => id !== currentUserId);
          if (otherUserId) {
            const lastMessage = doc.data().lastMessage;
    
            // Fetch all messages in the chat
            const messagesRef = collection(db, "chats", doc.id, "messages");
            const messagesQuery = query(messagesRef, orderBy("timestamp", "desc"));
            const messagesSnapshot = await getDocs(messagesQuery);
            const messages = messagesSnapshot.docs.map((msgDoc) => ({
              id: msgDoc.id,
              ...msgDoc.data(),
            }));
    
            // Calculate unread messages
            const unreadMessages = messages.filter(
              (msg) =>
                msg.senderId !== currentUserId && // Messages sent by the other user
                !msg.readBy?.includes(currentUserId) // Messages not read by the current user
            ).length;
    
            // Calculate tagged messages (including replies to the current user's messages)
            const taggedMessages = messages.filter(
              (msg) =>
                (msg.taggedUsers?.includes(currentUserId) || // Messages where the current user is tagged
                  msg.replyTo?.senderId === currentUserId) && // Messages that are replies to the current user's messages
                !msg.readBy?.includes(currentUserId) // Messages not read by the current user
            ).length;
    
            chatUsersList.push({
              id: otherUserId,
              lastMessage: lastMessage.text,
              timestamp: lastMessage.timestamp, // Use the Firestore timestamp directly
              unreadCount: unreadMessages, // Normal unread count
              taggedCount: taggedMessages, // Tagged messages count (including replies)
            });
          }
        }
    
        // Fetch user details for each chat user
        const usersWithDetails = chatUsersList.map((chatUser) => {
          const user = users.find((u) => u.id === chatUser.id);
          return {
            ...user,
            lastMessage: chatUser.lastMessage,
            timestamp: chatUser.timestamp, // Use the Firestore timestamp directly
            unreadCount: chatUser.unreadCount, // Normal unread count
            taggedCount: chatUser.taggedCount, // Tagged messages count (including replies)
          };
        });
    
        // Sort the users by timestamp (descending order)
        const sortedChatUsers = usersWithDetails.sort((a, b) => b.timestamp - a.timestamp);
    
        setChatUsers(sortedChatUsers);
      });
    
      return () => unsubscribe();
    };
    fetchChatUsers();
  }, [currentUserId, users]);

  // Fetch group chats the current user is part of
  useEffect(() => {
    if (!currentUserId) return;

    const fetchGroupChats = async () => {
      const groupsRef = collection(db, "groups");
      const q = query(groupsRef, where("members", "array-contains", currentUserId));
    
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const groupChatsList = [];
        for (const groupDoc of snapshot.docs) {
          const groupData = groupDoc.data();
          const lastMessage = groupData.lastMessage || { text: "", timestamp: null, senderId: null };
    
          // Fetch the sender's name for the last message
          let senderName = "";
          if (lastMessage.senderId) {
            const senderDocRef = doc(db, "users", lastMessage.senderId);
            const senderDoc = await getDoc(senderDocRef);
            if (senderDoc.exists()) {
              senderName = senderDoc.data().displayName;
            }
          }
    
          // Use the Firestore timestamp directly
          const timestamp = lastMessage.timestamp;
    
          // Fetch all messages in the group
          const messagesRef = collection(db, "groups", groupDoc.id, "messages");
          const messagesQuery = query(messagesRef, orderBy("timestamp", "desc"));
          const messagesSnapshot = await getDocs(messagesQuery);
          const messages = messagesSnapshot.docs.map((msgDoc) => ({
            id: msgDoc.id,
            ...msgDoc.data(),
          }));
    
          // Calculate unread messages
          const unreadMessages = messages.filter(
            (msg) =>
              msg.senderId !== currentUserId && // Messages sent by other members
              !msg.readBy?.includes(currentUserId) // Messages not read by the current user
          ).length;
    
          // Calculate tagged messages (including replies to the current user's messages)
          const taggedMessages = messages.filter(
            (msg) =>
              (msg.taggedUsers?.includes(currentUserId) || // Messages where the current user is tagged
              msg.replyTo?.senderId === currentUserId) && // Messages that are replies to the current user's messages
              !msg.readBy?.includes(currentUserId) // Messages not read by the current user
          ).length;
    
          groupChatsList.push({
            id: groupDoc.id,
            name: groupData.name,
            profilePic: groupData.profilePic || "/nullPic.png",
            lastMessage: lastMessage.text,
            timestamp: timestamp, // Use the Firestore timestamp directly
            unreadCount: unreadMessages, // Normal unread count
            taggedCount: taggedMessages, // Tagged messages count (including replies)
            isGroup: true,
            lastMessageSender: senderName, // Add sender's name
            lastMessageSenderId: lastMessage.senderId, // Add sender's ID
          });
        }
    
        // Sort the group chats by timestamp (descending order)
        const sortedGroupChats = groupChatsList.sort((a, b) => b.timestamp - a.timestamp);
    
        setGroupChats(sortedGroupChats);
      });
    
      return () => unsubscribe();
    };
    fetchGroupChats();
  }, [currentUserId]);

  // Combine user chats and group chats
  const combinedChats = [...chatUsers, ...groupChats].sort((a, b) => {
    const timestampA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
    const timestampB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);

    return timestampB - timestampA; // Sort by most recent first
  });

  // Debugging: Log the combined chats with timestamps
  console.log("Combined Chats:", combinedChats.map(chat => ({
    id: chat.id,
    name: chat.name || chat.displayName,
    timestamp: chat.timestamp,
    isGroup: chat.isGroup,
  })));




  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === "") {
      setFilteredUsers([]);
      setIsDropdownVisible(false);
      return;
    }

    // Filter users based on the search query (username or name)
    const filtered = users.filter(
      (user) =>
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.displayName.toLowerCase().includes(query.toLowerCase())
    );

    setFilteredUsers(filtered);
    setIsDropdownVisible(true);
  };

  // Clear search input and hide dropdown
  const handleClearSearch = () => {
    setSearchQuery("");
    setFilteredUsers([]);
    setIsDropdownVisible(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".search-container")) {
        setIsDropdownVisible(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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

  // Mark messages as read
  const markMessagesAsRead = async (chatId, isGroup = false) => {
    if (!currentUserId) return;

    const messagesRef = collection(db, isGroup ? "groups" : "chats", chatId, "messages");
    const messagesQuery = query(messagesRef); // Fetch all messages

    const messagesSnapshot = await getDocs(messagesQuery);
    const unreadMessages = messagesSnapshot.docs.filter(
      (msgDoc) => !msgDoc.data().readBy?.includes(currentUserId)
    );

    // Update unread messages
    for (const msgDoc of unreadMessages) {
      const messageRef = doc(db, isGroup ? "groups" : "chats", chatId, "messages", msgDoc.id);
      await updateDoc(messageRef, {
        readBy: arrayUnion(currentUserId),
      });
    }
  };

  // Truncate message
  const truncateMessage = (message, maxChars = 25) => {
    if (!message) return ""; // Handle empty messages
    return message.length > maxChars
      ? `${message.slice(0, maxChars)}...` // Truncate and add ellipsis
      : message; // Return the full message if it's within the limit
  };

  // Handle clear chat
  const handleClearChat = async (chatId, isGroup = false) => {
    try {
      const messagesRef = collection(db, isGroup ? "groups" : "chats", chatId, "messages");
      const messagesQuery = query(messagesRef);
      const messagesSnapshot = await getDocs(messagesQuery);

      // Delete all messages in the chat
      for (const msgDoc of messagesSnapshot.docs) {
        await deleteDoc(doc(db, isGroup ? "groups" : "chats", chatId, "messages", msgDoc.id));
      }

      // Update the 'lastMessage' field in the chat document to blank or null
      const chatRef = doc(db, isGroup ? "groups" : "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: { text: "", timestamp: null },
      });

      // Update the chatUsers or groupChats state to reflect cleared chat
      if (isGroup) {
        setGroupChats((prev) =>
          prev.map((group) =>
            group.id === chatId
              ? { ...group, lastMessage: "", unreadCount: 0 } // Set lastMessage to empty string
              : group
          )
        );
      } else {
        setChatUsers((prev) =>
          prev.map((user) =>
            user.id === chatId
              ? { ...user, lastMessage: "", unreadCount: 0 } // Set lastMessage to empty string
              : user
          )
        );
      }

      console.log("Chat cleared successfully!");
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
  };

  // Handle delete chat
  const handleDeleteChat = async (chatId, isGroup = false) => {
    try {
      // Remove the chat from the inbox
      await deleteDoc(doc(db, isGroup ? "groups" : "chats", chatId));

      // Update the UI
      if (isGroup) {
        setGroupChats((prev) => prev.filter((group) => group.id !== chatId));
      } else {
        setChatUsers((prev) => prev.filter((user) => user.id !== chatId));
      }

      console.log("Chat deleted successfully!");
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // Force a re-render by updating state
      setChatUsers((prev) => [...prev]);
      setGroupChats((prev) => [...prev]);
    }, 60000); // Update every minute
  
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <p className="text-white text-lg">No users found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between md:px-10 px-4 py-3 bg-gray-800">
          <Link href={"/"} className="text-white text-xl hover:text-gray-400">
            <FaArrowLeft />
          </Link>
          <h2 className="md:text-xl text-lg font-bold">Inbox</h2>
          <div className="flex gap-2">
            <Link
              href={"/createGroup"}
              className="text-white text-sm bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              New Group
            </Link>
            <Link
              href={"/profile"}
              className="text-white text-sm bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Profile
            </Link>
          </div>
        </div>
  
        {/* Messages List */}
        <div className="flex-grow overflow-y-auto overflow-x-hidden">
          {/* Search Bar */}
          <div className="flex flex-col items-center md:px-10 px-4 py-5 search-container">
            <div className="relative w-full md:w-1/2">
              <input
                type="text"
                placeholder="Search for friends"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-3 py-2 pl-10 pr-10 rounded-lg bg-gray-700 text-white focus:outline-none"
              />
              {/* Search Icon */}
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              {/* Clear Icon (visible only when searchQuery is not empty) */}
              {searchQuery && (
                <FaTimes
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                  onClick={handleClearSearch}
                />
              )}
            </div>
  
            {/* Dropdown List */}
            {isDropdownVisible && (
              <div className="absolute z-10 mt-12 w-full md:w-1/2 bg-gray-800 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center p-3 hover:bg-gray-700 cursor-pointer"
                      onClick={() => {
                        router.push(`/userProfile/${user.id}`);
                        setIsDropdownVisible(false);
                      }}
                    >
                      {/* Profile Picture */}
                      <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                        <Image
                          src={user.profilePic || "/nullPic.png"}
                          alt="pfp"
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      </div>
  
                      {/* Username and Name */}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-gray-300">{user.displayName}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-400">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
  
          {/* Thin Divider */}
          <hr className="w-full border-t border-gray-600" />
  
          {/* Messages */}
          <ul className="space-y-3 md:p-6 p-2 h-[calc(108vh-200px)] overflow-y-auto">
            {combinedChats.map((chat) => {
              const isGroup = chat.isGroup;
              const chatId = isGroup ? chat.id : [chat.id, currentUserId].sort().join("_");
  
              return (
                <li
                  key={chat.id || `${chat.displayName}-${chat.timestamp}`}
                  className="flex hover:cursor-pointer items-center justify-between p-5 bg-gray-800 rounded-lg hover:bg-gray-700"
                  onClick={async () => {
                    await markMessagesAsRead(chatId, isGroup);
                    router.push(isGroup ? `/groupChat/${chat.id}` : `/userChat/${chat.id}`);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    {/* Profile Picture */}
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      {isGroup ? (
                        <Image
                          src={chat.profilePic || "/grp.ppg"}
                          alt="group-pfp"
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      ) : (
                        <Image
                          src={chat.profilePic || "/nullPic.png"}
                          alt="pfp"
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      )}
                    </div>
  
                    {/* Chat Info */}
                    <div>
                      <p className="text-sm font-semibold">{isGroup ? chat.name : chat.displayName}</p>
                      <p className="text-xs text-gray-400">
                        {isGroup ? (
                          <>
                            <span className="font-bold text-gray-300">
                              {chat.lastMessageSenderId === currentUserId
                                ? "You"
                                : chat.lastMessageSender}
                            </span>
                            : {truncateMessage(chat.lastMessage)}{" "}
                          </>
                        ) : (
                          truncateMessage(chat.lastMessage)
                        )}
                      </p>
                    </div>
                  </div>
  
                  {/* Timestamp and Notifications */}
                  <div className="flex items-center space-x-3">
                    {/* Unread and Tagged Notifications */}
                    <div className="flex items-center space-x-2">
                      {chat.unreadCount > 0 && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                          {chat.unreadCount}
                        </span>
                      )}
                      {chat.taggedCount > 0 && (
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                          {chat.taggedCount}
                        </span>
                      )}
                    </div>
  
                    {/* Timestamp */}
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(chat.timestamp)}
                    </span>
  
                    {/* Three-Dot Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          setOpenMenuId(openMenuId === chat.id ? null : chat.id); // Toggle menu
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        <FaEllipsisV className="w-4" />
                      </button>
  
                      {/* Dropdown Menu */}
                      {openMenuId === chat.id && (
                        <div className="absolute z-20 right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg">
                          <div className="py-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent event bubbling
                                handleClearChat(chatId, isGroup);
                                setOpenMenuId(null); // Close the menu
                              }}
                              className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 text-left"
                            >
                              Clear Chat
                            </button>
                            {/* Conditionally render "Delete Chat" button */}
                            {!isGroup && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent event bubbling
                                  handleDeleteChat(chatId, isGroup);
                                  setOpenMenuId(null); // Close the menu
                                }}
                                className="block w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 text-left"
                              >
                                Delete Chat
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}