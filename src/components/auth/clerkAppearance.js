// Shared appearance for every prebuilt Clerk surface (<SignIn>, <SignUp>,
// <UserButton>). The prebuilt components natively handle password sign-in,
// email-code verification, the forgot/reset-password flow, and Smart CAPTCHA
// (bot protection) — all of which the previous custom forms were missing.
// This appearance keeps the app's dark + cyan brand.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#22d3ee',
    colorText: '#ffffff',
    colorTextSecondary: '#94a3b8',
    colorBackground: '#0a0b0f',
    colorInputBackground: '#0f172a',
    colorInputText: '#ffffff',
    colorNeutral: '#ffffff',
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-2xl',
    card: 'bg-white/5 backdrop-blur-xl border border-white/10',
    headerTitle: 'text-white',
    headerSubtitle: 'text-slate-400',
    socialButtonsBlockButton: 'border-white/10 text-white hover:bg-white/10',
    dividerLine: 'bg-white/10',
    dividerText: 'text-slate-400',
    formFieldLabel: 'text-white',
    formFieldInput:
      'bg-slate-800/50 border-white/10 text-white placeholder-slate-400',
    formButtonPrimary:
      'bg-cyan-400 hover:bg-cyan-300 text-[#020205] font-bold normal-case',
    footerActionText: 'text-slate-300',
    footerActionLink: 'text-cyan-400 hover:text-cyan-300',
    footer: 'bg-transparent',
  },
};
