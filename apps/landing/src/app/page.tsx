import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

import { HeroScrubFrames } from "./hero-scrub";

const DASHBOARD_URL = "/dashboard";
const CONTACT_EMAIL = "info@sarvodayaconnect.com";

const navLinks = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#status", label: "Status" },
  { href: "#team", label: "Team" },
];

const problems = [
  {
    title: "Records In Many Places",
    body: "Society profiles, council details and membership lists live on paper and in separate files at each level.",
  },
  {
    title: "Unclear Submission Status",
    body: "Officers can't easily see whether a document was received, is being reviewed or was sent back.",
  },
  {
    title: "Slow Follow-Up",
    body: "District and national staff rely on calls and visits to find out which societies need support.",
  },
  {
    title: "Hard To Plan Nationally",
    body: "Building one consistent national picture from scattered records takes time and effort.",
  },
];

const levels = [
  {
    step: "01",
    role: "Society Officers",
    channel: "Mobile App",
    body: "Keep the society profile, council and members up to date, submit documents and activity reports, and see what needs attention next.",
  },
  {
    step: "02",
    role: "District Staff",
    channel: "Web Dashboard",
    body: "Review submissions from societies in their district, return items with clear notes, and spot societies that need support.",
  },
  {
    step: "03",
    role: "National Administrators",
    channel: "Web Dashboard",
    body: "See the national registry and approved cross-district information for coordination and planning.",
  },
];

const features: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "registry",
    title: "Society Registry",
    body: "A single, verified profile for every village society, with council and contact details.",
  },
  {
    icon: "members",
    title: "Membership Records",
    body: "Add, update and track society members without re-entering paperwork.",
  },
  {
    icon: "document",
    title: "Document Submission & Review",
    body: "Upload documents from the field and follow them through district and national review.",
  },
  {
    icon: "activity",
    title: "Activity Reporting",
    body: "Report society activities by sector so progress is visible beyond the village.",
  },
  {
    icon: "bell",
    title: "Notifications & Reminders",
    body: "Know what is due, what was returned and what was approved, right when it happens.",
  },
  {
    icon: "shield",
    title: "Role-Based Access",
    body: "Everyone sees only what their role needs, from a single society up to the national view.",
  },
];

const roadmap = [
  {
    label: "Now",
    title: "Building",
    body: "Mobile app, web dashboard and API are under active development, with role-based workflows in place.",
    current: true,
  },
  {
    label: "Next",
    title: "Pilot",
    body: "Trial with selected village societies and district centres to validate the workflows with real users.",
    current: false,
  },
  {
    label: "Later",
    title: "Rollout",
    body: "Secure cloud deployment and gradual rollout across Sarvodaya district centres.",
    current: false,
  },
];

// Sarvodaya's five-stage village development model, as shown in the illustration.
const stages: { numeral: string; title: string; body: string; icon: IconName; color: string }[] = [
  {
    numeral: "I",
    title: "Psychological Infrastructure Development",
    body: "Building the foundational mindset and social cohesion for community progress.",
    icon: "brain",
    color: "#1f5f7a",
  },
  {
    numeral: "II",
    title: "Social Infrastructure Development And Training",
    body: "Establishing community structures and providing necessary skills and education.",
    icon: "members",
    color: "#2f8a45",
  },
  {
    numeral: "III",
    title: "Satisfaction Of Basic Human Needs & Institutional Development",
    body: "Ensuring access to essentials like food and shelter, while building formal community bodies.",
    icon: "institution",
    color: "#ec8a1c",
  },
  {
    numeral: "IV",
    title: "Income & Employment Generation And Self-Financing",
    body: "Creating sustainable local economies and financial independence for the village.",
    icon: "chart",
    color: "#df5a20",
  },
  {
    numeral: "V",
    title: "Sharing With Neighbouring Villages",
    body: "Extending knowledge and resources to help other communities develop.",
    icon: "sprout",
    color: "#c22a2a",
  },
];

