"use client";
import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import Footer from "@/components/Footer";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const headingRef = useRef(null);
  const descRef = useRef(null);
  const buttonRef = useRef(null);


  useEffect(() => {
    document.title = "BeTalkative - Stay Connected Forever";
  }, [])


  useEffect(() => {
    // GSAP animation for the heading
    gsap.fromTo(
      headingRef.current,
      { x: -200, opacity: 0 }, // Starting position (off-screen to the left)
      { x: 0, opacity: 1, duration: 1, ease: "power3.out" } // End position
    );
  }, []);

  useEffect(() => {
    // GSAP animation for the heading
    gsap.fromTo(
      descRef.current,
      { y: 80, opacity: 0 }, // Starting position (off-screen to the left)
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" } // End position
    );
  }, []);

  useEffect(() => {
    // GSAP animation for the heading with a delay
    gsap.fromTo(
      buttonRef.current,
      { y: 30, opacity: 0 }, // Starting position (off-screen to the left)
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.out",
        delay: 0.8, // Add a delay of 0.5 seconds (adjust as needed)
      }
    );
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <>
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 min-h-screen text-white">
      {/* Navbar */}
      <header className="w-full bg-transparent py-4 relative md:top-5 top-1 px-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="md:text-xl text-lg flex font-semibold">
            <Image src="/favicon.png" alt="logo" width={30} height={30} />
            <span className="text-pink-500 ml-1">Be</span>Talkative
          </Link>
          {/* Navigation Links */}
          <nav className="space-x-9 hidden md:flex text-sm">
            <Link
              href="/"
              className="text-white hover:text-pink-500 relative group"
            >
              Home
              <span className="absolute bottom-[-6px] left-0 w-0 h-1 bg-pink-500 transition-all duration-300 rounded-full group-hover:w-full"></span>
            </Link>
            <Link
              href="/about"
              className="text-white hover:text-pink-500 relative group"
            >
              About
              <span className="absolute bottom-[-6px] left-0 w-0 h-1 bg-pink-500 transition-all duration-300 rounded-full group-hover:w-full"></span>
            </Link>
            <Link
              href="/contact"
              className="text-white hover:text-pink-500 relative group"
            >
              Contact
              <span className="absolute bottom-[-6px] left-0 w-0 h-1 bg-pink-500 transition-all duration-300 rounded-full group-hover:w-full"></span>
            </Link>
            <Link
              href="/privacy"
              className="text-white hover:text-pink-500 relative group"
            >
              Privacy Policy
              <span className="absolute bottom-[-6px] left-0 w-0 h-1 bg-pink-500 transition-all duration-300 rounded-full group-hover:w-full"></span>
            </Link>
          </nav>
          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-white hover:text-pink-500 transition duration-300"
            >
              {menuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
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
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16m-7 6h7"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        {/* Mobile Dropdown Menu */}
        {menuOpen && (
          <div className="md:hidden bg-indigo-800 absolute inset-x-0 top-full mt-0 p-4 shadow-lg z-50 rounded-b-lg">
            <nav className="space-y-3">
              <Link
                href="/"
                className="block text-white hover:text-pink-500 transition duration-300"
                onClick={() => setMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/about"
                className="block text-white hover:text-pink-500 transition duration-300"
                onClick={() => setMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/contact"
                className="block text-white hover:text-pink-500 transition duration-300"
                onClick={() => setMenuOpen(false)}
              >
                Contact
              </Link>
              <Link
                href="/privacy"
                className="block text-white hover:text-pink-500 transition duration-300"
                onClick={() => setMenuOpen(false)}
              >
                Privacy Policy
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left Section */}
          <div className="space-y-6">
            <h1
              ref={headingRef}
              className="text-2xl md:text-4xl font-semibold leading-tight mt-3 md:mt-0"
            >
               Welcome to <span className="text-pink-500">Be</span>Talkative
            </h1>
            <p ref={descRef} className="text-lg text-gray-300">
            Stay connected with friends and colleagues. Enjoy seamless messaging and real-time conversations, anytime, anywhere.
            </p>
            <div className="flex space-x-4">
              <Link href={"/inbox"} ref={buttonRef} className="px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg text-lg font-medium shadow-lg">
                Get Started
              </Link>
            </div>
          </div>

          {/* Right Section */}
          <div className="relative">
            <Image
              width={500}
              height={100}
              src="/landing.png" // Replace with the actual image path
              alt="Mobile Chat Dialog UI"
            />
          </div>
        </div>
      </div>
    </div>
    <Footer/>
    </>
  );
}
