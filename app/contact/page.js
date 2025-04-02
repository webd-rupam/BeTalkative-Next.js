"use client";
import React, { useState, useEffect, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { gsap } from "gsap";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

const ContactForm = () => {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", message: "" });
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    document.title = "BeTalkative - Contact Us";

    const ctx = gsap.context(() => {
      gsap.fromTo(
        formRef.current,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          stagger: 0.2,
        }
      );
    }, formRef);

    return () => ctx.revert();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const response = await fetch(process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      toast.success("Message sent successfully!", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
      });
      setForm({ email: "", name: "", message: "" });
    } else {
      toast.error("Oops! Message cannot be sent at this moment.", {
        position: "top-right",
        autoClose: 2000,
        theme: "dark",
      });
    }

    setLoading(false);
  };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        pauseOnFocusLoss
        theme="dark"
      />

      {/* Back Button */}
      <div className="absolute top-5 left-5">
        <Link
         href={"/"}
          className="px-4 py-2"
        >
          <FaArrowLeft className="text-xl hover:text-gray-400 relative left-3"/>
        </Link>
      </div>

      <section className="bg-gradient-to-br from-indigo-900 to-purple-900 min-h-screen py-12 px-4 lg:px-0 flex justify-center items-center">
        <div className="container mx-auto max-w-4xl shadow-xl bg-white rounded-lg p-8 lg:p-12 relative">
          <h2 className="text-4xl font-bold text-pink-500 text-center mb-4">
            Get in Touch
          </h2>
          <p className="text-gray-600 text-center mb-8 text-lg">
            Have questions or need assistance? Drop us a message and we&apos;ll get back to you shortly!
          </p>

          {/* Contact Form */}
          <form
            ref={formRef}
            className="space-y-6 relative z-20"
            onSubmit={handleSubmit}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-gray-700 font-semibold" htmlFor="name">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="outline-none text-black w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 transition shadow-sm"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="text-gray-700 font-semibold" htmlFor="email">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-4 text-black py-3 border outline-none border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 transition shadow-sm"
                  placeholder="johndoe@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-gray-700 font-semibold" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={form.message}
                onChange={handleChange}
                rows="5"
                className="w-full resize-none text-black outline-none px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-pink-500 transition shadow-sm"
                placeholder="Type your message here..."
                required
              ></textarea>
            </div>

            <div className="text-center">
              <button
                type="submit"
                className="bg-pink-500 text-white py-3 px-4 rounded-full font-semibold hover:bg-pink-600 transition shadow-lg disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
};

export default ContactForm;
