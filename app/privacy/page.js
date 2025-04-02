"use client";
import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft } from "react-icons/fa";

const PrivacyPolicy = () => {
  const router = useRouter();
  const headingRef = useRef(null);
  const descRef = useRef(null);
  const policyRef = useRef(null);

  useEffect(() => {
    document.title = "BeTalkative - Privacy Policy";

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current,
        { x: -200, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: "power3.out" }
      );
      gsap.fromTo(
        descRef.current,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.2 }
      );
      gsap.fromTo(
        policyRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1, delay: 0.4, ease: "power2.out" }
      );
    }, [headingRef, descRef, policyRef]);

    return () => ctx.revert();
  }, []);

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 min-h-screen py-12 px-4 lg:px-0">
      {/* Back Button */}
      <div className="absolute top-5 left-5">
      <Link
         href={"/"}
          className="px-4 py-2"
        >
          <FaArrowLeft className="text-xl hover:text-gray-400 relative left-3"/>
        </Link>
      </div>

      <div className="container mx-auto max-w-4xl shadow-xl bg-white rounded-lg p-8 lg:p-12 mt-16 relative z-20">
        {/* Page Title */}
        <h1
          ref={headingRef}
          className="text-4xl font-bold text-pink-500 text-center mb-4"
        >
          Privacy Policy
        </h1>
        <p
          ref={descRef}
          className="text-lg text-gray-600 text-center mb-8"
        >
          Your privacy is important to us. This Privacy Policy outlines the information we collect and how we use, store, and protect it.
        </p>

        {/* Privacy Policy Content */}
        <div ref={policyRef} className="space-y-6">
          <h2 className="text-2xl font-semibold text-pink-500">Information We Collect</h2>
          <p className="text-gray-500">
            We collect personal information such as your name, email address, and any other details you provide through our app. We also collect non-personal information such as usage data, device information, and location data.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">How We Use Your Information</h2>
          <p className="text-gray-500">
            The information we collect is used to improve our services, provide customer support, and send you relevant updates. We may also use the data to analyze trends and enhance your overall user experience.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">How We Protect Your Information</h2>
          <p className="text-gray-500">
            We take the protection of your data seriously and use industry-standard encryption and security protocols to ensure your information is secure. However, no method of transmission over the internet or electronic storage is 100% secure.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">Data Retention</h2>
          <p className="text-gray-500">
            We retain your personal data only as long as necessary for the purposes outlined in this Privacy Policy, or as required by law.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">Sharing Your Information</h2>
          <p className="text-gray-500">
            We do not sell, rent, or share your personal information with third parties except in the following cases:
          </p>
          <ul className="text-gray-500 list-disc pl-6">
            <li>To comply with legal obligations, such as responding to a subpoena or court order.</li>
            <li>With trusted third-party service providers who assist in the operation of our app (e.g., analytics providers).</li>
          </ul>

          <h2 className="text-2xl font-semibold text-pink-500">Your Rights</h2>
          <p className="text-gray-500">
            You have the right to access, update, and delete your personal data at any time. If you wish to exercise these rights, please contact us through the contact form on our website.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">Changes to This Privacy Policy</h2>
          <p className="text-gray-500">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page. Please review this policy periodically to stay informed about how we are protecting your information.
          </p>

          <h2 className="text-2xl font-semibold text-pink-500">Contact Us</h2>
          <p className="text-gray-500">
            If you have any questions about this Privacy Policy, please contact us via the contact page.
          </p>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <Link href="/contact">
              <button className="mt-4 px-6 py-3 bg-pink-500 hover:bg-pink-600 rounded-lg text-lg font-medium shadow-lg">
                Contact Us
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
