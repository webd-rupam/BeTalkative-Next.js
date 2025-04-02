"use client";
import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";

export default function About() {
  const router = useRouter();
  const headingRef = useRef(null);
  const descRef = useRef(null);
  const missionRef = useRef(null);

  useEffect(() => {
    document.title = "BeTalkative - About";
  }, []);
  
  useEffect(() => {
    // GSAP animation for the heading
    gsap.fromTo(
      headingRef.current,
      { x: -200, opacity: 0 },
      { x: 0, opacity: 1, duration: 1, ease: "power3.out" }
    );
  }, []);

  useEffect(() => {
    // GSAP animation for the description
    gsap.fromTo(
      descRef.current,
      { y: 80, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" }
    );
  }, []);

  useEffect(() => {
    // GSAP animation for mission section
    gsap.fromTo(
      missionRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, delay: 0.5, ease: "power2.out" }
    );
  }, []);

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 min-h-screen text-white">
      {/* Back Button */}
      <div className="absolute top-5 left-5">
      <Link
         href={"/"}
          className="px-4 py-2"
        >
          <FaArrowLeft className="text-xl hover:text-gray-400 relative left-3"/>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* About Us Section */}
          <div className="text-center">
            <h1 ref={headingRef} className="text-2xl md:text-4xl font-semibold leading-tight">
              About Us
            </h1>
            <p ref={descRef} className="mt-4 text-lg text-gray-300">
              At <span className="text-pink-500">Be</span>Talkative, our mission is to provide a seamless,
              secure, and engaging messaging and communication experience for everyone. We believe in connecting people easily
              while ensuring their privacy and security. Our goal is to make digital communication feel personal,
              intuitive, and fun.
            </p>
          </div>

          {/* Our Mission */}
          <div ref={missionRef} className="text-center mt-12">
            <h2 className="text-xl md:text-2xl font-semibold">Our Mission</h2>
            <p className="mt-4 text-lg text-gray-300">
              We are committed to building a platform that brings people together. Our app aims to provide
              fast and secure communication tools that are easy to use, making it easier for friends, family,
              and colleagues to stay connected no matter where they are in the world.
            </p>
            <p className="mt-4 text-lg text-gray-300">
              With top-notch privacy features and intuitive design, we are redefining how people communicate in the
              digital world, one chat at a time.
            </p>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <h3 className="text-xl text-gray-300">
              Ready to connect? Join our community and start chatting today!
            </h3>
            <Link href="/inbox">
              <button className="mt-4 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg text-lg font-medium shadow-lg">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
