import Image from "next/image";
import Link from "next/link";

import { TORQUE_EMPIRE_BRAND_ASSETS } from "@/lib/branding/identity";
import {
  getCorporateMailto,
  TORQUE_EMPIRE_COMPANY_PROFILE,
} from "@/lib/corporate/companyProfile";
import {
  coreValues,
  corporateDivisions,
  corporateNavItems,
  industriesServed,
  teosOutcomes,
  whyTorqueEmpire,
  type CorporateDivision,
} from "@/lib/corporate/websiteContent";

const profile = TORQUE_EMPIRE_COMPANY_PROFILE;

type PageShellProps = {
  children: React.ReactNode;
};

type PageHeroProps = {
  eyebrow: string;
  title: string;
  copy: string;
  actions?: React.ReactNode;
};

export function CorporateShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#07111f] antialiased">
      <CorporateHeader />
      {children}
      <CorporateFooter />
    </div>
  );
}

export function CorporateHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Torque Empire home">
          <Image
            src={TORQUE_EMPIRE_BRAND_ASSETS.logoPrimaryPng}
            alt="Torque Empire"
            width={176}
            height={56}
            priority
            unoptimized
            className="h-12 w-auto"
          />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {corporateNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-[#0b2f57]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/contact"
          className="rounded-md bg-[#0b2f57] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#07111f]"
        >
          Enquire
        </Link>
      </div>
      <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-slate-200 px-4 py-2 lg:hidden">
        {corporateNavItems.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-3 py-2 text-sm font-semibold text-slate-700">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function CorporateFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.75fr_0.75fr_0.8fr] lg:px-8">
        <div>
          <Image
            src={TORQUE_EMPIRE_BRAND_ASSETS.logoPrimaryPng}
            alt="Torque Empire"
            width={176}
            height={56}
            unoptimized
            className="h-12 w-auto"
          />
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
            {profile.tagline} {profile.companyName} is a South African technology and professional services company.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.socialLinks.map((link) => (
              link.href ? (
                <a key={link.label} href={link.href} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {link.label}
                </a>
              ) : (
                <span key={link.label} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500">
                  {link.label}: Coming Soon
                </span>
              )
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Quick links</h2>
          <div className="mt-4 grid gap-2">
            {corporateNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 hover:text-[#0b2f57]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Divisions</h2>
          <div className="mt-4 grid gap-2">
            {corporateDivisions.map((division) => (
              <Link key={division.slug} href="/our-divisions" className="text-sm font-medium text-slate-600 hover:text-[#0b2f57]">
                {division.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Contact information</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">Government, enterprise, and partner enquiries are welcome.</p>
          <a href={getCorporateMailto("info")} className="mt-3 block text-sm font-bold text-[#0b2f57] underline underline-offset-4">
            {profile.businessEmails.info}
          </a>
          <p className="mt-3 text-sm text-slate-600">Telephone: {profile.telephone}</p>
          <p className="mt-2 text-sm text-slate-600">Service area: {profile.serviceArea}</p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-of-use">Terms of Use</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
        Copyright (c) 2026 Torque Empire (Pty) Ltd. All rights reserved.
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <CorporateShell>
      <main>
        <section className="relative isolate min-h-[calc(100svh-5rem)] overflow-hidden bg-[#07111f] text-white">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/corporate/logo/torque-empire-primary.png"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/login/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[#07111f]/78" />
          <div className="relative mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-100">Torque Empire (Pty) Ltd</p>
            <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-tight tracking-normal sm:text-6xl">
              Four Divisions. One Vision. Total Excellence.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
              Government Ready, Technology Driven, Compliance Focused, Professional Service Delivery, South African Company, and Multi-Division Capability define our operating model. Each division is designed to solve practical operational problems while TEOS strengthens visibility, compliance, and process control.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-md bg-white px-5 py-3 text-sm font-bold text-[#07111f] transition hover:bg-blue-50">
                Contact Torque Empire
              </Link>
              <Link href="/our-divisions" className="rounded-md border border-white/60 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                View divisions
              </Link>
            </div>
          </div>
        </section>

        <Section eyebrow="Credibility" title="Built for professional, compliant, technology-enabled service delivery.">
          <p className="max-w-3xl text-lg leading-8 text-slate-600">
            Government Ready, Technology Driven, Compliance Focused, Professional Service Delivery, South African Company, and Multi-Division Capability are the standards behind our operating model. Each division is designed to solve practical operational problems while TEOS strengthens visibility, compliance, and process control.
          </p>
          <DivisionGrid compact />
        </Section>

        <section className="bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0b2f57]">Technology first</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-normal text-[#07111f] sm:text-4xl">TEOS introduces structure where operations usually fragment.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {teosOutcomes.slice(0, 4).map((outcome) => (
                <div key={outcome} className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-700">
                  {outcome}
                </div>
              ))}
            </div>
          </div>
        </section>

        <Section eyebrow="Why choose us" title="Built for credibility, governance, and delivery.">
          <div className="grid gap-4 md:grid-cols-2">
            {whyTorqueEmpire.map((reason) => (
              <div key={reason} className="rounded-md border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
                {reason}
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Industries served" title="Prepared for enterprise, government, and operational environments.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {industriesServed.map((industry) => (
              <div key={industry} className="rounded-md border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
                {industry}
              </div>
            ))}
          </div>
        </Section>
        <CtaBand />
      </main>
    </CorporateShell>
  );
}

export function AboutPage() {
  return (
    <CorporateShell>
      <main>
        <PageHero
          eyebrow="About us"
          title="A growth-focused South African company building reliable services and business technology."
          copy="Torque Empire (Pty) Ltd exists to connect disciplined service delivery with modern operating systems, helping organisations improve how work is planned, tracked, and delivered."
        />
        <Section eyebrow="Vision and mission" title="Professional execution with technology at the centre.">
          <div className="grid gap-6 lg:grid-cols-2">
            <TextPanel title="Vision" copy="To become a trusted multi-division company known for operational excellence, responsible growth, and technology-led service delivery." />
            <TextPanel title="Mission" copy="To deliver practical services and digital systems that help organisations simplify operations, improve compliance, and create measurable value." />
          </div>
        </Section>
        <Section eyebrow="Core values" title="The standards behind the company.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((value) => (
              <TextPanel key={value.title} title={value.title} copy={value.copy} />
            ))}
          </div>
        </Section>
        <Section eyebrow="Founder / Director" title="Building partnerships through disciplined delivery and technology-led operations.">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <VisualPanel label="Executive leadership and stakeholder engagement" tone="blue" />
            <div className="grid content-center gap-5">
              <p className="text-lg leading-8 text-slate-700">
                Torque Empire is being built for organisations that require reliable partners, clear governance, and practical execution. Our focus is long-term value: stronger service delivery, better operating visibility, and relationships based on trust and accountability.
              </p>
              <p className="text-lg leading-8 text-slate-700">
                We invest in technology because operational excellence should be visible, measurable, and easier to manage. That approach supports clients, suppliers, communities, and the wider economy through more structured participation and delivery.
              </p>
            </div>
          </div>
        </Section>
        <Section eyebrow="Growth and impact" title="Building capability that can serve clients and communities.">
          <div className="grid gap-6 lg:grid-cols-2">
            <TextPanel title="Growth strategy" copy="Strengthen each division, standardise delivery methods, use TEOS to improve operating discipline, and build partnerships that support sustainable expansion." />
            <TextPanel title="Community impact" copy="Create opportunities through service delivery, cleaner environments, stronger supplier participation, and digital capability that helps organisations work better." />
          </div>
        </Section>
      </main>
    </CorporateShell>
  );
}

export function DivisionsPage() {
  return (
    <CorporateShell>
      <main>
        <PageHero
          eyebrow="Our divisions"
          title="Focused service lines backed by one operating vision."
          copy="Torque Empire is structured around four complementary divisions that address practical business needs while building a stronger technology-enabled service model."
        />
        <Section eyebrow="Divisions" title="Professional capability across key operating areas.">
          <div className="grid gap-6">
            {corporateDivisions.map((division, index) => (
              <DivisionFeature key={division.slug} division={division} reverse={index % 2 === 1} />
            ))}
          </div>
        </Section>
      </main>
    </CorporateShell>
  );
}

export function TeosPage() {
  return (
    <CorporateShell>
      <main>
        <PageHero
          eyebrow="TEOS platform"
          title="Business operations need structure, visibility, and control."
          copy="TEOS helps organisations improve operational visibility, compliance evidence, workflow management, decision support, and business efficiency without exposing unnecessary technical architecture."
        />
        <Section eyebrow="Business outcomes" title="What TEOS helps organisations improve.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teosOutcomes.map((outcome) => (
              <div key={outcome} className="rounded-md border border-slate-200 bg-white p-6 font-semibold leading-6 text-slate-700 shadow-sm">
                {outcome}
              </div>
            ))}
          </div>
        </Section>
        <section className="bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0b2f57]">Platform position</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-normal text-[#07111f] sm:text-4xl">Built to support better management, not expose complexity.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-700">
                TEOS is presented to clients as a practical business operating platform. It supports structured records,
                clearer process ownership, better compliance visibility, and more informed management decisions.
              </p>
            </div>
            <VisualPanel label="Operational dashboards and compliance workflow views" tone="teal" />
          </div>
        </section>
        <CtaBand title="Use TEOS to bring order to operational work." copy="Start with the business process that needs the most visibility, then scale from there." />
      </main>
    </CorporateShell>
  );
}

export function WhyPage() {
  return (
    <CorporateShell>
      <main>
        <PageHero
          eyebrow="Why Torque Empire"
          title="A professional partner for organisations that value preparation, governance, and delivery."
          copy="Torque Empire combines practical services with a technology-first operating model, giving clients a partner that understands both field delivery and process control."
        />
        <Section eyebrow="Selection factors" title="The case for Torque Empire.">
          <div className="grid gap-5 lg:grid-cols-2">
            {whyTorqueEmpire.map((reason) => (
              <TextPanel key={reason} title={reason} copy="This supports clearer execution, stronger accountability, and more professional engagement with stakeholders." />
            ))}
          </div>
        </Section>
        <Section eyebrow="Government-ready" title="Prepared for formal stakeholder environments.">
          <div className="grid gap-6 lg:grid-cols-3">
            <TextPanel title="Clear positioning" copy="A concise multi-division company story with TEOS as the technology platform." />
            <TextPanel title="Documented services" copy="Service categories are presented clearly for procurement, operations, and partnership discussions." />
            <TextPanel title="Scalable model" copy="The company can grow through structured divisions while keeping operational visibility central." />
          </div>
        </Section>
      </main>
    </CorporateShell>
  );
}

export function ContactPage() {
  const profile = TORQUE_EMPIRE_COMPANY_PROFILE;

  return (
    <CorporateShell>
      <main>
        <PageHero
          eyebrow="Contact"
          title="Start a focused conversation with Torque Empire."
          copy="For government, enterprise, supplier, and partnership enquiries, contact Torque Empire with the division or business need you want to discuss."
          actions={<Link href={getCorporateMailto("info", "Corporate enquiry")} className="rounded-md bg-white px-5 py-3 text-sm font-bold text-[#07111f]">Email Torque Empire</Link>}
        />
        <Section eyebrow="Enquiries" title="Route the conversation clearly.">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-extrabold text-[#07111f]">Corporate enquiries</h2>
              <dl className="mt-5 grid gap-4 text-sm text-slate-700">
                <div>
                  <dt className="font-bold text-slate-900">Email</dt>
                  <dd className="mt-1"><a className="text-[#0b2f57] underline underline-offset-4" href={getCorporateMailto("info")}>{profile.businessEmails.info}</a></dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Company</dt>
                  <dd className="mt-1">{profile.companyName}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Telephone</dt>
                  <dd className="mt-1">{profile.telephone}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Service area</dt>
                  <dd className="mt-1">{profile.serviceArea}</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-900">Business enquiries</dt>
                  <dd className="mt-1">Procurement, hygiene and waste management, telecommunications, TEOS, partnerships, and corporate service delivery.</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-xl font-extrabold text-[#07111f]">When contacting us, include</h2>
              <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-700">
                <li>Your organisation and role.</li>
                <li>The division or service area you want to discuss.</li>
                <li>The operational challenge or opportunity.</li>
                <li>Any meeting deadline or procurement timeline.</li>
              </ul>
            </div>
          </div>
        </Section>
      </main>
    </CorporateShell>
  );
}

function PageHero({ eyebrow, title, copy, actions }: PageHeroProps) {
  return (
    <section className="bg-[#07111f] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-100">{eyebrow}</p>
        <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{copy}</p>
        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#f7f4ee]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#0b2f57]">{eyebrow}</p>
        <h2 className="mt-4 max-w-4xl text-3xl font-extrabold tracking-normal text-[#07111f] sm:text-4xl">{title}</h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function TextPanel({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-extrabold text-[#07111f]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
    </article>
  );
}

function DivisionGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {corporateDivisions.map((division) => (
        <article key={division.slug} className="rounded-md border border-slate-200 bg-white shadow-sm">
          <VisualPanel label={division.imageLabel} tone={division.slug === "hygiene-waste" ? "teal" : division.slug === "telecommunications" ? "amber" : "blue"} compact />
          <div className="p-5">
            <h3 className="text-lg font-extrabold text-[#07111f]">{division.name}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{compact ? division.value : division.mission}</p>
            <Link href="/our-divisions" className="mt-5 inline-flex rounded-md border border-[#0b2f57] px-4 py-2 text-sm font-bold text-[#0b2f57]">
              {division.cta}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function DivisionFeature({ division, reverse }: { division: CorporateDivision; reverse?: boolean }) {
  return (
    <article className={`grid gap-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <VisualPanel label={division.imageLabel} tone={division.slug === "hygiene-waste" ? "teal" : division.slug === "telecommunications" ? "amber" : "blue"} />
      <div className="p-6 lg:p-8">
        <h2 className="text-2xl font-extrabold text-[#07111f]">{division.name}</h2>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Mission</p>
        <p className="mt-2 leading-7 text-slate-700">{division.mission}</p>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Services</p>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 sm:grid-cols-2">
          {division.services.map((service) => (
            <li key={service}>{service}</li>
          ))}
        </ul>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-[#0b2f57]">Business value</p>
        <p className="mt-2 leading-7 text-slate-700">{division.value}</p>
        <Link href="/contact" className="mt-6 inline-flex rounded-md bg-[#0b2f57] px-5 py-3 text-sm font-bold text-white">
          {division.cta}
        </Link>
      </div>
    </article>
  );
}

function VisualPanel({ label, tone = "blue", compact = false }: { label: string; tone?: "blue" | "teal" | "amber"; compact?: boolean }) {
  const toneClass = tone === "teal" ? "from-teal-900 via-slate-800 to-slate-950" : tone === "amber" ? "from-amber-900 via-slate-800 to-slate-950" : "from-[#0b2f57] via-slate-800 to-slate-950";
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden bg-gradient-to-br ${toneClass} ${compact ? "min-h-40" : "min-h-80"}`}
    >
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute inset-x-8 bottom-8 rounded-md border border-white/18 bg-white/10 p-4 text-white backdrop-blur">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-100">Operational focus</p>
        <p className="mt-2 text-lg font-extrabold">{label}</p>
      </div>
    </div>
  );
}

function CtaBand({
  title = "Ready to introduce Torque Empire?",
  copy = "Connect with us for a focused discussion about services, partnerships, and technology-enabled delivery.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <section className="bg-[#07111f] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-normal">{title}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-200">{copy}</p>
        </div>
        <Link href="/contact" className="inline-flex rounded-md bg-white px-5 py-3 text-sm font-bold text-[#07111f]">
          Contact Torque Empire
        </Link>
      </div>
    </section>
  );
}