type Person = {
  name: string;
  role: string;
  /** Path under public/, e.g. "/team/jane.jpg". Leave empty to show a placeholder. */
  photo?: string;
  /** Round the photo's bottom corners, for photos cropped mid-body. */
  roundedPhoto?: boolean;
  /** LinkedIn profile URL, shown as a link under the role. */
  linkedin?: string;
};

// Sarvodaya staff initiating the project.
const sarvodayaLeads: Person[] = [
  {
    name: "Niven Ganegama",
    role: "Executive Committee Member & Project Lead, Sarvodaya Connect",
    photo: "/team/niven-ganegama.png",
    linkedin: "https://www.linkedin.com/in/niven-ganegama/",
  },
  {
    name: "Damith Kulanayake",
    role: "Executive Director, Sarvodaya Shramadana Movement",
    photo: "/team/damith-kulanayake.png",
    linkedin: "https://www.linkedin.com/in/damith-kulanayake-642217366/",
  },
  {
    name: "Indunil Hiththtiya",
    role: "Field Operations Director, Sarvodaya Shramadana Movement",
    photo: "/team/indunil-hiththtiya.png",
  },
  {
    name: "Supun Silva",
    role: "Head of Sarvodaya Society Unit",
    photo: "/team/supun-silva.png",
  },
  {
    name: "Hasani Hewarathne",
    role: "Coordinator, Sarvodaya Society Unit",
    photo: "/team/hasani-hewarathne.png",
  },
  {
    name: "Ama Liyanaarachchi",
    role: "IT Manager, Sarvodaya IT Unit",
    photo: "/team/ama-liyanaarachchi.png",
  },
];

// STAMPx (Group CS-10) members.
const stampxMembers: Person[] = [
  { name: "Ashwin Jayarahal", role: "Team Leader, STAMPx", photo: "/team/ashwin-jayarahal.png" },
  { name: "Sithara Pasanmith", role: "Member, STAMPx", photo: "/team/sithara-pasanmith.png" },
  { name: "Miththujan Niranjan", role: "Member, STAMPx", photo: "/team/miththujan-niranjan.png" },
];

/** Stagger helper: sets the animation delay offset (ms) used by the motion classes. */
function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

