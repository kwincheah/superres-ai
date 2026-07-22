import Link from "next/link";
import { ArrowRight, ImagePlus, SlidersHorizontal, Wand2, Zap } from "lucide-react";

const STEPS = [
  {
    id: "01",
    title: "Upload Your Image",
    description: "Drag and drop any low-resolution image into our secure dropzone. We support standard formats like JPEG, PNG, and WebP.",
    icon: ImagePlus,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  {
    id: "02",
    title: "AI Processing",
    description: "Our Real-ESRGAN neural networks analyze your image, intelligently predicting and generating missing pixel data to enhance structural details.",
    icon: Zap,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
  },
  {
    id: "03",
    title: "Compare & Export",
    description: "Use our interactive slider to compare the original and upscaled versions side-by-side. Download the crystal-clear result instantly.",
    icon: SlidersHorizontal,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden flex justify-center">
        <div className="absolute top-[-10%] h-[500px] w-[800px] rounded-full bg-indigo-200/40 blur-[120px]" />
      </div>

      {/* Simplified Header */}
      <header className="relative z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-indigo-600 transition hover:opacity-80">
            <Wand2 className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              SuperRes<span className="text-indigo-600">AI</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
            Sign In
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-4 py-16 md:px-8 lg:py-24">
        
        {/* Hero Section */}
        <div className="mb-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            How SuperRes<span className="text-indigo-600">AI</span> Works
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            We use cutting-edge Generative Adversarial Networks (GANs) to restore and upsample your images without losing quality.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/60">
                <div className="mb-6 flex items-center justify-between">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${step.bg} ${step.color}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="text-4xl font-black text-slate-100">{step.id}</span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="mt-20 flex flex-col items-center rounded-3xl bg-slate-900 px-6 py-12 text-center sm:px-12 w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in-95 duration-700 delay-300 fill-mode-both">
          <h2 className="mb-4 text-3xl font-bold text-white">Ready to enhance your images?</h2>
          <p className="mb-8 text-slate-400">Experience the power of AI upscaling directly in your browser.</p>
          <Link 
            href="/" 
            className="group flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-400 hover:shadow-indigo-500/50"
          >
            <Wand2 className="h-5 w-5" />
            Try it for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

      </main>
    </div>
  );
}