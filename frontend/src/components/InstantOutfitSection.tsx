import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun,
  Cloud,
  Snowflake,
  Briefcase,
  Shirt,
  Heart,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { apiUrl } from "../lib/api";

type InstantOption = {
  label: string;
  value: string;
  vibe: string;
  description: string;
  icon: ReactNode;
  style: string;
  occasion: string;
  featured: string;
  title: string;
  bg: string;
};

const weatherOptions: InstantOption[] = [
  {
    label: "Sunny Vibes",
    value: "Sunny",
    vibe: "sunny",
    description:
      "Effortless summer elegance with flowing fabrics, radiant colors, and that golden-hour glow that turns heads everywhere you go.",
    icon: <Sun className="h-8 w-8 text-yellow-400" />,
    style: "Casual",
    occasion: "Weekend",
    featured: "AI Curated",
    title: "Sunny Day Goddess",
    bg: "bg-gradient-to-br from-yellow-50 via-white to-yellow-100",
  },
  {
    label: "Cloudy Vibes",
    value: "Cloudy",
    vibe: "cloudy",
    description:
      "Sophisticated layering, muted tones, and luxe textures for moody days.",
    icon: <Cloud className="h-8 w-8 text-blue-400" />,
    style: "Formal",
    occasion: "Work",
    featured: "AI Curated",
    title: "Cloudy Chic",
    bg: "bg-gradient-to-br from-blue-50 via-white to-blue-100",
  },
  {
    label: "Cold Vibes",
    value: "Cold",
    vibe: "cold",
    description:
      "Chic cold weather couture with statement coats, cozy knits, and accessories.",
    icon: <Snowflake className="h-8 w-8 text-indigo-400" />,
    style: "Sporty",
    occasion: "Casual",
    featured: "AI Curated",
    title: "Winter Muse",
    bg: "bg-gradient-to-br from-indigo-50 via-white to-indigo-100",
  },
];

const occasionOptions: InstantOption[] = [
  {
    label: "Work",
    value: "Work",
    vibe: "work",
    description:
      "Power suits, sharp silhouettes, and confidence-boosting pieces.",
    icon: <Briefcase className="h-8 w-8 text-neutral-800" />,
    style: "Formal",
    occasion: "Work",
    featured: "AI Curated",
    title: "Boardroom Queen",
    bg: "bg-gradient-to-br from-gray-100 via-white to-gray-200",
  },
  {
    label: "Casual",
    value: "Casual",
    vibe: "casual",
    description:
      "Effortlessly cool street style that looks like you just stepped out of a magazine.",
    icon: <Shirt className="h-8 w-8 text-orange-500" />,
    style: "Casual",
    occasion: "Casual",
    featured: "AI Curated",
    title: "Street Style Star",
    bg: "bg-gradient-to-br from-orange-50 via-white to-orange-100",
  },
  {
    label: "Date Night",
    value: "Date",
    vibe: "date",
    description: "Romantic elegance meets sultry sophistication.",
    icon: <Heart className="h-8 w-8 text-pink-500" />,
    style: "Party",
    occasion: "Date",
    featured: "AI Curated",
    title: "Date Night Dream",
    bg: "bg-gradient-to-br from-pink-50 via-white to-pink-100",
  },
];
type InstantOutfitSectionProps = {
  setLoading?: (loading: boolean) => void;
};

type InstantOutfitResult = {
  name: string;
  image: string;
  tags?: string[];
  source_url?: string;
  vibe?: string | null;
};

