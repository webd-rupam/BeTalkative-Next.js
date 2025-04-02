"use client";
import { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { FaCog, FaEdit, FaCheck } from "react-icons/fa";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { ClipLoader } from "react-spinners";
import ImageCropper from "@/components/ImageCropper";

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState({
    username: false,
    displayName: false,
    bio: false,
    profilePic: false,
  });
  const [updatedData, setUpdatedData] = useState({
    username: "",
    displayName: "",
    bio: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  const [bioError, setBioError] = useState("");
  const router = useRouter();
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [croppedImage, setCroppedImage] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.title = "BeTalkative - Profile";
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setUpdatedData(docSnap.data());
        } else {
          console.error("No such user document found!");
        }

        const fetchBlockedUsers = async () => {
          const currentUserId = user.uid;
          if (!currentUserId) return;

          const blockedUsersRef = collection(db, "blockedUsers");
          const q = query(blockedUsersRef, where("blockerId", "==", currentUserId));
          const querySnapshot = await getDocs(q);

          const blockedUsersData = [];
          for (const blockedUserDoc of querySnapshot.docs) {
            const blockedUserId = blockedUserDoc.data().blockedId;
            const userDocRef = doc(db, "users", blockedUserId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              blockedUsersData.push({ id: blockedUserId, ...userDoc.data() });
            }
          }

          setBlockedUsers(blockedUsersData);
        };

        fetchBlockedUsers();
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Validate Username
  const validateUsername = (username) => {
    const regex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!regex.test(username)) {
      return "Username must be 3-30 characters long and can only contain letters, numbers, periods, and underscores.";
    }
    return "";
  };

  // Validate Display Name
 // Validate Display Name
const validateDisplayName = (displayName) => {
  const regex = /^[a-zA-Z.]+$/; // Allow letters and dots only (removed \s to disallow spaces)
  if (!regex.test(displayName)) {
    return "Display Name can only contain letters and dots (no spaces).";
  }
  if (displayName.length < 1 || displayName.length > 30) {
    return "Display Name must be 1-30 characters long.";
  }
  return "";
};

  // Check if Username Already Exists
  const checkUsernameExists = async (username) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
  
    // Update the state without validation
    setUpdatedData((prev) => ({ ...prev, [name]: value }));
  
    // Clear any existing errors when the user starts typing
    if (name === "username") {
      setUsernameError("");
    } else if (name === "displayName") {
      setDisplayNameError("");
    } else if (name === "bio") {
      setBioError("");
    }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10 MB.");
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file.");
        return;
      }

      const imageDataUrl = await readFile(file);
      if (imageDataUrl) {
        setSelectedImagePreview(imageDataUrl);
        setImageToCrop(imageDataUrl);
        setIsCropping(true);
      } else {
        console.error("Failed to read file.");
      }
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

  const handleCropComplete = async (croppedImage) => {
    setCroppedImage(croppedImage);
    setIsCropping(false);
    setSelectedImagePreview(croppedImage); // Set the cropped image as the preview
  };

  const handleSave = async (field) => {
    if (!userData) return;
  
    try {
      setIsUploading(true);
  
      // Validate the field before saving
      if (field === "username") {
        const error = validateUsername(updatedData.username);
        if (error) {
          setUsernameError(error);
          return; // Stop saving if validation fails
        }
  
        const exists = await checkUsernameExists(updatedData.username);
        if (exists && updatedData.username !== userData.username) {
          setUsernameError("This username is already taken.");
          return; // Stop saving if username is taken
        } else {
          setUsernameError("");
        }
      } else if (field === "displayName") {
        const error = validateDisplayName(updatedData.displayName);
        if (error) {
          setDisplayNameError(error);
          return; // Stop saving if validation fails
        } else {
          setDisplayNameError("");
        }
      } else if (field === "bio") {
        if (updatedData.bio.length > 60) {
          setBioError("Bio cannot exceed 60 characters.");
          return; // Stop saving if bio is too long
        } else {
          setBioError("");
        }
      }
  
      // If validation passes, proceed with saving
      let profilePicUrl = userData.profilePic;
  
      if (croppedImage && field === "profilePic") {
        profilePicUrl = await uploadImageToCloudinary(croppedImage);
      }
  
      const docRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(docRef, {
        [field]: field === "profilePic" ? profilePicUrl : updatedData[field],
      });
  
      setUserData((prev) => ({
        ...prev,
        [field]: field === "profilePic" ? profilePicUrl : updatedData[field],
      }));
  
      setIsEditing((prev) => ({ ...prev, [field]: false }));
      setCroppedImage(null);
      setSelectedImagePreview(null);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsUploading(false);
    }
  };
  const uploadImageToCloudinary = async (file) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "profilePicture");

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfnjq4nmv/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      return userData.profilePic;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = (field) => {
    setUpdatedData((prev) => ({
      ...prev,
      [field]: userData[field],
    }));

    setIsEditing((prev) => ({ ...prev, [field]: false }));
    setSelectedImagePreview(null);
    setCroppedImage(null);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const handleUnblockUser = async (blockedUserId) => {
    const currentUserId = auth.currentUser?.uid;
    const blockRef = doc(db, "blockedUsers", `${currentUserId}_${blockedUserId}`);

    try {
      await deleteDoc(blockRef);
      setBlockedUsers((prev) => prev.filter((user) => user.id !== blockedUserId));
      console.log("User unblocked successfully!");
    } catch (error) {
      console.error("Error unblocking user:", error);
    }
  };

  const toggleBlockedUsersList = () => {
    setShowBlockedUsers(!showBlockedUsers);
    setDropdownVisible(false);
  };

  if (!userData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  return (
    <>
      <div onClick={() => router.back()} className="absolute top-7 left-10 text-sm">
        <FaArrowLeft className="text-xl hover:text-gray-400 relative right-2 md:right-0 hover:cursor-pointer" />
      </div>
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <div className="relative w-[90%] max-w-lg bg-[#111] border border-gray-700 rounded-2xl p-8 shadow-lg">
          {/* Settings Icon */}
          <div className="relative">
            <FaCog
              className="absolute right-3 text-white text-xl cursor-pointer hover:text-green-600"
              onClick={toggleDropdown}
            />

            {/* Dropdown Menu */}
            {dropdownVisible && (
              <div className="absolute z-10 top-10 right-4 bg-gray-600 text-white rounded-lg shadow-lg p-2">
                <button
                  onClick={toggleBlockedUsersList}
                  className="w-full px-3 py-2 text-left hover:bg-gray-500 rounded-lg"
                >
                  Blocked Users
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left bg-red-600 hover:bg-red-700 rounded-lg mt-2"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>

          {/* Blocked Users List */}
          {showBlockedUsers && (
            <div className="fixed z-10 inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-[#111] border border-gray-700 rounded-lg p-6 w-[90%] max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Blocked Users</h2>
                {blockedUsers.length > 0 ? (
                  <ul className="space-y-3">
                    {blockedUsers.map((user) => (
                      <li key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Image
                            src={user.profilePic || "/nullPic.png"}
                            alt="Profile"
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                          <span className="ml-3 text-white">{user.displayName}</span>
                        </div>
                        <button
                          onClick={() => handleUnblockUser(user.id)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                        >
                          Unblock
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">No blocked users.</p>
                )}
                <button
                  onClick={toggleBlockedUsersList}
                  className="mt-4 w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="rounded-full overflow-hidden md:w-[120px] md:h-[120px] w-[90px] h-[90px] border-2 border-gray-500">
                {selectedImagePreview || croppedImage ? (
                  <img
                    src={selectedImagePreview || croppedImage}
                    alt="Profile Preview"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Image
                    src={userData.profilePic || "/nullPic.png"}
                    alt="Profile"
                    width={120}
                    height={120}
                    className="object-cover"
                  />
                )}
              </div>
              <FaEdit
                className="absolute top-[66px] md:top-[86px] right-0 w-5 h-5 md:w-6 md:h-6 cursor-pointer text-gray-400 hover:text-white"
                onClick={() => {
                  setIsEditing((prev) => ({ ...prev, profilePic: true }));
                  fileInputRef.current.click();
                }}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePicChange}
                className="hidden"
              />
            </div>
            {isEditing.profilePic && (
              <div className="flex items-center mt-4">
                <button
                  className="ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded-lg"
                  onClick={() => handleSave("profilePic")}
                >
                  Save
                </button>
                <button
                  className="ml-2 px-3 py-1 bg-gray-600 text-white text-xs rounded-lg"
                  onClick={() => handleCancel("profilePic")}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Username Section */}
          <div className="mb-2 w-full">
            {isEditing.username ? (
              <div className="flex flex-col w-full">
                <div className="flex items-center">
                  <input
                    type="text"
                    name="username"
                    value={updatedData.username}
                    onChange={handleInputChange}
                    className="bg-gray-800 text-white p-2 rounded-lg w-full"
                    placeholder="Username"
                  />
                  <button
                    className="ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded-lg"
                    onClick={() => handleSave("username")}
                  >
                    Save
                  </button>
                  <button
                    className="ml-2 px-3 py-1 bg-gray-600 text-white text-xs rounded-lg"
                    onClick={() => handleCancel("username")}
                  >
                    Cancel
                  </button>
                </div>
                {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-center -mt-5 mb-5 ml-3">
                <h1 className="text-sm font-bold text-white">{userData.username}</h1>
                <FaEdit
                  className="ml-2 cursor-pointer text-gray-400 hover:text-white"
                  onClick={() => setIsEditing((prev) => ({ ...prev, username: true }))}
                />
              </div>
            )}
          </div>

          {/* Display Name Section */}
          <div className="mb-6 w-full">
            {isEditing.displayName ? (
              <div className="flex flex-col w-full">
                <div className="flex items-center">
                  <input
                    type="text"
                    name="displayName"
                    value={updatedData.displayName}
                    onChange={handleInputChange}
                    className="bg-gray-800 text-white p-2 rounded-lg w-full"
                    placeholder="Display Name"
                  />
                  <button
                    className="ml-2 px-3 py-1 bg-green-600 text-white text-xs rounded-lg"
                    onClick={() => handleSave("displayName")}
                  >
                    Save
                  </button>
                  <button
                    className="ml-2 px-3 py-1 bg-gray-600 text-white text-xs rounded-lg"
                    onClick={() => handleCancel("displayName")}
                  >
                    Cancel
                  </button>
                </div>
                {displayNameError && <p className="text-red-500 text-xs mt-1">{displayNameError}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-center ml-3 -mt-2 mb-2">
                <p className="text-2xl text-gray-400">{userData.displayName}</p>
                <FaEdit
                  className="ml-2 cursor-pointer text-gray-400 hover:text-white"
                  onClick={() => setIsEditing((prev) => ({ ...prev, displayName: true }))}
                />
              </div>
            )}
          </div>

          {/* Bio Section */}
          <div className="w-full">
            {isEditing.bio ? (
              <div className="flex flex-col items-center w-full">
                <textarea
                  name="bio"
                  value={updatedData.bio}
                  onChange={handleInputChange}
                  className="bg-gray-800 text-white p-2 rounded-lg w-full h-32 resize-none"
                  placeholder="Write something about yourself"
                />
                {bioError && <p className="text-red-500 text-xs mt-1">{bioError}</p>}
                <button
                  className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded-lg"
                  onClick={() => handleSave("bio")}
                >
                  Save
                </button>
                <button
                  className="mt-2 px-3 py-1 bg-gray-600 text-white text-xs rounded-lg"
                  onClick={() => handleCancel("bio")}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center ml-3 -mt-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 whitespace-pre-wrap break-words max-w-full">
                    {userData.bio || "Add your bio..."}
                  </p>
                </div>
                <FaEdit
                  className="ml-2 cursor-pointer text-gray-400 hover:text-white flex-shrink-0"
                  onClick={() => setIsEditing((prev) => ({ ...prev, bio: true }))}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cropping Modal */}
      {isCropping && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setIsCropping(false)}
        />
      )}
    </>
  );
}