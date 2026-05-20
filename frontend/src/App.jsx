import { useState } from "react";
import Dashboard from "./components/Dashboard";
import NutritionLog from "./components/NutritionLog";
import Chat from "./components/Chat";
import WorkoutLog from "./components/WorkoutLog";
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "nutrition", label: "Nutrition", icon: "🥗" },
  { id: "workouts", label: "Workouts", icon: "🏋️" },
  { id: "chat", label: "Chat", icon: "💬" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)", boxSizing: "border-box" }}>
      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "nutrition" && <NutritionLog />}
        {activeTab === "workouts" && <WorkoutLog />}
        {activeTab === "chat" && <Chat />}
      </main>

      {/* Bottom tab bar */}
      <nav className="bg-white border-t border-gray-200 flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-brand-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