export default function InstantOutfitSection({
  setLoading,
}: InstantOutfitSectionProps) {
  const [loading, setLocalLoading] = useState(false);
  const [selected, setSelected] = useState<InstantOption | null>(null);
  const [outfit, setOutfit] = useState<InstantOutfitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(true);
  const [shownOutfits, setShownOutfits] = useState<string[]>([]);
  const navigate = useNavigate();
  const selectedBackground = selected?.bg ?? "bg-neutral-100";
  const selectedIcon = selected?.icon;
  const selectedLabel = selected?.label ?? "Your vibe";

  async function handleInstant(opt: InstantOption) {
    setError(null);
    setShowOptions(false);
    setSelected(opt);
    setOutfit(null);
    setLocalLoading(true);
    setLoading?.(true);

    let excludeList = [...shownOutfits];
    let generated: InstantOutfitResult | null = null;
    let tries = 0;
    const maxTries = 5;
    let exhausted = false;

    while (tries < maxTries && !generated) {
      tries++;
      try {
        const response = await fetch(
          apiUrl("/api/instant_outfits/"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vibe: opt.vibe,
              image_count: 1,
              exclude_names: excludeList,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        const outfits: InstantOutfitResult[] = Array.isArray(data?.outfits)
          ? (data.outfits as InstantOutfitResult[]).filter(Boolean)
          : [];
        const uniqueExhausted = Boolean(data?.uniqueExhausted);
        if (uniqueExhausted) {
          exhausted = true;
        }
        const seenNames = new Set(excludeList);

        let outfitCandidate = outfits.find(
          (item) => item?.name && !seenNames.has(item.name)
        );

        if (!outfitCandidate && outfits.length > 0) {
          outfitCandidate = outfits[0];
        }

        if (outfitCandidate) {
          generated = outfitCandidate;
          setShownOutfits((prev) => {
            if (uniqueExhausted) {
              return [outfitCandidate.name];
            }
            if (prev.includes(outfitCandidate.name)) {
              return prev;
            }
            return [...prev, outfitCandidate.name];
          });
          if (uniqueExhausted) {
            excludeList = [outfitCandidate.name];
          } else if (!excludeList.includes(outfitCandidate.name)) {
            excludeList = [...excludeList, outfitCandidate.name];
          }
        } else if (uniqueExhausted) {
          setShownOutfits([]);
          excludeList = [];
        }
      } catch (error) {
        console.error("Instant outfit fetch failed", error);
        setError("Error fetching instant outfit. Please try again.");
        break;
      }
    }

    if (generated) {
      setOutfit(generated);
    } else {
      setError(
        exhausted
          ? "We just cycled through every available look - give it another moment or try a different vibe."
          : "No outfit found for that combo. Try another option!"
      );
    }

    setLocalLoading(false);
    setLoading?.(false);
  }

  function handleRetake() {
    setShowOptions(true);
    setSelected(null);
    setOutfit(null);
    setError(null);
    setLocalLoading(false);
    setLoading?.(false);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="py-12"
      style={{
        background:
          "radial-gradient(ellipse at center, #181c24 0%, #23283a 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-4xl font-extrabold mb-2 text-white">
            No More <span className="text-pink-400">"Nothing To Wear" Moments</span>
          </h2>
          <p className="text-neutral-300 mb-2">
            Get Instant Style Magic, Curated by AI
          </p>
        </div>

        <div
          className="mx-auto flex flex-col items-center justify-center"
          style={{
            minHeight: "400px",
            maxWidth: "700px",
            width: "100%",
          }}
        >
          {showOptions && (
            <>
              <div className="mb-6 text-center text-xl font-bold text-white flex items-center justify-center gap-2">
                Let The Weather Set Your Vibe
              </div>
              <div className="flex flex-col sm:flex-row gap-8 justify-center mb-12">
                {weatherOptions.map((opt) => (
                  <button
                    key={opt.label}
                    className={`w-full sm:w-[280px] ${opt.bg} rounded-2xl p-6 flex flex-col items-center shadow-lg transition-all duration-200 hover:scale-105`}
                    disabled={loading}
                    onClick={() => handleInstant(opt)}
                  >
                    {opt.icon}
                    <div className="font-bold text-xl text-gray-900 mt-4 mb-4">
                      {opt.label}
                    </div>
                    <span className="mt-4 text-gray-900 font-semibold flex items-center gap-1">
                      Style Me <span className="text-lg">&rarr;</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mb-6 text-center text-xl font-bold text-white flex items-center justify-center gap-2">
                Or Style by Occasion
              </div>

              <div className="flex flex-col sm:flex-row gap-8 justify-center">
                {occasionOptions.map((opt) => (
                  <button
                    key={opt.label}
                    className={`w-full sm:w-[280px] ${opt.bg} rounded-2xl p-6 flex flex-col items-center shadow-lg transition-all duration-200 hover:scale-105`}
                    disabled={loading}
                    onClick={() => handleInstant(opt)}
                  >
                    {opt.icon}
                    <div className="font-bold text-xl text-gray-900 mt-4 mb-4">
                      {opt.label}
                    </div>
                    <span className="mt-4 text-gray-900 font-semibold flex items-center gap-1">
                      Style Me <span className="text-lg">&rarr;</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!showOptions && (
            <div className="mx-auto max-w-2xl text-center">
              <div className="flex flex-col items-center gap-3 text-neutral-200">
                <p className="text-lg font-semibold">
                  We heard: {selected?.label ?? "your vibes"}
                </p>
                {loading && (
                  <p className="text-sm text-neutral-400">
                    Generating a look you'll love...
                  </p>
                )}
                {error && (
                  <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                  </p>
                )}
                <button
                  onClick={handleRetake}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3 text-base font-bold text-white shadow-lg transition-all duration-200 hover:border-white/60 hover:bg-white/20 hover:scale-105 active:scale-95"
                  disabled={loading}
                >
                  <RefreshCw className="h-5 w-5" /> Retake Choices
                </button>
              </div>
            </div>
          )}

          {outfit && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mx-auto mt-6 flex justify-center"
              style={{ width: "100%" }}
            >
              <div className="flex flex-col md:flex-row items-stretch rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div
                  className={`md:w-1/2 w-full flex flex-col items-center justify-between gap-4 p-4 ${selectedBackground}`}
                >
                  <div className="flex items-center gap-2 text-gray-900">
                    {selectedIcon && (
                      <span className="inline-flex items-center justify-center rounded-full bg-white/80 p-2 shadow-inner">
                        {selectedIcon}
                      </span>
                    )}
                    <div className="text-left">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Selected vibe
                      </p>
                      <p className="text-base font-semibold">
                        {selectedLabel}
                      </p>
                    </div>
                  </div>
                  <div className="w-full max-w-[260px] aspect-[3/4] bg-white/80 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                    <img
                      src={outfit.image}
                      alt={selected?.title || "Outfit"}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="md:w-1/2 w-full p-6 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-bold">
                      {selected?.featured || "AI Curated"}
                    </span>
                  </div>
                  <div className="text-xl font-bold mb-2 text-pink-500">
                    {selected?.title || "Your Outfit"}
                  </div>
                  <div className="text-gray-700 mb-4 text-sm">
                    {selected?.description}
                  </div>
                  <button
                    className="bg-black text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-neutral-900 transition text-sm"
                    onClick={() => navigate("/signup")}
                  >
                    Unlock Full Styling Experience
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
