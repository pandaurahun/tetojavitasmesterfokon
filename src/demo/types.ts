export type LeadStatus =
  | "uj"
  | "kapcsolatra-var"
  | "megkeresve"
  | "felmeres-egyeztetve"
  | "felmerve"
  | "ajanlat-keszul"
  | "ajanlat-elkuldve"
  | "utankovetes"
  | "elfogadva"
  | "elutasitva";

export type Urgency = "azonnali" | "napokon-belul" | "honapon-belul" | "tervezett" | "tajekozodas";

export type LeadSource = "reszletes-ajanlatkero" | "visszahivas" | "telefon" | "ajanlas" | "kereso";

export interface DemoFile {
  id: string;
  name: string;
  size: number;
  kind: "kep" | "dokumentum";
  dataUrl?: string | undefined;
}

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  detail?: string | undefined;
}

export interface LeadAttribution {
  source?: string | undefined;
  medium?: string | undefined;
  campaign?: string | undefined;
  content?: string | undefined;
  term?: string | undefined;
  gclid?: string | undefined;
  fbclid?: string | undefined;
  landingPage?: string | undefined;
  firstTouchAt?: string | undefined;
}

export interface LeadNote {
  id: string;
  date: string;
  author: string;
  text: string;
}

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  zip?: string | undefined;
  street?: string | undefined;
  service: string;
  buildingType?: string | undefined;
  urgency: Urgency;
  status: LeadStatus;
  source: LeadSource;
  attribution?: LeadAttribution | undefined;
  preferredContact?: string | undefined;
  callWindow?: string | undefined;
  message?: string | undefined;
  roof?:
    | {
        area?: string | undefined;
        shape?: string | undefined;
        covering?: string | undefined;
        levels?: string | undefined;
        age?: string | undefined;
        access?: string | undefined;
        description?: string | undefined;
      }
    | undefined;
  files: DemoFile[];
  owner: string;
  nextTask?: string | undefined;
  nextTaskDue?: string | undefined;
  updatedAt?: string | undefined;
  notes: LeadNote[];
  timeline: TimelineEntry[];
  extra?: Record<string, string> | undefined;
}

export type QuoteStatus =
  | "piszkozat"
  | "ellenorzes"
  | "elkuldve"
  | "megtekintve"
  | "modositast-kertek"
  | "elfogadva"
  | "elutasitva"
  | "lejart";

export interface QuoteItem {
  id: string;
  name: string;
  description?: string | undefined;
  qty: number;
  unit: string;
  unitPrice: number;
  vat: number;
}

export interface Quote {
  id: string;
  number: string;
  leadId?: string | undefined;
  client: string;
  clientAddress: string;
  title: string;
  createdAt: string;
  validUntil: string;
  leadTime: string;
  status: QuoteStatus;
  items: QuoteItem[];
  discountPercent: number;
  note: string;
  internalNote?: string | undefined;
  payment: string;
  warranty: string;
}

export interface ServiceItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  short: string;
  long: string;
  cta: string;
  image?: string | undefined;
  active: boolean;
  order: number;
}

export type CustomFieldType =
  | "rovid-szoveg"
  | "hosszu-szoveg"
  | "szam"
  | "igen-nem"
  | "valasztogomb"
  | "tobb-valasztas"
  | "legordulo"
  | "datum"
  | "fajl"
  | "fotó"
  | "terulet"
  | "mennyiseg"
  | "mertekegyseg";

export interface CustomField {
  id: string;
  label: string;
  key: string;
  type: CustomFieldType;
  description?: string | undefined;
  required: boolean;
  publicVisible: boolean;
  options: string[];
  order: number;
  serviceId: string;
}

export interface ProjectRef {
  id: string;
  title: string;
  location: string;
  services: string[];
  problem: string;
  works: string[];
  duration: string;
  beforeImage: string;
  afterImage: string;
  gallery: string[];
  featured: boolean;
  published: boolean;
}

export interface Branding {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  headingFont: string;
  bodyFont: string;
  buttonRadius: number;
  cardRadius: number;
  shadowStrength: number;
  sectionSpace: number;
  motion: number;
  logoText: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface ContentBlock {
  id: string;
  name: string;
  title: string;
  description: string;
  buttonLabel?: string | undefined;
  visible: boolean;
  order: number;
}

export type CmsFieldType = "text" | "longtext" | "image";

export interface CmsFieldDefinition {
  key: string;
  label: string;
  type: CmsFieldType;
  defaultValue: string;
}

export interface CmsSectionDefinition {
  id: string;
  page: string;
  name: string;
  defaultVisible: boolean;
  defaultOrder: number;
  fields: CmsFieldDefinition[];
}

export interface CmsSection {
  id: string;
  page: string;
  name: string;
  visible: boolean;
  order: number;
  values: Record<string, string>;
}

export interface LegalDoc {
  id: string;
  slug: string;
  title: string;
  version: string;
  effectiveFrom: string;
  body: string;
  published: boolean;
}

export interface Article {
  slug: string;
  title: string;
  lead: string;
  readingTime: string;
  category: string;
  body: string[];
}

export interface Settings {
  company: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  areas: string[];
  workingHours: string;
}
