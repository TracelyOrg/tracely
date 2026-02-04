import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TryItOut from "@/components/TryItOut";
import SocialProof from "@/components/SocialProof";
import DashboardPreview from "@/components/DashboardPreview";
import SdkFeatures from "@/components/SdkFeatures";
import FrameworkSupport from "@/components/FrameworkSupport";
import Integrations from "@/components/Integrations";
import FeatureCards from "@/components/FeatureCards";
import Community from "@/components/Community";
import BottomCta from "@/components/BottomCta";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <TryItOut />
      <SocialProof />
      <DashboardPreview />
      <SdkFeatures />
      <FrameworkSupport />
      <Integrations />
      <FeatureCards />
      <Community />
      <BottomCta />
    </>
  );
}
