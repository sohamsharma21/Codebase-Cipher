import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import TrustSection from '@/components/landing/TrustSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import DemoSection from '@/components/landing/DemoSection';
import WhySection from '@/components/landing/WhySection';
import PricingSection from '@/components/landing/PricingSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <LandingNav />
      <HeroSection />
      <TrustSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoSection />
      <WhySection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
