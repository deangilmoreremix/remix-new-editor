// Custom-branded Sign Up Page — app chrome (header + dark theme) wrapping
// Clerk's prebuilt <SignUp> component. The prebuilt component natively handles
// the email-verification step required by the instance config
// (verify_at_sign_up = true, email_code strategy) AND renders the Smart CAPTCHA
// (bot protection) widget that the previous custom form was missing — which was
// causing every sign-up attempt to be rejected. Requires a <ClerkProvider>
// ancestor (provided by ClerkGate in ClerkAuth.jsx).

import React from 'react';
import { SignUp } from '@clerk/react';
import { clerkAppearance } from '../auth/clerkAppearance.js';

export function SignUpPage() {
  return (
    <div
      className="signup-page min-h-screen bg-[#020205] flex flex-col"
      lang={document.documentElement.lang || 'en'}
    >
      {/* Header */}
      <header className="sticky top-0 z-50 w-full h-16 backdrop-blur-md bg-[#0a0b0f] border-b border-white/10">
        <nav className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[auto_1fr_auto] pr-4 h-full items-center relative container">
          <a href="#/apps" onClick={(e) => handleNavClick(e, 'apps')} className="shrink-0 flex items-center gap-2 transition hover:text-[#22d3ee] active:opacity-60">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10" style={{ boxShadow: '0 0 16px rgba(56,189,248,0.12)' }}>
              <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
                <rect width="80" height="80" rx="16" fill="#22d3ee" />
                <path d="M32 22 L58 40 L32 58 Z" fill="#020205" />
              </svg>
            </div>
            <span className="hidden md:block text-lg font-bold text-white">Timeline Editor</span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <a href="#/explore" onClick={(e) => handleNavClick(e, 'explore')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Explore</a>
            <a href="#/image" onClick={(e) => handleNavClick(e, 'image')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Image</a>
            <a href="#/video" onClick={(e) => handleNavClick(e, 'video')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Video</a>
            <a href="#/timeline" onClick={(e) => handleNavClick(e, 'timeline')} className="py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm">Timeline</a>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <a href="/signin" className="px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium">Sign In</a>
            <a href="#/apps" onClick={(e) => handleNavClick(e, 'apps')} className="px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Home</a>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Start Your Journey</h1>
            <p className="text-slate-400">Create your account and start creating</p>
          </div>
          <SignUp
            routing="hash"
            signInUrl="/signin"
            afterSignInUrl="/#/image"
            afterSignUpUrl="/#/image"
            appearance={clerkAppearance}
          />
        </div>
      </main>
    </div>
  );
}