/** Scroll-reveal index: later siblings reveal slightly after earlier ones. */
function order(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

export default function Home() {
  return (
    <>
      <Splash />
      <SiteHeader />
      <main>
        <Hero />
        <Overview />
        <SarvodayaPath />
        <Problem />
        <HowItWorks />
        <Features />
        <Platforms />
        <Status />
        <Team />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}

function Splash() {
  return (
    <div aria-hidden="true" className="splash">
      <div className="flex flex-col items-center gap-5 px-6">
        <Image
          alt=""
          className="splash-logo h-auto w-[260px] md:w-[340px]"
          height={453}
          priority
          src="/brand/sarvodaya-connect-wordmark.png"
          width={1178}
        />
        <span className="block h-[3px] w-40 overflow-hidden rounded-pill bg-line-soft">
          <span className="splash-bar block h-full w-full rounded-pill bg-linear-to-r from-brand-leaf to-orange-splash" />
        </span>
        <p className="splash-tag text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Connecting Every Village Society
        </p>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="header-anim sticky z-50 border-b border-line/70 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:h-[72px] md:px-6">
        <a className="flex items-center" href="#top" aria-label="Sarvodaya Connect home">
          <Image
            alt="Sarvodaya Connect"
            className="h-10 w-auto md:h-12"
            height={453}
            priority
            src="/brand/sarvodaya-connect-wordmark.png"
            width={1178}
          />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              className="group relative rounded-pill px-3.5 py-2 text-sm font-semibold text-ink transition hover:text-brand-pine"
              href={link.href}
              key={link.href}
            >
              {link.label}
              <span className="absolute inset-x-3.5 bottom-1 h-0.5 origin-left scale-x-0 rounded-pill bg-orange-splash transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <a
          className="group inline-flex shrink-0 items-center gap-2 rounded-button bg-brand-action px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(212,86,14,0.7)] transition hover:-translate-y-0.5 hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-orange-ring"
          href={DASHBOARD_URL}
        >
          Go To Dashboard
          <Icon className="size-4 transition-transform group-hover:translate-x-1" name="arrow" />
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    // On wide screens the hero pins while the visitor scrolls through this taller wrapper,
    // and the village video scrubs along with the scroll.
    <div className="lg:h-[calc(200svh-72px)]" data-hero-scrub>
      <section
        className="relative flex flex-col overflow-hidden bg-surface-wash lg:sticky lg:top-[72px] lg:h-[calc(100svh-72px)] lg:flex-row lg:items-center"
        id="top"
      >
        <div className="relative z-20 w-full px-4 pt-14 md:px-6 md:pt-20 lg:py-20 lg:pl-[4vw] lg:pr-0">
          <div className="max-w-[560px] lg:w-[37%] lg:max-w-[500px] xl:w-[34%]">
            <p
              className="rise inline-flex items-center gap-2 rounded-pill bg-surface/80 px-3 py-1.5 text-xs font-semibold text-brand-pine ring-1 ring-brand-mint-ring backdrop-blur"
              style={delay(0)}
            >
              <span className="pulse size-2 rounded-full bg-orange-splash" />
              An Initiative by the Sarvodaya Shramadana Movement
            </p>
            <h1 className="mt-6 text-[38px] font-bold leading-[1.08] tracking-[-0.02em] text-ink text-balance md:text-[50px] lg:text-[38px] xl:text-[42px] 2xl:text-[48px]">
              <span className="rise block" style={delay(120)}>
                One Verified Record
              </span>
              <span className="rise block" style={delay(220)}>
                For Every{" "}
                <span className="relative inline-block whitespace-nowrap text-green-leaf">
                  Village Society.
                  <svg
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 h-3 w-full md:-bottom-3 md:h-4"
                    fill="none"
                    preserveAspectRatio="none"
                    viewBox="0 0 400 16"
                  >
                    <path
                      className="draw"
                      d="M3 11 C 90 3, 210 3, 397 9"
                      stroke="var(--orange-splash)"
                      strokeLinecap="round"
                      strokeWidth="5"
                    />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="rise mt-7 max-w-[540px] text-base leading-7 text-ink-soft md:text-lg" style={delay(380)}>
              Sarvodaya Connect gives village societies and Sarvodaya staff a shared
              digital place to keep records, submit documents and follow reviews,
              from the village to district centres to headquarters.
            </p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={delay(500)}>
              <a
                className="group inline-flex items-center gap-2 rounded-button bg-brand-action px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(212,86,14,0.8)] transition hover:-translate-y-0.5 hover:bg-brand-action-pressed"
                href="#how-it-works"
              >
                See How It Works
                <Icon className="size-4 rotate-90 transition-transform group-hover:translate-y-0.5" name="arrow" />
              </a>
              <a
                className="group inline-flex items-center gap-2 rounded-button border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-brand-mint-ring hover:bg-brand-mint-soft"
                href={DASHBOARD_URL}
              >
                Staff Sign-In
                <Icon className="size-4 transition-transform group-hover:translate-x-1" name="arrow" />
              </a>
            </div>
          </div>
        </div>

        <HeroVideo />
      </section>
    </div>
  );
}

/**
 * The animated Sarvodaya village. On wide screens it fills the whole first screen, with a
 * light veil on the left behind the text; on phones it sits under the text. The still
 * frame shows while the video loads, and for anyone who prefers reduced motion.
 */
function HeroVideo() {
  return (
    <div
      aria-hidden="true"
      className="hero-media rise pointer-events-none relative mt-10 aspect-video w-full lg:absolute lg:inset-0 lg:mt-0 lg:aspect-auto"
      style={delay(300)}
    >
      <Image
        alt=""
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src="/photos/sarvodaya-village-poster.jpg"
      />
      <HeroScrubFrames base="/hero-frames/" count={43} />
      <div className="hero-veil absolute inset-0 hidden lg:block" />
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  tone = "canvas",
  photo,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: "canvas" | "surface";
  photo?: BackdropPhotoProps;
  children: ReactNode;
}) {
  return (
    <section
      className={`relative scroll-mt-16 overflow-hidden ${tone === "surface" ? "bg-surface" : "bg-canvas"}`}
      id={id}
    >
      {photo && <BackdropPhoto {...photo} />}
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="reveal">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-deep">
            <span className="h-px w-6 bg-orange-splash" />
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-[680px] text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink text-balance md:text-[40px]">
            {title}
          </h2>
          {intro && <p className="mt-4 max-w-[620px] text-base leading-7 text-ink-soft">{intro}</p>}
        </div>
        <div className="mt-12 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

type BackdropPhotoProps = {
  src: string;
  /** CSS object-position, to keep the subject in view. */
  position?: string;
  /** "light" fades a soft photo into a light section; "dark" tints it into a green one. */
  tone?: "light" | "dark";
  /** Start the photo below the section's top edge, leaving a plain strip above it. */
  gapTop?: boolean;
};

/** A faded community photo behind a section, kept clear of the text. */
function BackdropPhoto({ src, position = "center", tone = "light", gapTop = false }: BackdropPhotoProps) {
  return (
    <div
      aria-hidden="true"
      className={`${tone === "dark" ? "backdrop-photo" : "backdrop-photo backdrop-photo-soft"} pointer-events-none absolute ${
        tone === "dark" ? "inset-0" : `${gapTop ? "top-20 md:top-28" : "top-0"} bottom-0 right-0 w-full md:w-[70%]`
      }`}
    >
      <Image
        alt=""
        className={`object-cover ${
          tone === "dark" ? "opacity-40 mix-blend-luminosity grayscale" : "opacity-25 saturate-[0.9] md:opacity-45"
        }`}
        fill
        sizes="100vw"
        src={src}
        style={{ objectPosition: position }}
      />
    </div>
  );
}

function Overview() {
  return (
    <Section
      eyebrow="Watch The Overview"
      id="overview"
      intro="A one-minute look at how village societies, district centres and headquarters work from one trusted record. Prepared for the Sarvodaya AGM."
      title="Sarvodaya Connect In One Minute."
    >
      <div className="reveal relative mx-auto max-w-4xl">
        <video
          className="relative block aspect-video w-full rounded-tile bg-ink ring-1 ring-black/10 shadow-[0_0_48px_8px_rgba(0,0,0,0.16)]"
          controls
          playsInline
          poster="/video/sarvodaya-connect-agm-poster.jpg"
          preload="metadata"
          src="/video/sarvodaya-connect-agm.mp4"
        >
          Your browser can&apos;t play this video.
        </video>
      </div>
    </Section>
  );
}

function SarvodayaPath() {
  return (
    <Section
      eyebrow="Our Foundation"
      id="sarvodaya-path"
      intro="Sarvodaya's five-stage model guides every village from a shared awakening to Grama Swaraj, a self-governing village that can lift its neighbours too."
      title="The Sarvodaya Path To Grama Swaraj."
      tone="surface"
    >
      <div className="reveal overflow-hidden rounded-tile">
        <Image
          alt="Illustration of a village's journey through Sarvodaya's five stages, from community gatherings and shared building work to local markets and a thriving self-governing village."
          className="h-auto w-full"
          height={675}
          sizes="(min-width: 1152px) 1104px, 100vw"
          src="/photos/sarvodaya-path.jpg"
          width={1800}
        />
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {stages.map((stage, i) => (
          <li
            className="reveal lift relative overflow-hidden rounded-card border border-line bg-surface p-5"
            key={stage.numeral}
            style={order(i)}
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: stage.color }} />
            <span
              className="flex size-11 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: stage.color }}
            >
              <Icon className="size-5" name={stage.icon} />
            </span>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: stage.color }}>
              Stage {stage.numeral}
            </p>
            <h3 className="mt-1 text-[15px] font-semibold leading-snug text-ink">{stage.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{stage.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Problem() {
  return (
    <Section
      eyebrow="Why It Matters"
      title="Society Records Shouldn't Depend On Paper Trails And Phone Calls."
      intro="Village societies are at the heart of the Sarvodaya movement. Keeping their records accurate and moving between levels is slow today."
      photo={{ src: "/photos/village-meeting.jpg", position: "22% 0%" }}
      tone="surface"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {problems.map((item, i) => (
          <div className="reveal lift rounded-card border border-line bg-surface/90 p-6 backdrop-blur-sm" key={item.title} style={order(i)}>
            <span className="flex size-9 items-center justify-center rounded-full bg-orange-changed-soft text-sm font-bold text-orange-splash">
              {i + 1}
            </span>
            <h3 className="mt-5 text-base font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{item.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section
      eyebrow="How It Works"
      id="how-it-works"
      title="Connecting The Village, The District And Headquarters."
      intro="Each level works in the tool that suits it, on the same shared record."
      photo={{ src: "/photos/farmers.jpg", position: "60% 35%", gapTop: true }}
      tone="surface"
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="line-reveal absolute left-[8%] right-[8%] top-[46px] hidden h-0.5 rounded-pill bg-linear-to-r from-orange-ring via-orange-splash to-orange-deep lg:block"
        />
        <ol className="relative grid gap-5 lg:grid-cols-3">
          {levels.map((level, i) => (
            <li className="reveal lift rounded-tile border border-line bg-surface p-6" key={level.step} style={order(i)}>
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-full bg-orange-splash text-base font-bold text-white ring-6 ring-orange-soft">
                  {level.step}
                </span>
                <span className="rounded-pill bg-orange-soft px-2.5 py-1 text-[11px] font-semibold text-orange-deep">
                  {level.channel}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{level.role}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{level.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section
      eyebrow="Features"
      id="features"
      title="Everything A Society Record Needs, In One Place."
      tone="surface"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => (
          <div
            className="reveal lift group rounded-tile border border-line bg-surface p-6"
            key={feature.title}
            style={order(i % 3)}
          >
            <span className="inline-flex size-12 items-center justify-center rounded-xl bg-orange-soft text-orange-splash transition duration-300 group-hover:rotate-[-6deg] group-hover:scale-110 group-hover:bg-orange-splash group-hover:text-white">
              <Icon className="size-5" name={feature.icon} />
            </span>
            <h3 className="mt-5 text-base font-semibold text-ink">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{feature.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Platforms() {
  return (
    <section className="relative overflow-hidden bg-green-forest text-white">
      <BackdropPhoto position="55% 45%" src="/photos/village-cleanup.jpg" tone="dark" />
      <div aria-hidden="true" className="dots absolute inset-0" />
      <div
        aria-hidden="true"
        className="blob absolute -right-32 -top-32 size-[420px] rounded-full bg-orange-splash/20 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:px-6 md:py-24 lg:grid-cols-2">
        <div className="reveal">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
            <span className="h-px w-6 bg-orange-splash" />
            Mobile and web
          </p>
          <h2 className="mt-3 text-[28px] font-bold leading-tight text-balance md:text-[40px]">
            Built For The Field And The Office.
          </h2>
          <p className="mt-4 max-w-[520px] text-base leading-7 text-white/90">
            Society officers use the mobile app wherever they are. District and
            headquarters staff manage reviews and the registry from the web dashboard.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="reveal rounded-tile bg-white/8 p-6 ring-1 ring-white/25 backdrop-blur transition hover:bg-white/15" style={order(0)}>
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <Icon className="size-6 text-[#ffab70]" name="phone" />
            </span>
            <h3 className="mt-5 font-semibold">Mobile App</h3>
            <p className="mt-2 text-sm leading-6 text-white/85">
              Android and iOS app for society officers and regional staff.
            </p>
          </div>
          <div className="reveal rounded-tile bg-white/8 p-6 ring-1 ring-white/25 backdrop-blur transition hover:bg-white/15" style={order(1)}>
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <Icon className="size-6 text-[#ffab70]" name="monitor" />
            </span>
            <h3 className="mt-5 font-semibold">Web Dashboard</h3>
            <p className="mt-2 text-sm leading-6 text-white/85">
              For district, national and platform administration.
            </p>
            <a
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ffab70] underline-offset-4 hover:underline"
              href={DASHBOARD_URL}
            >
              Go To Dashboard
              <Icon className="size-4 transition-transform group-hover:translate-x-1" name="arrow" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Status() {
  return (
    <Section
      eyebrow="Project Status"
      id="status"
      title="Where We Are Today."
      intro="Sarvodaya Connect is in active development. Here is what's done and what comes next."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {roadmap.map((item, i) => (
          <li
            className={`reveal lift rounded-tile border p-6 ${item.current ? "border-orange-ring bg-orange-soft" : "border-line bg-surface"}`}
            key={item.label}
            style={order(i)}
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${item.current ? "bg-orange-splash text-white" : "bg-line-soft text-muted"}`}
            >
              {item.current && <span className="pulse size-1.5 rounded-full bg-white" />}
              {item.label}
            </span>
            <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{item.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Team() {
  return (
    <Section
      eyebrow="Who's Behind It"
      id="team"
      title="Built With Sarvodaya By The STAMPx Team."
      tone="surface"
    >
      <div className="reveal grid items-center gap-8 rounded-tile border border-line bg-canvas p-6 md:grid-cols-[auto_1fr] md:p-10">
        <div className="flex items-center gap-6">
          <Image
            alt="Sarvodaya Connect"
            className="h-auto w-[150px]"
            height={453}
            src="/brand/sarvodaya-connect-wordmark.png"
            width={1178}
          />
          <span aria-hidden="true" className="h-12 w-px bg-line" />
          <Image
            alt="STAMPx"
            className="h-auto w-[140px]"
            height={724}
            src="/brand/stampx-logo.png"
            width={2172}
          />
        </div>
        <p className="text-base leading-7 text-ink-soft">
          Sarvodaya Connect is developed by Group CS-10 (STAMPx) as a software
          development project at the Informatics Institute of Technology (IIT),
          in collaboration with the Sarvodaya Shramadana Movement in Moratuwa,
          Sri Lanka.
        </p>
      </div>
      <PeopleGroup
        intro="The Sarvodaya team that recognised the need to modernise the Sarvodaya Shramadana Societies Unit, spearheading a digital transformation initiative to strengthen connectivity, streamline operations, and empower grassroots communities through innovation."
        grid
        people={sarvodayaLeads}
        title="From Sarvodaya"
      />
      <PeopleGroup
        intro="The team designing and building the platform."
        people={stampxMembers}
        title="The STAMPx Team"
        tone="green"
      />
    </Section>
  );
}

function PeopleGroup({
  title,
  intro,
  people,
  tone = "orange",
  grid = false,
}: {
  title: string;
  intro: string;
  people: Person[];
  tone?: PlaceholderTone;
  /** Lay the cards out three per row instead of one wrapping row. */
  grid?: boolean;
}) {
  return (
    <div className="mt-14">
      <div className="reveal">
        <h3 className="text-xl font-semibold text-ink md:text-2xl">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{intro}</p>
      </div>
      <ul
        className={
          grid
            ? "mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5"
            : "mt-6 flex flex-wrap justify-center gap-4 md:justify-start"
        }
      >
        {people.map((person, i) => (
          <li
            className={`reveal lift rounded-tile border border-line bg-surface p-3 ${
              grid ? "" : "w-[calc(50%-8px)] sm:w-[200px]"
            }`}
            key={`${title}-${i}`}
            style={order(grid ? i % 3 : i % 5)}
          >
            <PersonPhoto person={person} tone={tone} />
            <p className="mt-3 px-1 text-sm font-semibold text-ink md:text-base">{person.name}</p>
            <p className="px-1 pb-1 text-xs text-muted">{person.role}</p>
            {person.linkedin && (
              <a
                aria-label={`${person.name} on LinkedIn`}
                className="mx-1 mb-1 mt-2 inline-flex items-center gap-1.5 rounded-pill bg-[#0a66c2]/10 px-2.5 py-1 text-xs font-semibold text-[#0a66c2] transition hover:bg-[#0a66c2] hover:text-white"
                href={person.linkedin}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon className="size-3.5" name="linkedin" />
                LinkedIn
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type PlaceholderTone = "orange" | "green";

function PersonPhoto({ person, tone }: { person: Person; tone: PlaceholderTone }) {
  if (person.photo) {
    return (
      <Image
        alt={person.name}
        className={`aspect-[4/5] w-full object-cover object-bottom ${person.roundedPhoto ? "rounded-b-xl" : ""}`}
        height={1508}
        src={person.photo}
        width={1336}
      />
    );
  }
  return (
    <div
      className={`flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${
        tone === "green"
          ? "border-green-mint-ring bg-green-mint-soft text-green-hill-400"
          : "border-brand-mint-ring bg-brand-mint-soft text-hill-400"
      }`}
    >
      <Icon className="size-10" name="user" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Photo</span>
    </div>
  );
}

function Contact() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        <div className="reveal relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-tile bg-green-pine p-8 text-white md:flex-row md:items-center md:p-12">
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(min-width: 1152px) 1104px, 100vw"
            src="/photos/lotus-pond.jpg"
            style={{ objectPosition: "50% 55%" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-r from-green-forest/90 via-green-pine/70 to-green-pine/25"
          />
          <div className="relative">
            <h2 className="text-[26px] font-bold md:text-[34px]">Get In Touch</h2>
            <p className="mt-2 max-w-[520px] text-white/80">
              Questions about Sarvodaya Connect, or interested in joining the pilot?
              We&apos;d like to hear from you.
            </p>
          </div>
          <a
            className="group relative inline-flex items-center gap-2 rounded-button bg-brand-action px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-action-pressed"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            <Icon className="size-4" name="mail" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6">
        <p>© {new Date().getFullYear()} Sarvodaya Connect · Sarvodaya Shramadana Movement, Moratuwa, Sri Lanka</p>
        <div className="flex gap-5">
          <a className="hover:text-brand-leaf" href={DASHBOARD_URL}>Dashboard</a>
          <a className="hover:text-brand-leaf" href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </div>
      </div>
    </footer>
  );
}

type IconName =
  | "activity"
  | "arrow"
  | "bell"
  | "brain"
  | "chart"
  | "check"
  | "document"
  | "institution"
  | "mail"
  | "members"
  | "monitor"
  | "phone"
  | "registry"
  | "shield"
  | "sprout"
  | "user"
  | "linkedin";

const iconPaths: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  brain: <><path d="M9.5 4.5A3 3 0 0 0 6.5 7v.4A3.2 3.2 0 0 0 4.5 13a3.2 3.2 0 0 0 3 4.5c.4 1.4 1.4 2 2.5 2h.5V5a1.5 1.5 0 0 0-1-.5z" /><path d="M14.5 4.5A3 3 0 0 1 17.5 7v.4a3.2 3.2 0 0 1 2 5.6 3.2 3.2 0 0 1-3 4.5c-.4 1.4-1.4 2-2.5 2h-.5V5a1.5 1.5 0 0 1 1-.5z" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-3M12 16v-6M17 16V8" /><path d="m5 10 5-4 3 2 6-4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  document: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>,
  institution: <><path d="M3 9.5 12 4l9 5.5" /><path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20h17" /></>,
  mail: <><rect height="14" rx="2" width="18" x="3" y="5" /><path d="m3 7 9 6 9-6" /></>,
  members: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  monitor: <><rect height="12" rx="2" width="18" x="3" y="4" /><path d="M8 20h8M12 16v4" /></>,
  phone: <><rect height="18" rx="2.5" width="11" x="6.5" y="3" /><path d="M11 17.5h2" /></>,
  registry: <><path d="M3 10 12 4l9 6" /><path d="M5 10v9h14v-9M9 19v-5h6v5" /></>,
  shield: <><path d="M12 3 5 6v5.5c0 4.4 3 7.9 7 9.5 4-1.6 7-5.1 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  sprout: <><path d="M12 20v-7" /><path d="M12 13c0-4 2.8-6.5 7-6.5 0 4-2.8 6.5-7 6.5z" /><path d="M12 13C12 9.6 9.7 7.5 6 7.5c0 3.4 2.3 5.5 6 5.5z" /></>,
  linkedin: <><rect height="16" rx="3" width="16" x="4" y="4" /><path d="M8.5 10.5v5M8.5 8v.01M11.5 15.5v-5M11.5 12.5a2 2 0 0 1 4 0v3" /></>,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}
