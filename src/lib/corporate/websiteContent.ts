export type CorporateRoute = {
  label: string;
  href: string;
};

export type CorporateDivision = {
  slug: string;
  name: string;
  shortName: string;
  href: string;
  visualTag: string;
  mission: string;
  summary: string;
  services: string[];
  value: string;
  imageLabel: string;
  imageSrc?: string;
  cta: string;
};

export type ServiceDetail = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  process: string[];
  proofPoints: string[];
  primaryCta: string;
};

export const corporateNavItems: CorporateRoute[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'TEOS', href: '/teos-platform' },
  { label: 'Why Torque Empire', href: '/why-torque-empire' },
  { label: 'Contact', href: '/contact' },
];

export const publicRoutes = ['/', '/about', '/services', '/procurement', '/hygiene', '/telecoms', '/car-sales', '/teos-platform', '/why-torque-empire', '/contact', '/quote', '/privacy-policy', '/terms-of-use'] as const;

export const corporateDivisions: CorporateDivision[] = [
  { slug: 'procurement', name: 'Procurement and Tender Support', shortName: 'Procurement', href: '/procurement', visualTag: 'Tender readiness', mission: 'Support public and private sector procurement work with disciplined sourcing, documentation, readiness checks, and recordkeeping.', summary: 'Tender support, supplier quotation sourcing, compliance preparation, BOQ assistance, SBD document support, and submission administration.', services: ['Tender opportunity support', 'Tender pack preparation', 'Supplier quotation sourcing', 'Compliance document preparation', 'SBD document support', 'BOQ and pricing support', 'Contractor onboarding', 'Submission readiness'], value: 'Improves procurement readiness and reduces administrative friction without promising tender outcomes.', imageLabel: 'Structured procurement planning, supplier readiness, and submission control', cta: 'Discuss procurement support' },
  { slug: 'hygiene', name: 'Hygiene and Sanitary Waste Management', shortName: 'Hygiene', href: '/hygiene', visualTag: 'Controlled service', mission: 'Help clients maintain cleaner, safer, better documented operating environments through scheduled hygiene and sanitary waste service coordination.', summary: 'Sanitary waste collection, bin servicing, manifests, controlled temporary storage, disposal verification, evidence capture, and client reporting.', services: ['Feminine hygiene and sanitary waste collection', 'Scheduled service intervals', 'Bin servicing', 'Collection manifests', 'Controlled temporary storage', 'Disposal verification', 'PPE and handling procedures', 'Client service reporting'], value: 'Creates a clearer service trail for clients who need practical hygiene delivery and auditable records.', imageLabel: 'Hygiene operations, sanitary bins, manifests, and controlled service records', imageSrc: '/images/Hygiene Division Flyer.png', cta: 'Plan hygiene services' },
  { slug: 'telecoms', name: 'Telecommunications Services', shortName: 'Telecoms', href: '/telecoms', visualTag: 'Field connectivity', mission: 'Coordinate practical telecommunications and field support for organisations that need reliable communication infrastructure delivery.', summary: 'Fibre installation support, fibre splicing coordination, civil works support, network infrastructure support, site coordination, and maintenance support.', services: ['Fibre installation support', 'Fibre splicing', 'Civil works support', 'Network infrastructure support', 'Site coordination', 'Maintenance and field support'], value: 'Helps operational teams coordinate telecommunications work with clearer scopes, site control, and communication.', imageLabel: 'Network infrastructure, fibre support, and field coordination', cta: 'Review telecoms needs' },
  { slug: 'car-sales', name: 'Automotive and Car Sales', shortName: 'Car Sales', href: '/car-sales', visualTag: 'Automotive sourcing', mission: 'Support automotive sales activity through vehicle sourcing, dealer collaboration, customer enquiries, and digital workflow capability.', summary: 'Private vehicle sourcing enquiries, sales support, dealer collaboration, customer enquiry handling, vehicle presentation, and marketing workflow support.', services: ['Private vehicle sourcing enquiries', 'Dealer collaboration', 'Customer enquiry coordination', 'Vehicle presentation and marketing', 'Digital automotive workflows', 'Structured handover communication'], value: 'Supports transparent automotive enquiries and partner collaboration while keeping vehicle details subject to direct confirmation.', imageLabel: 'Dealership-neutral automotive sourcing, presentation, and enquiry workflow', imageSrc: '/images/vehicles/bmw-m4-hero.jpg', cta: 'Start an automotive enquiry' },
];

