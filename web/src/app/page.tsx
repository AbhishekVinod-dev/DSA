import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import AnalyticsPipeline from '@/components/AnalyticsPipeline';
import Features from '@/components/Features';
import DatasetTelemetry from '@/components/DatasetTelemetry';
import ScreensSection from '@/components/ScreensSection';
import AboutSection from '@/components/AboutSection';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#FBF5DD] text-[#0E4225] selection:bg-emerald-600 selection:text-white">
      <Navbar />
      <Hero />
      <AnalyticsPipeline />
      <Features />
      <DatasetTelemetry />
      <ScreensSection />
      <AboutSection />
      <Footer />
    </main>
  );
}
