// Landing page shell (feature 007, T043).
//
// A single scrolling page with no router: it is one document, and adding routing
// to it would mean the prerender has to enumerate them. The only navigation off
// this page goes to the application, on another origin.
//
// Order is the argument it makes: what is this → what does it do → how does it
// work → who is it for → proof it works → real places → sign in. The showcase
// sits late on purpose, so a visitor who never sees it (FR-009a) has already
// been told everything that matters.
import { Hero } from './sections/Hero';
import { TopBar } from './sections/TopBar';
import { WhatIsSVTrip } from './sections/WhatIsSVTrip';
import { HowItWorks } from './sections/HowItWorks';
import { Audiences } from './sections/Audiences';
import { Testimonials } from './sections/Testimonials';
import { Showcase } from './sections/Showcase';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <div id="top" className="min-h-[100dvh] bg-bg">
      <TopBar />
      <main>
        <Hero />
        <WhatIsSVTrip />
        <HowItWorks />
        <Audiences />
        <Testimonials />
        <Showcase />
      </main>
      <Footer />
    </div>
  );
}
