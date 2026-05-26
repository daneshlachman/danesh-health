import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Automatically add X-API-Key to all backend requests
const _apiBase = import.meta.env.VITE_API_BASE_URL || "";
const _apiKey = import.meta.env.VITE_API_KEY || "";
if (_apiKey) {
  const _origFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    if (typeof url === "string" && (_apiBase ? url.startsWith(_apiBase) : url.startsWith("/api"))) {
      opts = { ...opts, headers: { "X-API-Key": _apiKey, ...(opts.headers || {}) } };
    }
    return _origFetch(url, opts);
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
