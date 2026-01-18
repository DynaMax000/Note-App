import { GoogleGenAI } from "@google/genai";
import { Note } from "../types";

const initGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is not defined in process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const streamAiChat = async (
  note: Note, 
  allNotes: Note[], 
  history: ChatMessage[],
  userPrompt: string,
  onChunk: (text: string) => void
): Promise<void> => {
  const ai = initGenAI();
  if (!ai) {
    onChunk("I couldn't generate a response because the API key is missing.");
    return;
  }

  // 1. Identify WikiLinks in the current note
  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  const linkedTitles: string[] = [];
  let match;
  while ((match = wikiLinkRegex.exec(note.content)) !== null) {
    linkedTitles.push(match[1].split('|')[0].trim().toLowerCase());
  }

  // 2. Resolve linked notes
  const linkedNotesContext = allNotes
    .filter(n => linkedTitles.includes(n.title.toLowerCase()))
    .map(n => `Title: "${n.title}"\nContent Snippet: ${n.content.substring(0, 200).replace(/\n/g, ' ')}...`)
    .join('\n---\n');

  // 3. Construct History Text
  const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n');

  // 4. Construct Prompt
  const prompt = `
    You are a helpful, minimalist AI assistant embedded in a note-taking app.
    
    === Context: Current Note ===
    Title: ${note.title}
    Content:
    ${note.content}

    === Context: Linked Notes ===
    ${linkedNotesContext || "No linked notes found."}

    === Conversation History ===
    ${historyText}

    === User Request ===
    ${userPrompt}
    
    Instructions:
    - Answer the user's request based strictly on the note context provided.
    - Be concise, professional, and helpful.
    - If asked to summarize, provide a clean, bulleted summary.
    - If asked to rewrite, provide the rewritten text.
    - Do not invent facts not present in the notes (unless asking for general knowledge enhancement).
  `;

  try {
    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a smart knowledge assistant. Keep answers brief and Markdown formatted.",
      }
    });

    for await (const chunk of result) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    onChunk("(I encountered a hiccup while thinking. Please check your connection.)");
  }
};

export const suggestNoteTitle = async (content: string): Promise<string> => {
   const ai = initGenAI();
  if (!ai) return "Untitled Note";

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, concise, and descriptive title (max 6 words) for this note. Do not use quotes. Text:\n\n${content.substring(0, 500)}...`,
    });
    return response.text?.replace(/['"]+/g, '').replace(/\*/g, '').trim() || "Untitled Note";
  } catch (e) {
    return "Untitled Note";
  }
}