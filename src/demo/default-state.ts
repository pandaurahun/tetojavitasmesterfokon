import {
  defaultBranding,
  defaultContentBlocks,
  defaultCustomFields,
  defaultLeads,
  defaultLegal,
  defaultProjects,
  defaultQuotes,
  defaultServices,
  defaultSettings,
} from "./data";
import { defaultCmsSections, mergeCmsSections } from "./cms";
import type {
  Branding,
  ContentBlock,
  CustomField,
  Lead,
  LegalDoc,
  ProjectRef,
  Quote,
  ServiceItem,
  Settings,
  CmsSection,
} from "./types";

export interface DemoState {
  leads: Lead[];
  quotes: Quote[];
  services: ServiceItem[];
  fields: CustomField[];
  projects: ProjectRef[];
  branding: Branding;
  content: ContentBlock[];
  legal: LegalDoc[];
  settings: Settings;
  cms: CmsSection[];
}

export const initialState: DemoState = {
  leads: defaultLeads,
  quotes: defaultQuotes,
  services: defaultServices,
  fields: defaultCustomFields,
  projects: defaultProjects,
  branding: defaultBranding,
  content: defaultContentBlocks,
  legal: defaultLegal,
  settings: defaultSettings,
  cms: defaultCmsSections,
};

export type SiteState = Omit<DemoState, "leads" | "quotes">;

export function siteStateFrom(state: DemoState): SiteState {
  const { leads: _leads, quotes: _quotes, ...site } = state;
  return site;
}

export function hydrateSiteState(state: SiteState): SiteState {
  return {
    ...state,
    branding: { ...defaultBranding, ...state.branding },
    cms: mergeCmsSections(state.cms),
  };
}
