"use client";
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", username: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");

  useEffect(() => {
    document.title = "BeTalkative - Signup";
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Reset errors on user input
    if (name === "username") setUsernameError("");
    if (name === "name") setDisplayNameError("");
    
    setForm({ ...form, [name]: value });
  };

  const isValidUsername = (username) => {
    const regex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!regex.test(username)) {
      return "Username must be 3-30 characters long and can only contain letters, numbers, periods, and underscores.";
    }
    return "";
  };

  const validateDisplayName = (displayName) => {
    const regex = /^[a-zA-Z.]+$/;
    if (!regex.test(displayName)) {
      return "Display Name can only contain letters and dots.";
    }
    if (displayName.length < 1 || displayName.length > 30) {
      return "Display Name must be 1-30 characters long.";
    }
    return "";
  };

  const isUsernameTaken = async (username) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if username is taken
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password, name, username } = form;

    // Username validation
    const usernameError = isValidUsername(username);
    if (usernameError) {
      setUsernameError(usernameError);
      setSuccess("");
      return;
    }

    // Display Name validation
    const displayNameError = validateDisplayName(name);
    if (displayNameError) {
      setDisplayNameError(displayNameError);
      setSuccess("");
      return;
    }

    setLoading(true);
    try {
      const isTaken = await isUsernameTaken(username);
      if (isTaken) {
        setError("Username already exists. Please choose another.");
        setSuccess("");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: username || email.split('@')[0], // Use manual username or email prefix
        displayName: name,
        email: email,
        bio: "",
        profilePic: "",
      });

      await sendEmailVerification(user);
      setSuccess("User registered successfully! Please check your email for verification.");
      setError("");
    } catch (err) {
      setError(err.message);
      setSuccess("");
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
  
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const usernameFromEmail = user.email.split('@')[0];
  
      // Remove spaces from the display name if it exists
      const displayName = user.displayName 
        ? user.displayName.replace(/\s+/g, '') // Remove all spaces
        : "NewUser"; // Fallback if no display name
      
      let username = usernameFromEmail;
      let userDoc = doc(db, "users", user.uid);
      let userSnapshot = await getDoc(userDoc);
  
      let counter = 1;
      while (userSnapshot.exists()) {
        const newUsername = `${usernameFromEmail}${counter}`;
        userDoc = doc(db, "users", user.uid);
        userSnapshot = await getDoc(userDoc);
        counter++;
        if (!userSnapshot.exists()) {
          username = newUsername;
          break;
        }
      }
  
      if (!userSnapshot.exists()) {
        await setDoc(userDoc, {
          uid: user.uid,
          username: username,
          displayName: displayName, // Using the space-free name
          email: user.email,
          bio: "",
          profilePic: user.photoURL || "",
        });
      }
  
      router.push("/");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-gray-50 gap-8">
      <div className="w-full max-w-md p-8 space-y-8 bg-white shadow-lg rounded-lg mx-5">
        <h2 className="text-center text-3xl font-bold text-green-600">Sign Up</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              placeholder="Name"
              style={{ color: 'black' }}
              required
            />
          </div>
          {displayNameError && <p className="text-red-500 text-xs mt-1">{displayNameError}</p>}
          <div>
            <label htmlFor="email" className="text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              placeholder="you@example.com"
              style={{ color: 'black' }}
              required
            />
          </div>
          <div>
            <label htmlFor="username" className="text-gray-700">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              placeholder="Username"
              style={{ color: 'black' }}
              required
            />
          </div>
          {usernameError && <p className="text-red-500 text-xs mt-1">{usernameError}</p>}

          <div className='relative'>
            <label htmlFor="password" className="text-gray-700">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600 pr-10"
              placeholder="Your Password"
              style={{ color: 'black' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-10 text-gray-400 hover:text-gray-200"
            >
              {showPassword ? (
                <img src="/eye.png" className='w-5 relative bottom-1' alt="" />
              ) : (
                <img src="/eyecross.png" className='w-5 relative bottom-1' alt="" />
              )}
            </button>
          </div>
          {error && <p className="text-red-500">{error}</p>}
          {success && <p className="text-green-500">{success}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            disabled={loading} // Disable button when loading
          >
            {loading ? "Signing Up..." : "Sign Up"} {/* Change button text based on loading */}
          </button>
        </form>


        <p className="text-center text-gray-600">
          Already have an account?{" "}
          <a href="/login" className="text-green-600 hover:underline">Login</a>
        </p>

         {/* Social sign in option for smaller screens */}
         <hr className='bg-slate-200 lg:hidden' />
         <div className='text-gray-400 flex justify-center text-center lg:hidden relative bottom-3'>or</div>

         <div className='flex flex-col lg:hidden relative bottom-3'>
          <button onClick={signInWithGoogle} type="button" className="text-white bg-[#4d8ef6] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex justify-center items-center dark:focus:ring-[#4285F4]/55 me-2 mb-2">
            <svg className='w-5 h-5 me-2' xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
            </svg>
            Sign in with Google
          </button>

        </div>
      </div>

      {/* Social sign in option for larger screens */}
      <div className='text-gray-400 lg:inline-block hidden'>or</div>

      <div className='lg:flex flex-col hidden'>
        <button onClick={signInWithGoogle} type="button" className="text-white bg-[#4d8ef6] hover:bg-blue-300 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#4285F4]/55 me-2 mb-2">
          <svg className='w-5 h-5 me-2' xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg>
          Sign in with Google
        </button>
      </div>
    </section>
  );
};

export default Signup;
