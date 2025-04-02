"use client";
import { useEffect, useState } from "react";
import { db, auth } from "../../firebase";
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { FaArrowLeft, FaEllipsisV } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { ClipLoader } from 'react-spinners';

export default function UserProfile() {
  const params = useParams();
  const { userId } = params;
  const [userData, setUserData] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByUser, setIsBlockedByUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setIsLoading(true);

          // Fetch user data
          const userDocRef = doc(db, "users", userId);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data());
          } else {
            console.error("No such user document found!");
            router.push("/inbox");
          }

          // Check block status
          const currentUserId = user.uid;
          const blockRefByCurrent = doc(db, "blockedUsers", `${currentUserId}_${userId}`);
          const blockRefByUser = doc(db, "blockedUsers", `${userId}_${currentUserId}`);

          // Set up real-time listeners for block status
          const unsubscribeBlockByCurrent = onSnapshot(blockRefByCurrent, (doc) => {
            setIsBlocked(doc.exists());
          });

          const unsubscribeBlockByUser = onSnapshot(blockRefByUser, (doc) => {
            setIsBlockedByUser(doc.exists());
          });

          // Cleanup listeners on component unmount
          return () => {
            unsubscribeBlockByCurrent();
            unsubscribeBlockByUser();
          };
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [userId, router]);

  useEffect(() => {
    document.title = "BeTalkative - User Profile";
  }, []);

  const handleBlockUser = async () => {
    const currentUserId = auth.currentUser?.uid;
    const blockRef = doc(db, "blockedUsers", `${currentUserId}_${userId}`);

    try {
      if (isBlocked) {
        await deleteDoc(blockRef);
        console.log("User unblocked successfully!");
      } else {
        await setDoc(blockRef, {
          blockerId: currentUserId,
          blockedId: userId,
          timestamp: new Date().toISOString(),
        });
        console.log("User blocked successfully!");
      }
    } catch (error) {
      console.error("Error blocking/unblocking user:", error);
    } finally {
      setIsDropdownOpen(false);
    }
  };

  if (isLoading || !userData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
      <ClipLoader color="#ffffff" size={50} />
    </div>
    );
  }

  return (
    <>
      <div onClick={() => router.back()} className="absolute top-7 left-10 text-sm hover:cursor-pointer">
        <FaArrowLeft className="text-xl hover:text-gray-400 relative right-2 md:right-0" />
      </div>
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-gray-900 to-black">
        <div className="relative w-[90%] max-w-lg bg-[#111] border border-gray-700 rounded-2xl p-8 shadow-lg">
          {/* Three-Dot Menu */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-gray-400 hover:text-gray-200 focus:outline-none"
            >
              <FaEllipsisV className="text-xl" />
            </button>
            {isDropdownOpen && (
              <div className="absolute z-10 right-0 mt-2 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-lg">
                <button
                  onClick={handleBlockUser}
                  className="block w-full px-4 py-2 text-sm text-red-500 hover:bg-[#333] rounded-lg text-left"
                >
                  {isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
            )}
          </div>

          {/* Profile Picture Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="rounded-full overflow-hidden md:w-[120px] md:h-[120px] w-[90px] h-[90px] border-2 border-gray-500">
                <Image
                  src={userData.profilePic || "/nullPic.png"}
                  alt="Profile"
                  width={120}
                  height={120}
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Username and Display Name */}
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Username Section */}
            <div className="mb-2 w-full">
              <div className="flex items-center justify-center -mt-6">
                <h1 className="text-sm font-bold text-white">{userData.username}</h1>
              </div>
            </div>

            {/* Display Name Section */}
            <div className="mb-6 w-full">
              <div className="flex items-center justify-center -mt-2 mb-2">
                <p className="text-2xl text-gray-400">{userData.displayName}</p>
              </div>
            </div>

            {/* Bio Section */}
            <div className="w-full">
              <div className="flex items-center justify-center ml-3 -mt-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 whitespace-pre-wrap break-words max-w-full">
                    {userData.bio}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Chatting Button */}
        {(!isBlocked && !isBlockedByUser) && (
          <div className="mt-9">
            <Link
              href={`/userChat/${userId}`}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500 hover:from-purple-600 hover:via-blue-600 hover:to-teal-600 text-white font-semibold rounded-lg shadow-lg transform transition duration-300 hover:scale-105"
            >
              Start Chatting
            </Link>
          </div>
        )}
      </div>
    </>
  );
}