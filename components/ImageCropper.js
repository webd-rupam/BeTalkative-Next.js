"use client";
import React, { useState } from "react";
import Cropper from "react-easy-crop";

const ImageCropper = ({ imageSrc, onCropComplete, onClose }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Handle crop completion
  const handleCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  // Save the cropped image
  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage); // Pass the cropped image back to the parent component
    } catch (error) {
      console.error("Error cropping image:", error);
    }
  };

  // Generate the cropped image
  const getCroppedImg = (imageSrc, croppedAreaPixels) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Set canvas dimensions to the cropped area
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        // Draw the cropped image onto the canvas
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );

        // Convert the canvas to a data URL
        const dataUrl = canvas.toDataURL("image/jpeg"); // Use "image/png" for PNG format
        resolve(dataUrl); // Return the cropped image as a data URL
      };

      image.onerror = () => {
        reject(new Error("Failed to load image"));
      };
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          padding: "24px",
          width: "90%",
          maxWidth: "400px",
        }}
      >
        <h3 style={{ color: "white", fontSize: "18px", fontWeight: "bold", marginBottom: "16px" }}>
          Crop Image
        </h3>
        <div style={{ position: "relative", width: "100%", height: "200px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1} // Adjust aspect ratio as needed (e.g., 1 for square, 4/3 for rectangular)
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div style={{ marginTop: "16px" }}>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#333",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;