export const teosPlatformSummary = { title: 'TEOS business technology platform', href: '/teos-platform', summary: 'TEOS supports governance, contractor management, document readiness, procurement workflows, hygiene operations, audit trails, and reporting inside the secure application.', services: ['Governance and audit trails', 'Contractor management', 'Document readiness', 'Procurement workflows', 'Hygiene operations', 'Reporting dashboards'] };

export const complianceCredentials = [
  { title: 'CIPC registration', copy: 'Torque Empire is presented as a registered South African company, with company identity evidence handled through controlled engagement records.' },
  { title: 'B-BBEE Level 1 positioning', copy: 'Public-facing material may reference B-BBEE positioning only where it is supported by approved company records and remains subject to current verification.' },
  { title: 'CSD registration', copy: 'Central Supplier Database participation is presented as compliance-ready positioning where supported by current controlled records.' },
  { title: 'SARS compliance positioning', copy: 'Tax compliance is handled as a document-readiness discipline and remains subject to current verification, not an unchecked marketing claim.' },
  { title: 'COIDA / Letter of Good Standing', copy: 'Employee and contractor compliance evidence is tracked for relevant work where required by client scope or tender conditions, subject to current verification.' },
  { title: 'Waste transport approval positioning', copy: 'Hygiene and waste services are presented with controlled transport, manifest, and approval-readiness language, subject to current verification and without exposing certificate identifiers.' },
  { title: 'Waste generator and disposal process', copy: 'Waste movement, temporary storage, disposal verification, and reporting are described as controlled processes with evidence captured where operationally applicable and subject to current records.' },
];

export const whyTorqueEmpire = [
  { title: 'Local operational understanding', copy: 'South African service delivery requires practical coordination, clear documentation, and supplier participation that can withstand formal review.' },
  { title: 'Compliance-driven delivery', copy: 'Compliance is treated as an operating discipline across procurement, hygiene, contractor readiness, and recordkeeping.' },
  { title: 'Digital workflow capability', copy: 'TEOS gives Torque Empire a structured way to manage documents, workspaces, evidence, dashboards, and audit trails.' },
  { title: 'Clear communication', copy: 'Clients, suppliers, and partners need direct scope, documented expectations, and reliable follow-through.' },
  { title: 'Scalable contractor and supplier network', copy: 'The operating model supports growth through controlled onboarding, supplier sourcing, and workspace-based service delivery.' },
];

export const coreValues = [
  { title: 'Excellence', copy: 'Preparation, documentation, and delivery quality are treated as the baseline for every engagement.' },
  { title: 'Accountability', copy: 'Responsibilities, records, and outcomes should be traceable and explainable.' },
  { title: 'Innovation', copy: 'Technology is used to reduce operational friction and make work easier to manage.' },
  { title: 'Service', copy: 'The company focuses on practical outcomes for clients, communities, suppliers, and delivery teams.' },
];

