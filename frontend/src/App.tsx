import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import EarlyAccessModal from "./components/EarlyAccessModal";
import HeroSection from "./components/HeroSection";
import HowDressiWorks from "./components/HowDressiWorks";
import InstantOutfitSection from "./components/InstantOutfitSection";
import CuratedPage from "./components/CuratedPage";
import OutfitSwipe from "./components/OutfitSwipe";
import CallToActionSection from "./components/LastSection";
import StyleDiscovery from "./components/StyleDiscovery";
import Navbar from "./components/navbar";
import AdminPage from "./components/AdminPage";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import ProfilePage from "./components/ProfilePage";
import WardrobePage from "./components/WardrobePage";

export default function App() {
  const [showModal, setShowModal] = useState(false);
  const [instantLoading, setInstantLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowModal(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <main className="pt-14">
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <HeroSection />
                  <HowDressiWorks onBetaClick={() => setShowModal(true)} />
                  <InstantOutfitSection setLoading={setInstantLoading} />
                  <CallToActionSection />
                  <EarlyAccessModal open={showModal && !instantLoading} onClose={() => setShowModal(false)} />
                </>
              }
            />
            <Route path="/style-discovery" element={<StyleDiscovery />} />
            <Route path="/outfit-swipe" element={<OutfitSwipe />} />
            <Route path="/curated" element={<CuratedPage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
