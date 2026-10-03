import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ShoppingCart, 
  Users, 
  Package, 
  Mic, 
  AlertCircle,
  Loader2,
  X,
  FileText,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { signInWithGoogleOAuth } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface LoginPageProps {
  onLoginSuccess?: (session?: Session | null, user?: User | null) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [providerSetupInfo, setProviderSetupInfo] = useState<{
    projectRef?: string;
    callbackUrl?: string;
    dashboardUrl?: string;
  } | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState<'terms' | 'privacy' | null>(null);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signInWithGoogleOAuth();
      if (result.session) {
        onLoginSuccess?.(result.session, result.user);
        return;
      }

      if (result.error) {
        setErrorMessage(
          result.error.message || 'Unable to complete sign-in with Google. Please try again.'
        );
        setIsLoading(false);
      }
      // Note: If OAuth redirect is initiated, window.location navigates to Google.
    } catch {
      setErrorMessage('A connection error occurred. Please check your network and try again.');
      setIsLoading(false);
    }
  };

  const handleCopyCallbackUri = (uri: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1E232A] flex flex-col justify-between selection:bg-[#E85D43]/20 selection:text-[#E85D43]">
      {/* Background ambient warmth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FFEFEA]/50 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[#F5ECE0]/60 blur-3xl" />
      </div>

      {/* Main Split-Screen Container */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* ================= LEFT COLUMN: Branding & Showcase ================= */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6 sm:space-y-8">
            
            {/* Header: Logo & Eyebrow */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3">
                {/* NotiBook Logo Emblem */}
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#E85D43] text-white shadow-md shadow-[#E85D43]/20">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M19 2H6c-1.2 0-2.4.6-3 1.7C2.4 4.8 2 6.3 2 8v11c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 16H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2z" />
                  </svg>
                </div>
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E232A]">
                  Noti<span className="text-[#E85D43]">Book</span>
                </span>
              </div>

              {/* Eyebrow badge */}
              <div className="pt-2">
                <span className="text-[11px] sm:text-xs font-bold tracking-widest text-[#E85D43] uppercase">
                  AI-POWERED BUSINESS ASSISTANT
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E232A] tracking-tight leading-[1.15]">
                Smarter Business.<br />
                All in One Place<span className="text-[#E85D43]">.</span>
              </h1>

              {/* Description */}
              <p className="text-sm sm:text-base text-[#655E57] max-w-lg leading-relaxed">
                Manage your customers, catalogue, bills and daily business activity, all from one simple workspace.
              </p>
            </div>

            {/* Product Preview Mockups (Faithfully mirroring reference image) */}
            <div className="pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
                
                {/* Main Dashboard Preview Card */}
                <div className="sm:col-span-8 bg-white rounded-3xl p-4 sm:p-5 border border-[#EFE9DF] shadow-md shadow-stone-200/50 space-y-3.5">
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#E85D43] text-white">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 2H6c-1.2 0-2.4.6-3 1.7C2.4 4.8 2 6.3 2 8v11c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 16H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2z" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-[#1E232A]">Noti<span className="text-[#E85D43]">Book</span></span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFEFEA] text-[#E85D43]">
                      Dashboard
                    </span>
                  </div>

                  {/* Dark Greeting Banner */}
                  <div className="bg-[#16212B] rounded-2xl p-3.5 text-white">
                    <p className="text-[11px] text-stone-300 font-medium leading-none">Good morning.</p>
                    <p className="text-sm font-bold mt-1 text-white tracking-tight">Your shop is on track.</p>
                  </div>

                  {/* 2x2 Key Metrics */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF]">
                      <span className="block text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">SALES</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm sm:text-base font-extrabold text-[#1E232A]">₹18,640</span>
                        <span className="text-[10px] font-semibold text-emerald-600">↑ 12%</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF]">
                      <span className="block text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">CUSTOMERS</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm sm:text-base font-extrabold text-[#1E232A]">28</span>
                        <span className="text-[10px] font-semibold text-emerald-600">↑ 5%</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF]">
                      <span className="block text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">YOU RECEIVE</span>
                      <span className="block text-sm sm:text-base font-extrabold text-[#1E232A] mt-0.5">₹7,920</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF]">
                      <span className="block text-[10px] font-bold text-[#8C827A] uppercase tracking-wider">YOU OWE</span>
                      <span className="block text-sm sm:text-base font-extrabold text-[#1E232A] mt-0.5">₹2,160</span>
                    </div>
                  </div>

                  {/* Settled dues banner */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/90 border border-emerald-100 text-[11px] text-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">Outstanding dues: </span>
                      <span>No pending customer dues. All accounts settled!</span>
                    </div>
                  </div>
                </div>

                {/* Right Stacked Mini Widgets */}
                <div className="sm:col-span-4 flex flex-col justify-between gap-2.5">
                  {/* Mini Card 1: Today's Sales */}
                  <div className="flex-1 bg-white rounded-2xl p-3.5 border border-[#EFE9DF] shadow-sm flex flex-col justify-center">
                    <div className="w-7 h-7 rounded-lg bg-[#FFEFEA] text-[#E85D43] flex items-center justify-center mb-1.5">
                      <ShoppingCart size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-[#8C827A]">Today&apos;s Sales</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1E232A]">₹18,640</span>
                      <span className="text-[9px] font-semibold text-emerald-600">↑ 12%</span>
                    </div>
                  </div>

                  {/* Mini Card 2: Customers */}
                  <div className="flex-1 bg-white rounded-2xl p-3.5 border border-[#EFE9DF] shadow-sm flex flex-col justify-center">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                      <Users size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-[#8C827A]">Customers</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1E232A]">28</span>
                      <span className="text-[9px] font-semibold text-emerald-600">↑ 5%</span>
                    </div>
                  </div>

                  {/* Mini Card 3: Stock */}
                  <div className="flex-1 bg-white rounded-2xl p-3.5 border border-[#EFE9DF] shadow-sm flex flex-col justify-center">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
                      <Package size={14} />
                    </div>
                    <span className="text-[10px] font-medium text-[#8C827A]">Stock</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xs sm:text-sm font-bold text-[#1E232A]">12</span>
                      <span className="text-[9px] font-semibold text-rose-500">↓ 2%</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Voice Prompt Badge */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 text-center sm:text-left">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#E85D43] text-white shadow-md shadow-[#E85D43]/25">
                    <Mic size={15} />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#1E232A]">Just say what you need.</span>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-white border border-[#EFE9DF] shadow-2xs text-xs font-medium text-[#655E57] italic">
                  &ldquo;Create a bill for Rahul.&rdquo;
                </div>
              </div>
            </div>

          </div>


          {/* ================= RIGHT COLUMN: Clean White Login Card ================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-3xl sm:rounded-[32px] p-7 sm:p-10 border border-[#EFE9DF] shadow-xl shadow-stone-200/50 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              
              <div className="space-y-6">
                {/* NotiBook Logo at top of Card */}
                <div className="flex items-center justify-center gap-2.5">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#E85D43] text-white shadow-sm shadow-[#E85D43]/20">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M19 2H6c-1.2 0-2.4.6-3 1.7C2.4 4.8 2 6.3 2 8v11c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 16H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2zm0-4H5c-.6 0-1-.4-1-1s.4-1 1-1h13v2z" />
                    </svg>
                  </div>
                  <span className="text-xl font-bold tracking-tight text-[#1E232A]">
                    Noti<span className="text-[#E85D43]">Book</span>
                  </span>
                </div>

                {/* Headings */}
                <div className="text-center space-y-1.5 pt-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E232A] tracking-tight">
                    Welcome back
                  </h2>
                  <p className="text-xs sm:text-sm text-[#655E57]">
                    Sign in to your account to continue.
                  </p>
                </div>

                {/* Provider Setup Helper (Shown if Supabase Google Provider is not enabled) */}
                {providerSetupInfo && (
                  <div className="p-4 rounded-2xl bg-[#FFF9F6] border border-[#F3D7CD] text-xs space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#E85D43] font-bold">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>Google Provider Setup Required</span>
                      </div>
                      <button 
                        onClick={() => setProviderSetupInfo(null)}
                        className="text-stone-400 hover:text-stone-700 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <p className="text-[#655E57] text-[11px] leading-relaxed">
                      Google OAuth is currently switched off in your Supabase project (which triggered <em>&quot;Unsupported provider: provider is not enabled&quot;</em>). Follow these 2 quick steps to enable it:
                    </p>

                    <div className="space-y-2 pt-1 text-[11px] text-[#524B45]">
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-[#E85D43]">1.</span>
                        <span>Open Authentication &gt; Providers in your Supabase Dashboard:</span>
                      </div>

                      {providerSetupInfo.dashboardUrl && (
                        <div className="pl-4">
                          <a
                            href={providerSetupInfo.dashboardUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E85D43] text-white font-semibold text-[11px] hover:bg-[#D94E34] transition-colors shadow-xs"
                          >
                            <span>Open Supabase Auth Providers</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}

                      <div className="flex items-start gap-1.5 pt-1">
                        <span className="font-bold text-[#E85D43]">2.</span>
                        <span>Toggle <strong>Google</strong> to <strong>Enabled</strong> and add your Google credentials.</span>
                      </div>

                      {providerSetupInfo.callbackUrl && (
                        <div className="mt-1.5 p-2 rounded-xl bg-white border border-[#EFE9DF]">
                          <span className="block text-[10px] text-[#8C827A] font-semibold uppercase mb-1">
                            Google Cloud Console Authorized Redirect URI:
                          </span>
                          <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-[#1E232A] break-all">
                            <span>{providerSetupInfo.callbackUrl}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCallbackUri(providerSetupInfo.callbackUrl!)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#FAF7F2] hover:bg-[#EFE9DF] border border-[#EFE9DF] text-[10px] font-sans font-semibold text-[#524B45] shrink-0 cursor-pointer"
                              title="Copy Redirect URI"
                            >
                              {copiedUri ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              <span>{copiedUri ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 text-[10px] text-[#8C827A]">
                      After enabling Google in Supabase, click <strong>Continue with Google</strong> below.
                    </div>
                  </div>
                )}

                {/* Regular Error Banner */}
                {!providerSetupInfo && errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Sign-in Notice</p>
                      <p className="text-rose-700 mt-0.5 leading-relaxed">{errorMessage}</p>
                    </div>
                    <button 
                      onClick={() => setErrorMessage(null)} 
                      className="text-rose-400 hover:text-rose-700 p-0.5 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Primary Authentication Action: Continue with Google */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className={`w-full group relative flex items-center justify-between py-3.5 px-4 sm:px-5 rounded-2xl font-semibold text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-[0.99] shadow-lg shadow-[#E85D43]/25 hover:shadow-xl hover:shadow-[#E85D43]/30 transition-all cursor-pointer ${
                      isLoading ? 'opacity-85 cursor-not-allowed' : ''
                    }`}
                  >
                    {/* Google Logo Container */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin text-[#E85D43]" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Button Text */}
                    <span className="text-sm font-semibold tracking-wide">
                      {isLoading ? 'Connecting with Google...' : 'Continue with Google'}
                    </span>

                    {/* Trailing arrow icon matching reference image */}
                    <ArrowRight size={17} className="text-white/80 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Terms of Service & Privacy Policy Notice */}
                <div className="text-center text-xs text-[#8C827A] pt-4 leading-relaxed">
                  <p>By signing in, you agree to our</p>
                  <p className="mt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowPolicyModal('terms')}
                      className="font-semibold text-[#E85D43] hover:underline cursor-pointer"
                    >
                      Terms of Service
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={() => setShowPolicyModal('privacy')}
                      className="font-semibold text-[#E85D43] hover:underline cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                  </p>
                </div>
              </div>

              {/* Bottom Copyright Text */}
              <div className="pt-8 mt-6 border-t border-[#EFE9DF]/80 text-center text-[11px] text-[#A0988F]">
                <span>&copy; 2026 NotiBook &nbsp;|&nbsp; </span>
                <button 
                  type="button" 
                  onClick={() => setShowPolicyModal('privacy')}
                  className="hover:text-[#1E232A] cursor-pointer"
                >
                  Privacy
                </button>
                <span> &nbsp;|&nbsp; </span>
                <button 
                  type="button" 
                  onClick={() => setShowPolicyModal('terms')}
                  className="hover:text-[#1E232A] cursor-pointer"
                >
                  Terms
                </button>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer Minimalist Strip */}
      <footer className="relative z-10 py-4 text-center text-xs text-[#A0988F] border-t border-[#EFE9DF]/60">
        <span>NotiBook - Smart Business Ledger &amp; Khatabook</span>
      </footer>

      {/* Clean Modal for Terms & Privacy */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#FFEFEA] text-[#E85D43]">
                  {showPolicyModal === 'terms' ? <FileText size={16} /> : <ShieldCheck size={16} />}
                </div>
                <h3 className="text-base font-bold text-[#1E232A]">
                  {showPolicyModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </h3>
              </div>
              <button
                onClick={() => setShowPolicyModal(null)}
                className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-[#655E57] space-y-3 leading-relaxed">
              {showPolicyModal === 'terms' ? (
                <>
                  <p className="font-semibold text-[#1E232A]">1. Agreement to Terms</p>
                  <p>
                    By accessing or using NotiBook, you agree to be bound by these Terms of Service. NotiBook provides digital ledger, customer billing, and shop management solutions for retail merchants and businesses.
                  </p>
                  <p className="font-semibold text-[#1E232A]">2. Account Security &amp; Google Authentication</p>
                  <p>
                    Your account is authenticated using Supabase Google OAuth. You are responsible for maintaining the confidentiality of your Google credentials and for all activities that occur under your merchant workspace.
                  </p>
                  <p className="font-semibold text-[#1E232A]">3. Data Ownership</p>
                  <p>
                    You retain full ownership of all customer records, invoices, catalogues, and financial data recorded in NotiBook.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-[#1E232A]">1. Information We Collect</p>
                  <p>
                    When you sign in with Google through Supabase Auth, we receive basic profile information (such as your name, email address, and profile photo) to personalize your merchant workspace.
                  </p>
                  <p className="font-semibold text-[#1E232A]">2. Business Ledger Data</p>
                  <p>
                    Your entries, customers, invoices, and transactions are stored privately and securely. We do not sell or monetize your business ledger records.
                  </p>
                  <p className="font-semibold text-[#1E232A]">3. Security Standards</p>
                  <p>
                    Authentication sessions are encrypted and managed securely via standard OAuth 2.0 and Supabase Authentication protocols.
                  </p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-[#EFE9DF] flex justify-end">
              <button
                onClick={() => setShowPolicyModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#E85D43] hover:bg-[#D94E34] transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
