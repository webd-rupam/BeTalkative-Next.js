"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeft, FaEllipsisV, FaEdit, FaSave, FaCrown, FaTimes, FaPlus, FaCheck, FaBell, FaCog } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { ClipLoader } from "react-spinners";
import Cropper from "react-easy-crop";
import ImageCropper from "@/components/ImageCropper"

export default function GroupProfile() {
  const params = useParams();
  const { groupId } = params;
  const [groupData, setGroupData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profilePic, setProfilePic] = useState("/nullPic.png");
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]); // All users from the database
  const [selectedUsers, setSelectedUsers] = useState([]); // Users selected to add to the group
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false); // Notifications modal state
  const [joinRequests, setJoinRequests] = useState([]); // Join requests for the group
  const [showDeleteOption, setShowDeleteOption] = useState(false); // Delete group option visibility
  const [searchQuery, setSearchQuery] = useState(""); // Search query for members
  const [isSaving, setIsSaving] = useState(false); // Track saving state
  const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
const [newAdminId, setNewAdminId] = useState(null);
const [isCropping, setIsCropping] = useState(false); // Whether the cropping modal is open
const [croppedImage, setCroppedImage] = useState(null); // Cropped image data URL
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid;

  // Character limits
  const MAX_NAME_LENGTH = 20;
  const MAX_DESCRIPTION_LENGTH = 150;

  // Fetch group data and member details
  const fetchGroupData = async () => {
    try {
      setIsLoading(true);
      const docRef = doc(db, "groups", groupId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupData(data);
        setName(data.name);
        setDescription(data.description || "");
        setProfilePic(data.profilePic || "/nullPic.png");

        // Fetch member details
        const members = data.members || [];
        const memberDetails = await Promise.all(
          members.map(async (memberId) => {
            const userDocRef = doc(db, "users", memberId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              return { id: memberId, ...userDocSnap.data() };
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
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all users from Firestore (excluding current group members)
  const fetchAllUsers = async () => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "not-in", groupData.members || [])); // Exclude current group members
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Real-time listener for join requests
  useEffect(() => {
    const groupRef = doc(db, "groups", groupId);

    const unsubscribe = onSnapshot(groupRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const requests = data.joinRequests || [];

        // Fetch user details for each join request
        const userDetails = await Promise.all(
          requests.map(async (userId) => {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              return { id: userId, ...userDocSnap.data() };
            } else {
              return { id: userId, displayName: "Unknown User", profilePic: "/nullPic.png" };
            }
          })
        );

        setJoinRequests(userDetails);
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    document.title = "BeTalkative - Group Profile";
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

  // Open the add member modal
  const openAddMemberModal = async () => {
    await fetchAllUsers(); // Fetch all users when the modal is opened
    setIsAddMemberModalOpen(true);
  };

  // Close the add member modal
  const closeAddMemberModal = () => {
    setIsAddMemberModalOpen(false);
    setSelectedUsers([]); // Reset selected users
  };

  // Handle user selection in the modal
  const handleUserSelect = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId)); // Deselect user
    } else {
      setSelectedUsers([...selectedUsers, userId]); // Select user
    }
  };

  // Add selected users to the group
  const addMembersToGroup = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one member to add.");
      return;
    }

    try {
      const docRef = doc(db, "groups", groupId);
      const updatedMembers = [...groupData.members, ...selectedUsers];
      await updateDoc(docRef, {
        members: updatedMembers,
      });

      console.log("Members added successfully!");
      closeAddMemberModal(); // Close the modal
      fetchGroupData(); // Refresh the group data
    } catch (error) {
      console.error("Error adding members to the group:", error);
    }
  };

  // Handle join group request
  const handleJoinGroup = async () => {
    try {
      const docRef = doc(db, "groups", groupId);
      await updateDoc(docRef, {
        joinRequests: arrayUnion(currentUserId),
      });
      alert("Join request sent to admins.");
    } catch (error) {
      console.error("Error sending join request:", error);
    }
  };

  // Handle approval or denial of join requests
  const handleJoinRequest = async (userId, action) => {
    try {
      const docRef = doc(db, "groups", groupId);
      if (action === "approve") {
        await updateDoc(docRef, {
          members: arrayUnion(userId),
          joinRequests: arrayRemove(userId),
        });
      } else if (action === "deny") {
        await updateDoc(docRef, {
          joinRequests: arrayRemove(userId),
        });
      }
      fetchGroupData(); // Refresh group data
    } catch (error) {
      console.error("Error handling join request:", error);
    }
  };

  // Set up real-time listener for group data
  useEffect(() => {
    const docRef = doc(db, "groups", groupId);

    // Set loading state to true when starting to fetch data
    setIsLoading(true);

    // Listen for real-time updates
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Only update state if the data has changed
        if (JSON.stringify(groupData) !== JSON.stringify(data)) {
          setGroupData(data);
          setName(data.name);
          setDescription(data.description || "");
          setProfilePic(data.profilePic || "/nullPic.png");

          // Fetch member details only if members have changed
          const members = data.members || [];
          const fetchMemberDetails = async () => {
            const memberDetails = await Promise.all(
              members.map(async (memberId) => {
                const userDocRef = doc(db, "users", memberId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  return { id: memberId, ...userDocSnap.data() };
                } else {
                  return { id: memberId, name: "Unknown User", profilePic: "/nullPic.png" };
                }
              })
            );

            // Only update membersData if the member details have changed
            if (JSON.stringify(membersData) !== JSON.stringify(memberDetails)) {
              setMembersData(memberDetails);
            }
          };

          fetchMemberDetails();
        }
      } else {
        console.error("No such group document found!");
        router.push("/inbox");
      }

      // Set loading state to false after data is fetched
      setIsLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [groupId, router, groupData, membersData]);

  // Handle file upload for profile picture
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (e.g., 10 MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10 MB.");
        return;
      }
  
      // Validate file type (e.g., only images)
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
      }
  
      const imageDataUrl = await readFile(file); // Convert file to data URL
      if (imageDataUrl) {
        setProfilePic(imageDataUrl); // Set the image source for cropping
        setIsCropping(true); // Open the cropping modal
      } else {
        console.error("Failed to read file.");
      }
    }
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "BetalkativeFiles");
  
    // Log the file and FormData for debugging
    console.log("File:", file);
    for (let [key, value] of formData.entries()) {
      console.log(key, value);
    }
  
    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfnjq4nmv/upload",
        {
          method: "POST",
          body: formData,
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json(); // Log the error response from Cloudinary
        console.error("Cloudinary error response:", errorData);
        throw new Error("Failed to upload image to Cloudinary");
      }
  
      const data = await response.json();
      console.log("Cloudinary response:", data);
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      return null;
    }
  };

  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Save changes to group profile
  const saveChanges = async () => {
    try {
      setIsSaving(true); // Start saving
  
      const docRef = doc(db, "groups", groupId);
  
      // Validate that the name is not empty
      if (!name || name.trim() === "") {
        throw new Error("Group name cannot be empty");
      }
  
      let profilePicUrl = groupData.profilePic || "/nullPic.png"; // Use existing profile picture by default
  
      // Upload new profile picture if a file is selected
      if (croppedImage) {
        try {
          const uploadedUrl = await uploadImageToCloudinary(croppedImage);
          if (uploadedUrl) {
            profilePicUrl = uploadedUrl;
          } else {
            console.error("Failed to upload image. Keeping the existing profile picture.");
          }
        } catch (error) {
          console.error("Error uploading image to Cloudinary:", error);
          alert("Failed to upload image. Please try again.");
          return; // Stop further execution if upload fails
        }
      }
  
      // Prepare the update object
      const updateData = {
        name: name.trim(), // Ensure name is trimmed
        description: description.trim(), // Allow empty description
        profilePic: profilePicUrl, // Use the new or existing profile picture
      };
  
      console.log("Updating Firestore with:", updateData);
  
      // Update Firestore
      await updateDoc(docRef, updateData);
  
      // Clear the file state
      setFile(null);
      setCroppedImage(null);
  
      // Exit editing mode
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating group profile:", error);
      alert(error.message); // Show error message to the user
    } finally {
      setIsSaving(false); // Stop saving
    }
  };
  
  // Handle name input change
  const handleNameChange = (e) => {
    if (e.target.value.length <= MAX_NAME_LENGTH) {
      setName(e.target.value);
    }
  };

  // Handle description input change
  const handleDescriptionChange = (e) => {
    if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
      setDescription(e.target.value);
    }
  };

  // Cancel editing and reset fields
  const cancelEditing = () => {
    setName(groupData.name);
    setDescription(groupData.description || "");
    setProfilePic(groupData.profilePic || "/nullPic.png");
    setFile(null);
    setIsEditing(false);
  };

  // Make a member admin
  const makeAdmin = async (memberId) => {
    try {
      const docRef = doc(db, "groups", groupId);
      const updatedAdmins = [...(groupData.admins || []), memberId];
      await updateDoc(docRef, {
        admins: updatedAdmins,
      });
    } catch (error) {
      console.error("Error making member admin:", error);
    }
  };

  // Remove admin status
  const removeAdmin = async (memberId) => {
    try {
      const docRef = doc(db, "groups", groupId);
      const updatedAdmins = (groupData.admins || []).filter((id) => id !== memberId);
      await updateDoc(docRef, {
        admins: updatedAdmins,
      });
    } catch (error) {
      console.error("Error removing admin status:", error);
    }
  };

  // Kick a member from the group
  const kickMember = async (memberId) => {
    try {
      const docRef = doc(db, "groups", groupId);
      const updatedMembers = groupData.members.filter((id) => id !== memberId);
      const updatedAdmins = (groupData.admins || []).filter((id) => id !== memberId);
      await updateDoc(docRef, {
        members: updatedMembers,
        admins: updatedAdmins,
      });
    } catch (error) {
      console.error("Error kicking member:", error);
    }
  };

  // Leave the group
  const leaveGroup = async () => {
    try {
      const docRef = doc(db, "groups", groupId);
  
      // Check if the current user is the only admin
      const admins = groupData.admins || [];
      if (admins.length === 1 && admins.includes(currentUserId)) {
        setIsAssignAdminModalOpen(true); // Open the modal to assign a new admin
        return;
      }
  
      // If not the only admin, proceed to leave the group
      await updateDoc(docRef, {
        members: arrayRemove(currentUserId), // Remove the current user from the members array
        admins: arrayRemove(currentUserId), // Also remove them from the admins array if they are an admin
      });
      alert("You have left the group.");
      router.push("/inbox"); // Redirect to the inbox or another page after leaving
    } catch (error) {
      console.error("Error leaving the group:", error);
    }
  };

  // Delete the group
  const deleteGroup = async () => {
    if (window.confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      try {
        const docRef = doc(db, "groups", groupId);
        await deleteDoc(docRef); // Delete the group document
        alert("Group deleted successfully.");
        router.push("/inbox"); // Redirect to the inbox page
      } catch (error) {
        console.error("Error deleting group:", error);
      }
    }
  };

  // Filter members based on search query
  const filteredMembers = membersData.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.displayName.toLowerCase().includes(searchLower) ||
      (member.username && member.username.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading || !groupData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  // Check if the current user is an admin
  const isAdmin = (groupData.admins || []).includes(currentUserId);

  // Check if the current user is a member
  const isMember = groupData.members.includes(currentUserId);

 return (
  <>
    {/* Back Button */}
    <div onClick={() => router.back()} className="absolute top-5 left-10 text-sm hover:cursor-pointer">
      <FaArrowLeft className="text-xl hover:text-gray-400 relative right-2 md:right-0" />
    </div>

    {/* Notifications Icon (Only for admins) */}
    {isAdmin && (
      <button
        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
        className="absolute top-7 right-10 text-sm"
      >
        <FaBell className="text-xl relative bottom-2 hover:text-gray-400" />
        {joinRequests.length > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1">
            {joinRequests.length}
          </span>
        )}
      </button>
    )}

    {/* Notifications Modal */}
    {isNotificationsOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-[90%] max-w-md">
          <h3 className="text-white text-lg font-semibold mb-4">Join Requests</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {joinRequests.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
              >
                <Link href={`/userProfile/${user.id}`} className="flex items-center space-x-3 flex-1">
                  <Image
                    src={user.profilePic || "/nullPic.png"}
                    alt="User"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <p className="text-sm font-medium">{user.displayName}</p>
                </Link>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleJoinRequest(user.id, "approve")}
                    className="px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleJoinRequest(user.id, "deny")}
                    className="px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setIsNotificationsOpen(false)}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    )}

    {/* Main Container */}
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="relative top-5 w-[90%] max-w-lg bg-[#111] border border-gray-700 rounded-2xl p-8 shadow-lg">
        {/* Gear Icon (Only for the group creator) */}
        {groupData.createdBy === currentUserId && (
          <div className="absolute top-4 left-4">
            <div className="relative">
              <button
                onClick={() => setShowDeleteOption(!showDeleteOption)}
                className="text-gray-400 hover:text-gray-200 focus:outline-none"
              >
                <FaCog className="text-xl m-2" />
              </button>
              {/* Delete Group Option */}
              {showDeleteOption && (
                <div className="absolute left-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={deleteGroup}
                    className="w-full text-left p-2 text-sm text-white hover:bg-gray-600 rounded-lg"
                  >
                    Delete Group
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Three-Dot Menu (Only show if the user is admin) */}
        {isAdmin && (
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            {isEditing && (
              <button
                onClick={cancelEditing}
                className="text-gray-400 hover:text-gray-200 focus:outline-none"
              >
                <FaTimes className="text-xl relative right-4" />
              </button>
            )}
            <button
              onClick={() => {
                if (isEditing) {
                  saveChanges();
                }
                setIsEditing(!isEditing);
              }}
              className="text-gray-400 hover:text-gray-200 focus:outline-none"
              disabled={isSaving} // Disable the button while saving
            >
              {isSaving ? (
                <ClipLoader color="#ffffff" size={20} /> // Show spinner while saving
              ) : isEditing ? (
                <FaSave className="text-xl m-2" />
              ) : (
                <FaEdit className="text-xl m-2" />
              )}
            </button>
          </div>
        )}

        {/* Profile Picture Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="rounded-full overflow-hidden md:w-[120px] md:h-[120px] w-[90px] h-[90px] border-2 border-gray-500">
              <Image
                src={profilePic}
                alt="Group Profile"
                width={120}
                height={120}
                className="object-cover"
              />
            </div>
            {isEditing && (
              <label
                htmlFor="profilePic"
                className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer"
                style={{ opacity: isSaving ? 0.5 : 1 }} // Reduce opacity while saving
              >
                <FaEdit className="text-white" />
                <input
                  type="file"
                  id="profilePic"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  disabled={isSaving} // Disable input while saving
                />
              </label>
            )}
          </div>
        </div>

        {/* Group Name Section */}
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="mb-2 w-full">
            <div className="flex items-center justify-center -mt-6">
              {isEditing ? (
                <div className="flex flex-col items-center">
                  <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    className="text-2xl font-bold text-white bg-transparent border-b border-gray-700 focus:outline-none text-center"
                    placeholder="Group Name"
                    required
                    disabled={isSaving} // Disable input while saving
                  />
                  <span className="text-xs text-gray-500 mt-1">
                    {name.length}/{MAX_NAME_LENGTH}
                  </span>
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-white">{name}</h1>
              )}
            </div>
          </div>

          {/* Group Description Section */}
          <div className="w-full">
            <div className="flex items-center justify-center ml-3 -mt-2">
              {isEditing ? (
                <div className="flex flex-col items-center w-full">
                  <textarea
                    value={description}
                    onChange={handleDescriptionChange}
                    className="w-full p-2 bg-gray-800 text-white rounded-lg focus:outline-none text-center resize-none"
                    placeholder="Add a description..."
                    disabled={isSaving} // Disable input while saving
                  />
                  <span className="text-xs text-gray-500 mt-1">
                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 whitespace-pre-wrap break-words max-w-full">
                  {description || ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold mb-2 md:mb-0">Members</h3>
            {/* Show search bar and FaPlus icon only for members */}
            {isMember && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-48 p-2 bg-gray-800 text-white rounded-lg focus:outline-none"
                />
                {isAdmin && (
                  <button
                    onClick={openAddMemberModal}
                    className="text-gray-400 hover:text-gray-200 focus:outline-none"
                  >
                    <FaPlus className="text-xl" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filteredMembers.map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200 group"
              >
                <Link
                  href={member.id === currentUserId ? "/profile" : `/userProfile/${member.id}`}
                  className="flex items-center flex-1"
                >
                  <Image
                    src={member.profilePic || "/nullPic.png"}
                    alt="Member"
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                  <span className="text-white ml-2 text-sm">
                    {member.id === currentUserId ? (
                      <span className="font-bold text-green-500">You</span>
                    ) : (
                      member.displayName
                    )}
                  </span>
                  {(groupData.admins || []).includes(member.id) && (
                    <FaCrown className="text-yellow-500 ml-2" title="Admin" />
                  )}
                </Link>
                {isAdmin &&
                  member.id !== currentUserId &&
                  member.id !== groupData.createdBy &&
                  !(groupData.admins || []).includes(member.id) && (
                    <div className="relative">
                      <button
                        onClick={() => setSelectedMemberId(member.id === selectedMemberId ? null : member.id)}
                        className="text-gray-400 hover:text-gray-200 focus:outline-none"
                      >
                        <FaEllipsisV className="text-xl" />
                      </button>
                      {selectedMemberId === member.id && (
                        <div className="absolute right-0 w-48 bg-gray-700 rounded-lg shadow-lg z-10">
                          <div className="p-2">
                            {(groupData.admins || []).includes(member.id) ? (
                              <button
                                onClick={() => removeAdmin(member.id)}
                                className="w-full text-left p-2 text-sm text-white hover:bg-gray-600 rounded-lg"
                              >
                                Remove as Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => makeAdmin(member.id)}
                                className="w-full text-left p-2 text-sm text-white hover:bg-gray-600 rounded-lg"
                              >
                                Make as Admin
                              </button>
                            )}
                            <button
                              onClick={() => kickMember(member.id)}
                              className="w-full text-left p-2 text-sm text-white hover:bg-gray-600 rounded-lg"
                            >
                              Kick
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* Join Group Button (for non-members) */}
        {!isMember ? (
          <div className="mt-8">
            <button
              onClick={handleJoinGroup}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Join Group
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <button
              onClick={leaveGroup}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Leave Group
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Add Member Modal */}
    {isAddMemberModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-[90%] max-w-md">
          <h3 className="text-white text-lg font-semibold mb-4">Add Members</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {allUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer"
                onClick={() => handleUserSelect(user.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <Image
                      src={user.profilePic || "/nullPic.png"}
                      alt="pfp"
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                </div>
                {selectedUsers.includes(user.id) && (
                  <FaCheck className="text-green-500" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <button
              onClick={closeAddMemberModal}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={addMembersToGroup}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Members
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Assign Admin Modal */}
    {isAssignAdminModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-6 w-[90%] max-w-md">
          <h3 className="text-white text-lg font-semibold mb-4">Assign New Admin</h3>
          <p className="text-sm text-gray-400 mb-4">
            You are the only admin. Please assign another admin before leaving the group.
          </p>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {membersData
              .filter((member) => member.id !== currentUserId) // Exclude the current user
              .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer"
                  onClick={() => setNewAdminId(member.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Image
                      src={member.profilePic || "/nullPic.png"}
                      alt="pfp"
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <p className="text-sm font-medium">{member.displayName}</p>
                  </div>
                  {newAdminId === member.id && <FaCheck className="text-green-500" />}
                </div>
              ))}
          </div>
          <div className="mt-6 flex justify-end space-x-4">
            <button
              onClick={() => setIsAssignAdminModalOpen(false)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!newAdminId) {
                  alert("Please select a new admin.");
                  return;
                }

                try {
                  const docRef = doc(db, "groups", groupId);
                  await updateDoc(docRef, {
                    admins: arrayUnion(newAdminId), // Add the new admin
                  });

                  // Now the current user can leave the group
                  await updateDoc(docRef, {
                    members: arrayRemove(currentUserId),
                    admins: arrayRemove(currentUserId),
                  });

                  alert("You have left the group.");
                  router.push("/inbox");
                } catch (error) {
                  console.error("Error assigning new admin or leaving the group:", error);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Assign and Leave
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Cropping Modal */}
    {isCropping && (
      <ImageCropper
        imageSrc={profilePic}
        onCropComplete={(croppedImage) => {
          setCroppedImage(croppedImage); // Save the cropped image
          setProfilePic(croppedImage); // Update the profile picture preview
          setIsCropping(false); // Close the cropping modal
        }}
        onClose={() => setIsCropping(false)} // Close the cropping modal
      />
    )}
  </>
);
}