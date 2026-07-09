export type CorporateDivision = {
  slug: string;
  name: string;
  mission: string;
  services: string[];
  value: string;
  industries: string[];
  imageLabel: string;
  cta: string;
};

export const corporateNavItems = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Our Divisions", href: "/our-divisions" },
  { label: "TEOS Platform", href: "/teos-platform" },
  { label: "Why Torque Empire", href: "/why-torque-empire" },
  { label: "Contact", href: "/contact" },
] as const;

export const corporateDivisions: CorporateDivision[] = [
  {
    slug: "procurement",
    name: "Procurement",
    mission: "Deliver reliable sourcing, supplier coordination, and procurement support for public and private sector requirements.",
    services: ["Supplier sourcing", "Tender response support", "Commercial documentation", "Vendor coordination", "Compliance file preparation"],
    value: "Reduces procurement friction, improves supplier visibility, and supports disciplined commercial execution for buyers and suppliers.",
    industries: ["Government", "Municipalities", "Construction", "Corporate procurement"],
    imageLabel: "Structured procurement and supplier readiness",
    cta: "Discuss procurement support",
  },
  {
    slug: "hygiene-waste",
    name: "Hygiene & Waste Management",
    mission: "Support cleaner, safer operating environments through structured hygiene, waste, and site service coordination.",
    services: ["Waste collection coordination", "Hygiene service planning", "Site compliance records", "Operational reporting", "Route and service documentation"],
    value: "Helps organisations maintain cleaner facilities, auditable service records, and dependable operating routines.",
    industries: ["Facilities", "Retail sites", "Commercial buildings", "Public sector facilities"],
    imageLabel: "Hygiene operations and controlled site service delivery",
    cta: "Plan hygiene operations",
  },
  {
    slug: "telecommunications",
    name: "Telecommunications",
    mission: "Connect organisations with practical telecommunications support for modern operations and field teams.",
    services: ["Connectivity planning", "Telecoms supplier coordination", "Business communication support", "Implementation oversight", "Field communication readiness"],
    value: "Improves communication reliability and gives teams stronger digital foundations for day-to-day delivery.",
    industries: ["Field services", "SMEs", "Operational sites", "Multi-site organisations"],
    imageLabel: "Network infrastructure and business communications",
    cta: "Review telecoms needs",
  },
  {
    slug: "business-technology",
    name: "Business Technology (TEOS)",
    mission: "Develop technology systems that simplify operations, improve compliance, and make business processes easier to manage.",
    services: ["Business process systems", "Compliance workflows", "Operational dashboards", "Digital transformation support", "Decision-support reporting"],
    value: "Turns operational activity into structured, visible, and measurable business performance without exposing unnecessary system complexity.",
    industries: ["Enterprise operations", "Government programmes", "Supplier ecosystems", "Technology-enabled service businesses"],
    imageLabel: "TEOS business operating platform and dashboard visibility",
    cta: "Explore TEOS",
  },
];

export const industriesServed = [
  "Government and public sector",
  "Facilities and site operations",
  "Procurement and supplier networks",
  "Transport and field services",
  "Technology-enabled small business operations",
  "Commercial service delivery",
  "State owned enterprises",
  "Corporate compliance teams",
];

export const coreValues = [
  {
    title: "Excellence",
    copy: "We treat preparation, documentation, and delivery quality as the baseline for every engagement.",
  },
  {
    title: "Accountability",
    copy: "We structure work so responsibilities, records, and outcomes can be traced and explained.",
  },
  {
    title: "Innovation",
    copy: "We use technology to remove operational friction and help organisations work with more confidence.",
  },
  {
    title: "Service",
    copy: "We focus on practical outcomes for clients, communities, and the teams who depend on reliable execution.",
  },
];

export const credibilitySignals = [
  "Government Ready",
  "Technology Driven",
  "Compliance Focused",
  "Professional Service Delivery",
  "South African Company",
  "Multi-Division Capability",
];

export const whyTorqueEmpire = [
  "Multi-disciplinary service model across procurement, hygiene, telecommunications, and business technology.",
  "Technology-first operating philosophy supported by TEOS.",
  "Professional documentation and governance mindset suited to enterprise and public sector environments.",
  "Practical delivery approach built around visibility, compliance, and measurable value.",
];

export const whySections = [
  {
    title: "Professional Governance",
    copy: "Torque Empire structures engagements with clear ownership, documented scope, controlled handover, and executive-ready communication.",
  },
  {
    title: "Digital Transformation",
    copy: "We help organisations move from fragmented records and manual follow-ups into structured workflows, dashboards, and operational visibility.",
  },
  {
    title: "Operational Excellence",
    copy: "Our delivery model focuses on practical execution, reliable service routines, evidence capture, and clear escalation paths.",
  },
  {
    title: "Compliance",
    copy: "Compliance is treated as an operating discipline through records, registers, access control, approvals, and auditable documentation.",
  },
  {
    title: "Technology",
    copy: "TEOS supports workflow management, compliance visibility, decision support, and business efficiency without exposing clients to unnecessary architecture detail.",
  },
  {
    title: "Long-term Partnerships",
    copy: "We build relationships around trust, measurable progress, and sustainable service delivery instead of once-off transactional engagement.",
  },
];

export const teosOutcomes = [
  "Operational visibility across teams, workspaces, and service lines",
  "Compliance evidence that can be captured, reviewed, and reported",
  "Workflow management from request through completion",
  "Decision support through structured information and dashboards",
  "Digital transformation that respects existing business processes",
  "Business efficiency by reducing fragmented spreadsheets, inboxes, and manual follow-ups",
];
