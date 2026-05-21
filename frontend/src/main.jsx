import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Fix iOS PWA viewport height — updates on resize so it's always correct
const setAppHeight = () => {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
};
setAppHeight();
window.addEventListener("resize", setAppHeight);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
