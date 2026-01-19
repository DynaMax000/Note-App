import { Note, GraphData, Folder } from "../types";

export const generateGraphData = (notes: Note[], folders: Folder[]): GraphData => {
  // Create a map of folder IDs to integer groups for coloring
  const folderToGroupMap = new Map<string, number>();
  folders.forEach((folder, index) => {
    folderToGroupMap.set(folder.id, index + 2); // Start from 2 to reserve 1 for root/default
  });

  const nodes = notes.map(note => ({
    id: note.id,
    title: note.title,
    // If note has a folder, use its group, otherwise group 1
    group: note.folderId ? (folderToGroupMap.get(note.folderId) || 1) : 1
  }));

  const links: { source: string; target: string; value: number }[] = [];
  const noteTitleToIdMap = new Map(notes.map(n => [n.title.toLowerCase(), n.id]));

  notes.forEach(sourceNote => {
    // 1. Detect [[WikiLinks]]
    const wikiLinkRegex = /\[\[(.*?)\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(sourceNote.content)) !== null) {
      const targetTitle = match[1].split('|')[0].trim().toLowerCase();
      if (noteTitleToIdMap.has(targetTitle)) {
        const targetId = noteTitleToIdMap.get(targetTitle)!;
        if (targetId !== sourceNote.id) {
           links.push({ source: sourceNote.id, target: targetId, value: 1 });
        }
      }
    }
  });

  // Remove duplicate links
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex((l) => (
      l.source === link.source && l.target === link.target
    ))
  );

  return { nodes, links: uniqueLinks };
};