import LunchRouletteClient from "@/components/lunch-roulette-client";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-2xl mx-auto">
        <LunchRouletteClient />
      </div>
    </div>
  );
}
