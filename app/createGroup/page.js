"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaCheck, FaUser, FaImage } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { ClipLoader } from "react-spinners";
import ImageCropper from "@/components/ImageCropper"; // Ensure this component exists

export default function CreateGroup() {
  const router = useRouter();
  const [users, setUsers] = useState([]); // All users from the database
  const [selectedUsers, setSelectedUsers] = useState([]); // Users selected for the group
  const [groupName, setGroupName] = useState(""); // Group name
  const [groupProfilePic, setGroupProfilePic] = useState(null); // Group profile picture
  const [isLoading, setIsLoading] = useState(true); // Loading state for fetching users
  const [isCreatingGroup, setIsCreatingGroup] = useState(false); // Loading state for creating group
  const [isUploadingImage, setIsUploadingImage] = useState(false); // Loading state for image upload
  const [isCropping, setIsCropping] = useState(false); // Whether the cropping modal is open
  const [croppedImage, setCroppedImage] = useState(null); // Cropped image data URL
  const [imageToCrop, setImageToCrop] = useState(null); // Image to be cropped
  const currentUserId = auth.currentUser?.uid;

  // Fetch all users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUserId) return; // Ensure currentUserId is defined

      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "!=", currentUserId)); // Exclude the current user
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
  }, [currentUserId]); // Add currentUserId to the dependency array

  useEffect(() => {
    document.title = "BeTalkative - Create Group";
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

  // Handle user selection
  const handleUserSelect = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId)); // Deselect user
    } else {
      setSelectedUsers([...selectedUsers, userId]); // Select user
    }
  };

  // Handle file selection for profile picture
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
        setImageToCrop(imageDataUrl); // Set the image source for cropping
        setIsCropping(true); // Open the cropping modal
      } else {
        console.error("Failed to read file.");
      }
    }
  };

  // Read file as data URL
  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Handle cropped image
  const handleCropComplete = async (croppedImage) => {
    setCroppedImage(croppedImage); // Save the cropped image
    setIsCropping(false); // Close the cropping modal
    await uploadImageToCloudinary(croppedImage); // Upload the cropped image
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (file) => {
    setIsUploadingImage(true); // Show loading state for image upload

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "BetalkativeFiles"); // Replace with your Cloudinary upload preset

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dfnjq4nmv/upload", // Replace with your Cloudinary cloud name
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();
      const downloadURL = data.secure_url; // Get the uploaded image URL from Cloudinary
      setGroupProfilePic(downloadURL); // Update the state
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
    } finally {
      setIsUploadingImage(false); // Hide loading state for image upload
    }
  };

  // Create the group
  const handleCreateGroup = async () => {
    if (!groupName || selectedUsers.length === 0) {
      alert("Please provide a group name and select at least one member.");
      return;
    }

    setIsCreatingGroup(true); // Show loading state

    try {
      // Wait for the profile picture upload to complete (if in progress)
      if (isUploadingImage) {
        await new Promise((resolve) => {
          const interval = setInterval(() => {
            if (!isUploadingImage) {
              clearInterval(interval);
              resolve();
            }
          }, 100); // Check every 100ms
        });
      }

      // Add the group to Firestore
      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        profilePic: groupProfilePic || "/grp.png", // Use the uploaded image or default
        members: [currentUserId, ...selectedUsers], // Include the current user
        admins: [currentUserId], // Set the current user as the only admin (in an array)
        createdBy: currentUserId, // Track the group creator
        createdAt: new Date(),
      });

      console.log("Group created successfully!");
      router.push(`/groupChat/${groupRef.id}`); // Redirect to the group chat
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setIsCreatingGroup(false); // Hide loading state
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <ClipLoader color="#ffffff" size={50} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between md:px-10 px-4 py-3 bg-gray-800">
        <Link href={"/inbox"} className="text-white text-xl hover:text-gray-400">
          <FaArrowLeft />
        </Link>
        <h2 className="md:text-xl text-lg font-bold">Create Group</h2>
        <div></div>
      </div>

      {/* Profile Picture and Group Name Section */}
      <div className="p-4 flex items-center space-x-4">
        {/* Profile Picture Upload Circle */}
        <div className="relative w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {groupProfilePic ? (
            <img
              src={groupProfilePic}
              alt="Group Profile"
              className="object-cover w-full h-full"
            />
          ) : (
            <FaImage className="text-gray-400 text-2xl" />
          )}
          {isUploadingImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <ClipLoader color="#ffffff" size={20} />
            </div>
          )}
        </div>

        {/* Group Name Input */}
        <input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white focus:outline-none"
        />
      </div>

      {/* Members List */}
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Select Members</h3>
        <ul className="space-y-3">
          {users.map((user) => (
            <li
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
            </li>
          ))}
        </ul>
      </div>

      {/* Create Group Button */}
      <div className="p-4">
        <button
          onClick={handleCreateGroup}
          disabled={isCreatingGroup || !groupName || selectedUsers.length === 0}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isCreatingGroup ? (
            <ClipLoader color="#ffffff" size={20} />
          ) : (
            "Create Group"
          )}
        </button>
      </div>

      {/* Cropping Modal */}
      {isCropping && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onClose={() => setIsCropping(false)}
        />
      )}
    </div>
  );
}