export const serviceDetails: Record<string, ServiceDetail> = {
  procurement: { eyebrow: 'Procurement', title: 'Tender and procurement support with disciplined readiness control.', description: 'Torque Empire supports procurement activity from opportunity review through supplier quotation sourcing, document preparation, submission readiness, and governance recordkeeping. This support improves process quality but does not guarantee tender awards.', highlights: ['Tender opportunity support', 'Tender pack preparation', 'Supplier quotation sourcing', 'Compliance document preparation', 'SBD document support', 'BOQ and pricing support', 'Contractor onboarding', 'Procurement administration'], process: ['Review opportunity requirements and closing timelines', 'Identify mandatory documents, SBD forms, pricing schedules, and compliance gaps', 'Coordinate supplier quotations and supporting material where required', 'Prepare a submission readiness trail for review and client communication'], proofPoints: ['SBD template capability can support formal procurement document preparation where applicable', 'TEOS workflows can track contractor readiness, supplier quotes, pricing support, and audit evidence', 'Submission records are handled as governed business records, not informal email-only activity'], primaryCta: 'Request procurement support' },
  hygiene: { eyebrow: 'Hygiene and Waste Management', title: 'Sanitary waste and hygiene services with controlled records and reporting.', description: 'Torque Empire presents hygiene and sanitary waste services with a focus on scheduled servicing, manifest discipline, controlled handling, disposal verification, and client reporting where legally and operationally applicable.', highlights: ['Feminine hygiene and sanitary waste collection', 'Scheduled service intervals', 'Bin servicing', 'Collection manifests', 'Controlled temporary storage', 'Disposal verification', 'PPE and handling procedures', 'Client service reporting'], process: ['Confirm scope, site access, bin locations, and service interval', 'Service bins and capture collection evidence', 'Maintain manifest and controlled movement records', 'Close the service cycle with disposal verification and reporting where applicable'], proofPoints: ['Nuwkem and Ticra product positioning supports the hygiene supply offer where applicable', 'Demonstration media is clearly distinguished from site-specific operational records', 'TEOS hygiene workflows can track jobs, manifests, evidence, driver activity, and reports'], primaryCta: 'Request hygiene services' },
  telecoms: { eyebrow: 'Telecommunications', title: 'Field-focused telecoms support for connectivity and network work.', description: 'Torque Empire can present practical telecommunications coordination across fibre installation support, splicing, civil works support, site coordination, and maintenance assistance where the confirmed scope allows.', highlights: ['Fibre installation support', 'Fibre splicing', 'Civil works support', 'Network infrastructure support', 'Site coordination', 'Maintenance and field support'], process: ['Clarify site scope and access requirements', 'Coordinate field resources and service expectations', 'Support implementation tracking and issue communication', 'Maintain records for handover and follow-up'], proofPoints: ['Claims remain scoped to supported field and coordination services', 'No unsupported licensing, national coverage, or major-contract claims are made', 'TEOS can support task visibility and operational reporting'], primaryCta: 'Request telecoms support' },
  carSales: { eyebrow: 'Automotive', title: 'Automotive services for sourcing, dealer collaboration, and enquiry coordination.', description: 'Torque Empire supports dealership-neutral vehicle sourcing, customer enquiry coordination, dealer collaboration, vehicle presentation, marketing workflow, and digital follow-up processes without presenting public stock promises.', highlights: ['Private vehicle sourcing enquiries', 'Dealer collaboration', 'Customer enquiry coordination', 'Vehicle presentation and marketing', 'Digital automotive workflows', 'Structured handover communication'], process: ['Capture the buyer or partner requirement', 'Coordinate sourcing or dealer discussion', 'Prepare presentation and enquiry follow-up', 'Track communication through a structured workflow'], proofPoints: ['Vehicle availability and finance outcomes are subject to direct written confirmation', 'Vehicle imagery is used for category presentation and does not represent live stock', 'Automotive enquiries are coordinated through structured communication and controlled follow-up'], primaryCta: 'Start an automotive enquiry' },
};

export const automotiveSourcingJourney = ['Enquiry', 'Vehicle sourcing', 'Dealer coordination', 'Verification', 'Offer', 'Handover'] as const;

export const automotiveMedia = [
  { src: '/images/vehicles/bmw-m4-hero.jpg', alt: 'Premium performance vehicle category presentation', label: 'Performance and premium enquiries' },
  { src: '/images/vehicles/vw-golf-r32.png', alt: 'Compact performance vehicle category presentation', label: 'Hatchbacks and specialist sourcing' },
] as const;

export const industriesServed = ['Government and public sector', 'Facilities and site operations', 'Procurement and supplier networks', 'Transport and field services', 'Technology-enabled small business operations', 'Commercial service delivery', 'State owned enterprises', 'Corporate compliance teams'];

export const nuwkemPositioning = 'Torque Empire may present selected Nuwkem and Ticra professional hygiene solutions as part of its hygiene supply and service offer where supported by approved distributor positioning. Torque Empire does not claim to manufacture those products.';

export const teosOutcomes = ['Governance and audit trails for controlled business decisions', 'Contractor management and onboarding visibility', 'Document readiness for procurement and compliance work', 'Procurement workflows from opportunity to submission support', 'Hygiene operations, manifests, driver evidence, and reporting', 'Dashboard reporting for operational oversight'];
