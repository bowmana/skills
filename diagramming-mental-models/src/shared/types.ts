// Canonical types shared by the frontend, server, and CLI.

export interface Transform {
  pan: { x: number; y: number };
  zoom: number;
}

export interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  rev: number;
  createdAt: number;
  updatedAt: number;
}

export interface Project extends ProjectSummary {
  code: string;
  theme: string;
  annotations: Annotation[];
  panZoom: Transform | null;
}

export interface ProjectPatch {
  name?: string;
  code?: string;
  theme?: string;
  annotations?: Annotation[];
  panZoom?: Transform | null;
}
