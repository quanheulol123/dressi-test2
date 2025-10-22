import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import EarlyAccessModal from "./EarlyAccessModal";
import heroImage from "../assets/hero_image.png";

export default function HeroSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative isolate overflow-hidden"
    >
      <EarlyAccessModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_left_center,rgba(36,50,70,0.85),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_right_center,rgba(139,92,246,0.18),transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-20 pt-24 lg:grid-cols-2 lg:gap-12 lg:px-8">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-[56px]">
            <span className="block text-pink-500">AI personal stylist</span>
            <span className="block">in your pocket</span>
          </h1>
          <p className="text-balance text-lg font-semibold text-white/90 sm:text-xl lg:text-[28px]">
            <span className="text-pink-500">Reimagined</span> the future of fashion starts with what's already yours.{" "}
            <Sparkles className="inline h-6 w-6 align-middle text-yellow-300" />
          </p>
          <p className="text-base text-neutral-300 sm:text-lg">
            Dressi helps you style, renew, and reconnect with your wardrobe, one outfit at a time.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-pink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              onClick={() => navigate("/style-discovery")}
            >
              <Sparkles className="h-5 w-5" />
              Transform My Style
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-black shadow-lg ring-1 ring-black/10 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              onClick={() => setModalOpen(true)}
            >
              Get Early Access
            </button>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex justify-center"
        >
          <div className="overflow-hidden rounded-4xl shadow-2xl border-4 border-white/10">
            <img
              src={heroImage}
              alt="Model in white shirt and black pants"
              className="h-[600px] w-full object-cover object-center"
            />
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
