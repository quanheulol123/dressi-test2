import { motion } from "framer-motion";

import glowUpImage from "../assets/glow_up_image.png";
import uploadItemImage from "../assets/upload_item_image.png";
import digitalWardrobeImage from "../assets/digital_wardrobe_image.png";
import virtualTryOnImage from "../assets/virtual_try_on.png";
import styleSmarterImage from "../assets/style_smarter_image.png";

type Step = {
  title: string;
  description: string[];
  image: string;
};

const steps: Step[] = [
  {
    title: "Find your glow-up formula",
    description: [
      "Dressi uses AI to identify your skin tone and body shape, creating a personalized style formula made just for you.",
    ],
    image: glowUpImage,
  },
  {
    title: "Upload one item",
    description: [
      "Start with just one piece from your wardrobe: a dress, a blazer, even your favorite pair of jeans.",
      "Dressi instantly creates 5 outfit combinations around it, using your personalized Glow-Up Style Formula.",
    ],
    image: uploadItemImage,
  },
  {
    title: "Build your digital wardrobe",
    description: [
      "Track what you wear, rediscover forgotten favorites, and build a more authentic relationship with your clothes.",
    ],
    image: digitalWardrobeImage,
  },
  {
    title: "See yourself in every look",
    description: [
      "Bring your style to life with a personalized 3D avatar that mirrors your shape and tone.",
      "See how every outfit fits you before adding to your wardrobe.",
    ],
    image: virtualTryOnImage,
  },
  {
    title: "Style smarter, shop consciously",
    description: [
      "Dressi recommends what completes your wardrobe, not clutters it.",
      "Buy with intention, fall back in love with your closet, and build a style that lasts.",
    ],
    image: styleSmarterImage,
  },
];

const textVariants = {
  hidden: { opacity: 0, y: 48 },
  visible: { opacity: 1, y: 0 },
};

const imageVariants = {
  hiddenLeft: { opacity: 0, x: -64 },
  hiddenRight: { opacity: 0, x: 64 },
  visible: { opacity: 1, x: 0 },
};

type HowDressiWorksProps = {
  onBetaClick?: () => void;
};

export default function HowDressiWorks({ onBetaClick }: HowDressiWorksProps) {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#1a0013] via-black to-[#0c0210] py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,82,168,0.4),_rgba(0,0,0,0))]" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,188,220,0.35),_rgba(0,0,0,0))]" />
        <div className="absolute bottom-10 left-[-140px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,120,198,0.25),_rgba(0,0,0,0))]" />
      </div>

      <div className="mx-auto flex max-w-full flex-col gap-20 px-6 sm:px-8 lg:px-10">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl font-bold tracking-wide text-transparent bg-gradient-to-r from-pink-300 via-purple-400 to-pink-500 bg-clip-text sm:text-6xl lg:text-7xl leading-tight">
            How <span className="font-extrabold italic text-transparent bg-gradient-to-r from-pink-400 via-rose-300 to-purple-400 bg-clip-text drop-shadow-sm">Dressi</span> Works
          </h2>
        </motion.div>

        {steps.map((step, index) => {
          const isEven = index % 2 === 0;

          return (
            <motion.div
              key={step.title}
              className={`flex flex-col items-center gap-8 rounded-[32px] border border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-10 shadow-[0_25px_60px_-40px_rgba(12,12,12,0.8),0_0_40px_-10px_rgba(255,82,168,0.15)] backdrop-blur-3xl transition-all duration-700 hover:shadow-[0_35px_80px_-40px_rgba(12,12,12,0.9),0_0_60px_-10px_rgba(255,82,168,0.25)] hover:border-white/25 hover:bg-gradient-to-br hover:from-white/15 hover:via-white/8 hover:to-transparent lg:flex-row lg:items-stretch lg:gap-10 lg:min-h-[720px] ${isEven ? "" : "lg:flex-row-reverse"}`}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 80 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <motion.div
                className="flex-1 lg:max-w-[420px] lg:flex lg:flex-col lg:justify-center"
                variants={textVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              >
                <h3 className="mt-2 text-2xl font-bold text-transparent bg-gradient-to-r from-pink-200 via-white to-purple-300 bg-clip-text tracking-tight leading-tight sm:text-3xl lg:text-4xl">
                  {step.title}
                </h3>
                <div className="mt-6 space-y-5 text-base text-white/85 leading-relaxed sm:text-lg font-light tracking-wide">
                  {step.description.map((paragraph) => (
                    <p key={paragraph} className="relative pl-6 border-l-2 border-pink-400/50 italic font-medium text-white/90 leading-loose">
                      <span className="absolute -left-[2px] top-0 h-full w-[2px] bg-gradient-to-b from-pink-400/80 via-purple-400/60 to-pink-300/40"></span>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="flex flex-1 items-center justify-center lg:h-full lg:justify-end"
                initial={isEven ? "hiddenRight" : "hiddenLeft"}
                whileInView="visible"
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                variants={imageVariants}
              >
                <div className="relative w-full h-72 sm:h-80 lg:h-full max-w-[2400px] sm:max-w-[2800px] lg:max-w-none">
                  <div className="pointer-events-none absolute inset-0 -z-10 rounded-[40px] bg-gradient-to-br from-white/25 via-transparent to-transparent blur-3xl" />
                  <img
                    src={step.image}
                    alt={step.title}
                    className="h-full w-full rounded-[40px] object-contain shadow-[0_70px_140px_-50px_rgba(15,23,42,0.62)]"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </motion.div>
          );
        })}

        <motion.div
          className="mx-auto flex max-w-3xl flex-col items-center gap-6 rounded-3xl border border-white/15 bg-white/5 px-8 py-10 text-center shadow-[0_25px_60px_-40px_rgba(12,12,12,0.8),0_0_40px_-10px_rgba(255,82,168,0.15)] backdrop-blur-2xl"
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-lg font-semibold text-white/90 sm:text-xl">
            ✨ Because the future of fashion starts with what's already yours.
          </p>
          <button
            type="button"
            onClick={() => onBetaClick?.()}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-400 via-rose-400 to-purple-500 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_20px_45px_-25px_rgba(255,82,168,0.45)] transition duration-300 hover:shadow-[0_25px_60px_-25px_rgba(255,82,168,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:text-base"
          >
            Be a Beta Tester
          </button>
        </motion.div>
      </div>
    </section>
  );
}
