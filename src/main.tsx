import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply dark mode BEFORE first render to prevent flash
const saved = localStorage.getItem("theme");
if (saved === "light") {
  document.documentElement.classList.remove("dark");
} else {
  // Default is dark
  document.documentElement.classList.add("dark");
  if (!saved) localStorage.setItem("theme", "dark");
}

createRoot(document.getElementById("root")!).render(<App />);
