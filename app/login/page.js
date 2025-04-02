"use client";
import React, { useState } from 'react';
import { useEffect } from 'react';
import { auth, db } from '../firebase';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

const Login = () => {
  const [form, setForm] = useState({ email: "", password: ""});
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [loading, setLoading] = useState(false); // New loading state
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.title = "BeTalkative - Login";
  }, [])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Set loading to true
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      router.push('/'); // Redirect after successful login
    } catch (err) {
      setError(err.message); // Set error message if login fails
    } finally {
      setLoading(false); // Reset loading state after processing
    }
  };

  const handlePasswordReset = async () => {
    const auth = getAuth();
    try {
      await sendPasswordResetEmail(auth, form.email);
      setResetMessage("Password reset email sent! Please check your email.");
      setError("");
    } catch (err) {
      setError("Unable to send reset email. Make sure the email is correct.");
      setResetMessage("");
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      // Check if user exists in Firestore
      const userDoc = doc(db, "users", user.uid);
      const userSnapshot = await getDoc(userDoc);
      
      if (!userSnapshot.exists()) {
        // Create default username from email
        const emailPrefix = user.email.split('@')[0];
        
        // Remove spaces and special characters from display name
        const cleanDisplayName = user.displayName 
          ? user.displayName.replace(/\s+/g, '') // Remove all spaces
            .replace(/[^a-zA-Z.]/g, '') // Remove special characters (keep only letters and dots)
          : "User"; // Fallback if no display name
        
        await setDoc(userDoc, {
          uid: user.uid,
          username: emailPrefix,
          displayName: cleanDisplayName,
          email: user.email,
          bio: "",
          profilePic: user.photoURL || "", // Use Google photo if available
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
        <h2 className="text-center text-3xl font-bold text-green-600">Login</h2>
        {error && <p className="text-red-500 text-center">{error}</p>}
        {resetMessage && <p className="text-green-500 text-center">{resetMessage}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="text-gray-800">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600"
              style={{ color: 'black' }}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className='relative'>
            <label htmlFor="password" className="text-gray-800">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-600 pr-10"
              style={{ color: 'black' }}
              placeholder="Your Password"
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
          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            disabled={loading} // Disable button when loading
          >
            {loading ? "Logging In..." : "Login"} {/* Change button text based on loading */}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className="text-center">
          <button
            onClick={handlePasswordReset}
            className="text-sm text-green-600 hover:underline"
            disabled={loading} // Disable button when loading
          >
            Forgot Password?
          </button>
        </div>

        <p className="text-center text-gray-600">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-green-600 hover:underline">Sign up</a>
        </p>

        {/* Social sign in option for smaller screens */}
        <hr className='bg-slate-200 lg:hidden' />
        <div className='text-gray-400 flex justify-center text-center lg:hidden relative bottom-3'>or</div>

        <div className='flex flex-col lg:hidden relative bottom-3'>
          <button onClick={signInWithGoogle} type="button" className="text-white bg-[#4d8ef6] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex justify-center items-center dark:focus:ring-[#4285F4]/55 me-2 mb-2" disabled={loading}>
          <svg className='w-5 h-5 me-2' xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
<path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
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
<path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
</svg>
    Sign in with Google
  </button>

</div>
    </section>
  );
};

export default Login;
