// utils/formatTimestamp.js
export const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return "Just now"; // Handle undefined or invalid timestamps
  
    const date = timestamp.toDate(); // Convert Firestore timestamp to JavaScript Date
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
  
    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };