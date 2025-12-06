import { Bug, Code, DollarSign, Lock, Lightbulb, ChevronLeft, ChevronRight, Shield, Search } from 'lucide-react'
import logo from '../assets/icon_audits.png'

interface HomePageProps {
  onGetStarted: () => void
  onScanContract: () => void
}

export default function HomePage({ onGetStarted, onScanContract }: HomePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1f] via-[#0d1426] to-[#0a0f1f] relative overflow-hidden">
      {/* Tech Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#00ffff]/20 bg-[#0a0f1f]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <img src={logo} alt="UatuAudit Logo" className="w-12 h-12" />
            <span className="text-2xl font-bold text-white tracking-tight">UatuAudit</span>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* 3 Steps Section */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-white text-center mb-12">3 Steps to Audit</h2>

          <div className="grid grid-cols-3 gap-6 mb-8">
            {/* Step 1 - Active */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00ffff]/20 to-[#00ffff]/5 rounded-2xl blur-lg group-hover:blur-xl transition-all" />
              <div className="relative border-2 border-[#00ffff] bg-[#0a0f1f]/90 backdrop-blur-sm rounded-2xl p-8 aspect-square flex flex-col items-center justify-center">
                <div className="text-sm text-[#00ffff] font-medium mb-4">Step 01: Connect Source</div>
                <div className="w-24 h-24 rounded-full bg-[#00ffff]/10 border-2 border-[#00ffff] flex items-center justify-center mb-4">
                  <Bug className="w-12 h-12 text-[#00ffff]" />
                </div>
              </div>
            </div>

            {/* Step 2 - Inactive */}
            <div className="relative">
              <div className="border border-gray-700/50 bg-[#1a1f2e]/50 backdrop-blur-sm rounded-2xl p-8 aspect-square flex flex-col items-center justify-center">
                <div className="text-sm text-gray-500 font-medium mb-4">Step 02: Configure</div>
                <div className="w-24 h-24 rounded-full bg-gray-800/30 border-2 border-gray-700 flex items-center justify-center mb-4">
                  <Code className="w-12 h-12 text-gray-600" />
                </div>
              </div>
            </div>

            {/* Step 3 - Inactive */}
            <div className="relative">
              <div className="border border-purple-900/50 bg-gradient-to-br from-purple-950/30 to-[#1a1f2e]/50 backdrop-blur-sm rounded-2xl p-8 aspect-square flex flex-col items-center justify-center">
                <div className="text-sm text-purple-400/60 font-medium mb-4">Step 02: Report</div>
                <div className="w-24 h-24 rounded-full bg-purple-900/20 border-2 border-purple-800/50 flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-purple-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <button className="p-2 text-[#00ffff] hover:bg-[#00ffff]/10 rounded transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 max-w-2xl h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-[#00ffff] to-[#00ffff]/50 rounded-full" />
            </div>
            <button className="p-2 text-gray-600 hover:bg-gray-800/30 rounded transition-colors">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Hero Text & CTA */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-white mb-6">
              Secure your smart contracts.
            </h1>
            <p className="text-xl text-gray-400 mb-10">
              Connect your repository to initiate AI-driven vulnerability analysis
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff] to-[#00e6e6] rounded-xl blur-md group-hover:blur-lg transition-all opacity-50" />
                <div className="relative bg-[#00ffff] hover:bg-[#00e6e6] text-[#0a0f1f] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-3">
                  <Shield className="w-5 h-5" />
                  Authorize GitHub Access
                </div>
              </button>

              <span className="text-gray-500 font-medium">or</span>

              <button
                onClick={onScanContract}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#00ffff]/20 to-[#00e6e6]/20 rounded-xl blur-md group-hover:blur-lg transition-all opacity-50" />
                <div className="relative border-2 border-[#00ffff] bg-transparent hover:bg-[#00ffff]/10 text-[#00ffff] px-8 py-4 rounded-xl font-semibold text-lg transition-all flex items-center gap-3">
                  <Search className="w-5 h-5" />
                  Scan Deployed Contract
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Comprehensive Audit Capabilities */}
        <div>
          <h2 className="text-4xl font-bold text-white mb-4">Comprehensive Audit Capabilities</h2>
          <p className="text-gray-400 text-lg mb-12">
            Our AI-powered engine rigorously every line line code to safeguard your Web3 assets.
          </p>

          <div className="grid grid-cols-4 gap-6">
            {/* Card 1 - Vulnerability Detection (Cyan) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-[#00ffff]/10 rounded-xl blur-md" />
              <div className="relative border-2 border-[#00ffff]/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-[#00ffff]/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-[#00ffff]/20 flex items-center justify-center mb-4">
                  <Bug className="w-6 h-6 text-[#00ffff]" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Vulnerability Detection</h3>
                <p className="text-gray-400 text-sm">
                  Yoy smart sanet dolor oxit toe consectetud conta doent traseuly.
                </p>
              </div>
            </div>

            {/* Card 2 - Code Quality (Green) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-green-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-green-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-green-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Code Quality & Best Practices</h3>
                <p className="text-gray-400 text-sm">
                  Elevato bower ot tos ferror teur zet adeik lis eliarto retro rehariness.
                </p>
              </div>
            </div>

            {/* Card 3 - Tokenomics (Purple) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-purple-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-purple-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-purple-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Tokenomics & Economic Flaws</h3>
                <p className="text-gray-400 text-sm">
                  Troy cuei sanet dolor defuration sit amerit to divoersion eliaterit temput anzest.
                </p>
              </div>
            </div>

            {/* Card 4 - Tokenomics Duplicate (Purple) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-purple-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-purple-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-purple-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Tokenemics & Economic Flaws</h3>
                <p className="text-gray-400 text-sm">
                  Mus kuon selaer dolor toc conse ota om retario og elarerit enares.
                </p>
              </div>
            </div>

            {/* Card 5 - Gas Optimization (Orange) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-orange-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-orange-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-orange-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Gas Optimization Analysis</h3>
                <p className="text-gray-400 text-sm">
                  Our AI pare uste of bewen nar otus yito lo moet currerix jour starte diets.
                </p>
              </div>
            </div>

            {/* Card 6 - Access Control (Orange) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-orange-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-orange-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-orange-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Access Control Audits</h3>
                <p className="text-gray-400 text-sm">
                  Vitar powered ergine oxit coistrik cer tallis acheart your adoapted.
                </p>
              </div>
            </div>

            {/* Card 7 - Access Control Duplicate (Red) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-red-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-red-500/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-red-500/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Access Control Audits</h3>
                <p className="text-gray-400 text-sm">
                  Der meten coderi slater onine os Antarno Dovato instericante jor ik asu nence does.
                </p>
              </div>
            </div>

            {/* Card 8 - Custom Logic (Yellow) */}
            <div className="relative group h-full">
              <div className="absolute inset-0 bg-yellow-500/10 rounded-xl blur-md" />
              <div className="relative border-2 border-yellow-600/40 bg-[#0a0f1f]/80 backdrop-blur-sm rounded-xl p-6 hover:border-yellow-600/60 transition-all h-full flex flex-col min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
                  <Lightbulb className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Custom Logic Reviews</h3>
                <p className="text-gray-400 text-sm">
                  We disapertreck naik entol tee trall tecendur trabstion ples.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
