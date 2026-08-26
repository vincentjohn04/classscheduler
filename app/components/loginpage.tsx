/* eslint-disable @next/next/no-img-element */

const loginpage = () => {
  return (
    <div className="min-h-screen flex flex-col fixed min-w-screen">
      {/* Top Navbar */}
      <nav className="bg-[#5D1A25] flex items-center py-3 px-6 text-white">
        <div className="flex items-center gap-3">
          <img src="/chronyx.png" alt="chronyx" className="h-8 w-8 rounded-full" />
          <h3 className="font-bold font-[Nunito] text-base tracking-wide">Chronyx</h3>
        </div>
      </nav>

      {/* Full-Screen Image Container */}
      <div className="relative grow w-full overflow-hidden flex items-center justify-center">
        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/OIP.webp')" }}
        />

        {/* Strong Color Overlay */}
        <div className="absolute inset-0 bg-[#5D1A25] opacity-40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[#5D1A25] opacity-30" />

        {/* Subtle Glass Tint for a Modern Feel */}
        <div className="absolute inset-0 bg-[#5D1A25]/10 backdrop-blur-[1px]" />

        {/* login card */}
        <div className="login_card flex gap-15">

          {/* Left Side: Welcome Section */}
          <div className="pl-10 pt-10 flex flex-col gap-2">
            <div className="pl-17 pb-5">
              <img src="/chronyx.png" alt="chronyx" className=" h-20 w-20 rounded-full" />
            </div>
            <h1 className="text-xl font-bold text-white  font-[Nunito] tracking-wide pl-4">
              Welcome to Chronyx
            </h1>
            <h1 className="text-lg text-white/60 font[Nunito] pl-4 pb-5">Your Intelligent Scheduler</h1>
            <p className="text-white/40 pl-8 text-[14px] mt-15">Don&apos;t have an account yet?</p>
            <div className="flex flex-col gap-4 ml-10 bg-white w-fit rounded-lg hover:bg-gray-300 hover:scale-105 transition-all duration-300">
              <button id="Sign_up" className="text-xl font-[Nunito] text-[#5D1A25] px-10 py-2 hover:scale-105 hover:cursor-pointer hover:font-bold transition-all duration-300">Sign Up</button>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="form bg-white h-full w-6/10 rounded-lg flex flex-col ">
            <div className="mx-20 my-10">
              <h1 className="text-[#5D1A25] font-extrabold font-[Nunito] text-3xl">Login</h1>

              {/* Login Form Section */}
              <form>

                {/* Email and Password Fields */}
                <div>
                  <label htmlFor="email" className="block text-[#5D1A25] font-[Nunito] text-lg mt-5">Email</label>
                  <input type="email" id="email" name="email" className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-[#5D1A25] font-[Nunito] text-lg mt-5">Password</label>
                  <input type="password" id="password" name="password" className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]" />
                </div>
                <div>
                  <button type="submit" className="bg-[#5D1A25] text-white font-[Nunito] px-4 py-2 rounded-md mt-5 hover:cursor-pointer hover:bg-[#5D1A25] hover:scale-105 transition-all duration-300">Login</button>
                </div>

                {/*Other Login Options*/}
                <div className="flex items-center justify-between mt-5">
                  <hr className="w-full border-gray-300" />
                  <h1 className="px-4 text-gray-500">or</h1>
                  <hr className="w-full border-gray-300" />
                </div>
                <div className="flex gap-10 ml-15 mt-5">
                  <button>
                    <img src="/gmail.svg" alt="gmail" className="logo hover:cursor-pointer  hover:scale-110 transition-transform duration-300"/>
                  </button>
                  <button>
                    <img src="/facebook.svg" alt="facebook" className="logo hover:cursor-pointer  hover:scale-110 transition-transform duration-300"/>
                  </button>
                  <button>
                    <img src="/apple.svg" alt="apple" className="logo hover:cursor-pointer hover:scale-110 transition-transform duration-300"/>
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default loginpage