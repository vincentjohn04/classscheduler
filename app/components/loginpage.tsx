'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import {useActionState} from 'react'
import { login, signup } from '@/app/api/server/auth/auth'

const LoginPage = () => {
  //Login Action States
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    undefined,
  )
  //Signup Action States
  const [SignupState, signupAction, signupPending] = useActionState(
    signup as unknown as (
      state: {
        errors?: {
          username?: string[]
          email?: string[]
          password?: string[]
        }
        message?: string
      } | undefined,
      formData: FormData,
    ) => Promise<{
      errors?: {
        username?: string[]
        email?: string[]
        password?: string[]
      }
      message?: string
    } | undefined>,
    undefined,
  )
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col  min-w-screen">

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
        <div className="login_card relative grow overflow-hidden flex gap-15 transition-transform ease-in">

          {/* Left Side: Welcome Section */}
          <div className='flex gap-50'>
          <div className="leftSide pl-10 pt-10 flex flex-col gap-2 overflow-y-auto scroll-smooth">
            <div className="pl-17 pb-5">
              <img src="/chronyx.png" alt="chronyx" className=" h-20 w-20 rounded-full" />
            </div>
            <h1 className="text-xl font-bold text-white  font-[Nunito] tracking-wide pl-4">
              Welcome to Chronyx
            </h1>
            <h1 className="text-lg text-white/60 font[Nunito] pl-4 pb-5">Your Intelligent Scheduler</h1>
            <p className="text-white/40 pl-8 text-[14px] mt-15">Don&apos;t have an account yet?</p>
            <div className="flex flex-col gap-4 ml-10 bg-white w-fit rounded-lg hover:bg-gray-300 hover:scale-105 transition-all duration-300">
              <button
                id="Sign_up"
                type="button"
                onClick={() => setIsSignUpOpen(true)}
                className="text-lg font-[Nunito] text-[#5D1A25] px-5 py-2 hover:scale-105 hover:cursor-pointer hover:font-bold transition-all duration-300"
              >
                Create Account
              </button>
            </div>
          </div>
          
          {/* isSignUp = false*/}
          <div>
            <div className="leftSide pl-10 pt-10 flex flex-col gap-2 overflow-y-auto scroll-smooth">
            <div className="pl-17 pb-5">
              <img src="/chronyx.png" alt="chronyx" className=" h-20 w-20 rounded-full" />
            </div>
            <h1 className="text-xl font-bold text-white  font-[Nunito] tracking-wide pl-4">
              Welcome to Chronyx
            </h1>
            <h1 className="text-lg text-white/60 font[Nunito] pl-4 pb-5">Your Intelligent Scheduler</h1>
            <p className="text-white/40 pl-8 text-[14px] mt-15">Don&apos;t have an account yet?</p>
            <div className="flex flex-col gap-4 ml-10 bg-white w-fit rounded-lg hover:bg-gray-300 hover:scale-105 transition-all duration-300">
              <button
                id="Sign_up"
                type="button"
                onClick={() => setIsSignUpOpen(false)}
                className="text-lg font-[Nunito] text-[#5D1A25] px-5 py-2 hover:scale-105 hover:cursor-pointer hover:font-bold transition-all duration-300"
              >
                Login
              </button>
            </div>
          </div>
          </div>
          </div>
          

          {/* Right Side: Login or Sign Up Form */}

          <div className={`loginform form absolute bg-white h-full w-6/10 rounded-lg flex flex-col overflow-y-auto scroll-smooth transition-transform duration-700 ease-in-out ${isSignUpOpen ? '-translate-x-0' : 'translate-x-3/4'}`}>
            <div className="mx-20 my-10">
              {isSignUpOpen ? (
                <>
                  <h1 className="text-[#5D1A25] font-extrabold font-[Nunito] text-3xl">Sign Up</h1>
                  <form action={signupAction}>
                    <div>
                      <label htmlFor="text" className='block text-[#5D1A25] font-[Nunito] text-lg mt-5'>username</label>
                      <input type="text" id="username" name='username' className='w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]' />
                    </div>
                    {SignupState?.errors?.username && <p>{SignupState.errors.username}</p>}
                    <div>
                      <label htmlFor="email" className='block text-[#5D1A25] font-[Nunito] text-lg mt-5'>email</label>
                      <input type="email" id='email' name='email' className='w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]' />
                    </div>
                    {SignupState?.errors?.email && <p>{SignupState.errors.email}</p>}
                    <div>
                      <label htmlFor="password" className='block text-[#5D1A25] font-[Nunito] text-lg mt-5'>password</label>
                      <input type="password" id='password' name='password' className='w-full border border-gray-300 rounded-md px-3 py-2 mr-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]' />
                    </div>
                    {SignupState?.errors?.password && (
                      <div>
                        <p>Password must:</p>
                        <ul>
                          {SignupState.errors.password.map((error) => (
                            <li key={error}>- {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {SignupState?.message && (
                      <p className="mt-3 text-red-600">{SignupState.message}</p>
                    )}
                    <div>
                      <button disabled={signupPending} type='submit' className='bg-[#5D1A25] text-white font-[Nunito] px-4 py-2 rounded-md mt-5 hover:scale-105 transition-all duration-300'>Sign Up</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h1 className="text-[#5D1A25] font-extrabold font-[Nunito] text-3xl">Login</h1>
                  <form action={loginAction}>
                    <div>
                      <label htmlFor="email" className="block text-[#5D1A25] font-[Nunito] text-lg mt-5">Email</label>
                      <input type="email" id="email" name="email" className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]" />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-[#5D1A25] font-[Nunito] text-lg mt-5">Password</label>
                      <input type="password" id="password" name="password" className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-[#5D1A25]" />
                    </div>
                    {loginState?.errors && (
                      <div className="text-red-500">
                        {loginState.errors.email?.map((error) => <p key={error}>{error}</p>)}
                        {loginState.errors.password?.map((error) => <p key={error}>{error}</p>)}
                      </div>
                    )}
                    <div>
                      <button disabled={loginPending} type="submit" className="bg-[#5D1A25] text-white font-[Nunito] px-4 py-2 rounded-md mt-5 hover:scale-105 transition-all duration-300">{loginPending ? 'Logging in...' : 'Login'}</button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default LoginPage