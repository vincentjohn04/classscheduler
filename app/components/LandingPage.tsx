/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const LandingPage = () => {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(780px,1fr))] ">
      <nav className="bg-[#5D1A25] flex justify-between items-center py-3 px-6 text-white shadow-md">
        {/* Left Side: Logo and Navigation */}
        <div className="flex items-center gap-10">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <img src="/chronyx.png" alt="chronyx" className=" h-10 w-10 rounded-full shadow-sm" />
            <h3 className="font-extrabold font-[Nunito] text-xl tracking-wide">Chronyx</h3>
          </div>
          
          {/* Nav Links */}
          <ul className="hidden md:flex items-center gap-x-6 font-medium text-sm">
            <li><a href="#" className="transition-all hover:[text-shadow:2px_2px_4px_rgba(255,255,255,0.4)] duration-300 hover:scale-110 block">Home</a></li>
            <li><a href="#" className="transition-all hover:[text-shadow:2px_2px_4px_rgba(255,255,255,0.4)] duration-300 hover:scale-110 block">About</a></li>
            <li><a href="#" className="transition-all hover:[text-shadow:2px_2px_4px_rgba(255,255,255,0.4)] duration-300 hover:scale-110 block">Contact</a></li>
          </ul>
        </div>

        {/* Right Side: Auth Buttons */}
        <div className="flex items-center gap-4 font-medium text-sm pr-5">
          <Link href="/login" className="transition-all hover:[text-shadow:2px_2px_4px_rgba(255,255,255,0.4)] duration-300 hover:scale-110 block">Get Started</Link>
        </div>
      </nav>

        {/* Hero Section */}
        <div className="bg-[#5D1A25] min-h-screen min-w-screen flex flex-col">
          
        </div>
    </div>
  );
};

export default LandingPage;
