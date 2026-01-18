export interface Note {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  pinned?: boolean;
  icon?: string; // Icon name from lucide-react
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  data: string; // Base64
  folderId?: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  collapsed?: boolean;
}

export interface GraphNode {
  id: string;
  title: string;
  group: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export enum ViewMode {
  EDITOR = 'EDITOR',
  GRAPH = 'GRAPH'
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'root' | 'folder' | 'note' | 'attachment';
  targetId?: string;
}