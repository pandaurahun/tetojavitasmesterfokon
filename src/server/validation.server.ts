import { z } from "zod";

const shortText = z.string().max(300);
const mediumText = z.string().max(5_000);
const longText = z.string().max(100_000);
const id = z.string().min(1).max(120);

const demoFileSchema = z.object({
  id,
  name: shortText,
  size: z.number().int().min(0).max(20_000_000),
  kind: z.enum(["kep", "dokumentum"]),
  dataUrl: z.string().max(1_500_000).optional(),
});

const timelineSchema = z.object({
  id,
  date: shortText,
  title: shortText,
  detail: mediumText.optional(),
});

const noteSchema = z.object({
  id,
  date: shortText,
  author: shortText,
  text: mediumText,
});

export const leadSchema = z.object({
  id,
  createdAt: shortText,
  name: shortText,
  phone: shortText,
  email: shortText,
  city: shortText,
  zip: shortText.optional(),
  street: shortText.optional(),
  service: shortText,
  buildingType: shortText.optional(),
  urgency: z.enum(["azonnali", "napokon-belul", "honapon-belul", "tervezett", "tajekozodas"]),
  status: z.enum([
    "uj",
    "kapcsolatra-var",
    "megkeresve",
    "felmeres-egyeztetve",
    "felmerve",
    "ajanlat-keszul",
    "ajanlat-elkuldve",
    "utankovetes",
    "elfogadva",
    "elutasitva",
  ]),
  source: z.enum(["reszletes-ajanlatkero", "visszahivas", "telefon", "ajanlas", "kereso"]),
  preferredContact: shortText.optional(),
  callWindow: shortText.optional(),
  message: mediumText.optional(),
  roof: z
    .object({
      area: shortText.optional(),
      shape: shortText.optional(),
      covering: shortText.optional(),
      levels: shortText.optional(),
      age: shortText.optional(),
      access: shortText.optional(),
      description: mediumText.optional(),
    })
    .optional(),
  files: z.array(demoFileSchema).max(10),
  owner: shortText,
  nextTask: shortText.optional(),
  nextTaskDue: shortText.optional(),
  updatedAt: shortText.optional(),
  notes: z.array(noteSchema).max(500),
  timeline: z.array(timelineSchema).max(500),
  extra: z.record(z.string(), mediumText).optional(),
});

const quoteItemSchema = z.object({
  id,
  name: shortText,
  description: mediumText.optional(),
  qty: z.number().finite().min(0),
  unit: shortText,
  unitPrice: z.number().finite().min(0),
  vat: z.number().min(0).max(100),
});

const quoteSchema = z.object({
  id,
  number: shortText,
  leadId: id.optional(),
  client: shortText,
  clientAddress: mediumText,
  title: shortText,
  createdAt: shortText,
  validUntil: shortText,
  leadTime: shortText,
  status: z.enum([
    "piszkozat",
    "ellenorzes",
    "elkuldve",
    "megtekintve",
    "modositast-kertek",
    "elfogadva",
    "elutasitva",
    "lejart",
  ]),
  items: z.array(quoteItemSchema).max(500),
  discountPercent: z.number().min(0).max(100),
  note: mediumText,
  internalNote: mediumText.optional(),
  payment: mediumText,
  warranty: mediumText,
});

const serviceSchema = z.object({
  id,
  slug: shortText,
  title: shortText,
  category: shortText,
  icon: shortText,
  short: mediumText,
  long: longText,
  cta: shortText,
  image: z.string().max(2_000).optional(),
  active: z.boolean(),
  order: z.number().int(),
});

const customFieldSchema = z.object({
  id,
  label: shortText,
  key: shortText,
  type: z.enum([
    "rovid-szoveg",
    "hosszu-szoveg",
    "szam",
    "igen-nem",
    "valasztogomb",
    "tobb-valasztas",
    "legordulo",
    "datum",
    "fajl",
    "fotó",
    "terulet",
    "mennyiseg",
    "mertekegyseg",
  ]),
  description: mediumText.optional(),
  required: z.boolean(),
  publicVisible: z.boolean(),
  options: z.array(shortText).max(100),
  order: z.number().int(),
  serviceId: id,
});

const projectSchema = z.object({
  id,
  title: shortText,
  location: shortText,
  services: z.array(shortText).max(50),
  problem: longText,
  works: z.array(mediumText).max(200),
  duration: shortText,
  beforeImage: z.string().max(2_000),
  afterImage: z.string().max(2_000),
  gallery: z.array(z.string().max(2_000)).max(100),
  featured: z.boolean(),
  published: z.boolean(),
});

const brandingSchema = z.object({
  primary: shortText,
  secondary: shortText,
  accent: shortText,
  background: shortText,
  headingFont: shortText,
  bodyFont: shortText,
  buttonRadius: z.number().finite(),
  cardRadius: z.number().finite(),
  shadowStrength: z.number().finite(),
  sectionSpace: z.number().finite(),
  motion: z.number().finite(),
  logoText: shortText,
  faviconUrl: z.string().max(500_000).default("/favicon.svg"),
  heroTitle: mediumText,
  heroSubtitle: mediumText,
  primaryCta: shortText,
  secondaryCta: shortText,
});

const contentBlockSchema = z.object({
  id,
  name: shortText,
  title: mediumText,
  description: longText,
  buttonLabel: shortText.optional(),
  visible: z.boolean(),
  order: z.number().int(),
});

const cmsSectionSchema = z.object({
  id,
  page: shortText,
  name: shortText,
  visible: z.boolean(),
  order: z.number().int(),
  values: z.record(z.string().max(120), longText),
});

const legalSchema = z.object({
  id,
  slug: shortText,
  title: shortText,
  version: shortText,
  effectiveFrom: shortText,
  body: longText,
  published: z.boolean(),
});

const settingsSchema = z.object({
  company: shortText,
  contactName: shortText,
  phone: shortText,
  email: shortText,
  address: mediumText,
  taxNumber: shortText,
  areas: z.array(shortText).max(500),
  workingHours: shortText,
});

export const siteStateSchema = z.object({
  services: z.array(serviceSchema).max(200),
  fields: z.array(customFieldSchema).max(500),
  projects: z.array(projectSchema).max(500),
  branding: brandingSchema,
  content: z.array(contentBlockSchema).max(500),
  legal: z.array(legalSchema).max(100),
  settings: settingsSchema,
  cms: z.array(cmsSectionSchema).max(500).default([]),
});

export const demoStateSchema = siteStateSchema.extend({
  leads: z.array(leadSchema).max(10_000),
  quotes: z.array(quoteSchema).max(10_000),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
});

export const bootstrapSchema = loginSchema;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});
