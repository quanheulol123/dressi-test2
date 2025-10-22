import { useNavigate } from "react-router-dom";

export default function NoTestPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-pink-400">
          You haven’t taken the style test yet
        </h1>
        <p className="text-gray-300 mb-8">
          Take the quick AI style test to get your curated outfits. It only takes a minute and helps us understand your personal style better.
        </p>

        <button
          type="button"
          onClick={() => navigate("/style-discovery")}
          className="rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400"
        >
          Take the Test
        </button>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white underline text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
