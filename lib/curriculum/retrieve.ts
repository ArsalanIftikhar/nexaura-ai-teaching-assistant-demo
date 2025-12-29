import fs from "node:fs";
import path from "node:path";

export interface CurriculumSnippet {
  source: string;
  text: string;
}

const curriculumDir = path.join(process.cwd(), "data", "curriculum");
const indexPath = path.join(curriculumDir, "index.json");

const loadDocuments = (): { source: string; content: string }[] => {
  if (fs.existsSync(indexPath)) {
    const raw = fs.readFileSync(indexPath, "utf-8");
    return JSON.parse(raw);
  }

  const files = fs
    .readdirSync(curriculumDir)
    .filter((file) => file.endsWith(".md"));

  return files.map((file) => ({
    source: file.includes("placeholder")
      ? "Placeholder Curriculum v0.1"
      : file,
    content: fs.readFileSync(path.join(curriculumDir, file), "utf-8"),
  }));
};

const scoreParagraph = (paragraph: string, keywords: string[]) => {
  const lower = paragraph.toLowerCase();
  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    return score + (lower.includes(keyword) ? 1 : 0);
  }, 0);
};

export const retrieveCurriculumSnippets = (query: string): CurriculumSnippet[] => {
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  const documents = loadDocuments();
  const scored: { source: string; text: string; score: number }[] = [];

  documents.forEach((doc) => {
    const paragraphs = doc.content
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    paragraphs.forEach((paragraph) => {
      scored.push({
        source: doc.source,
        text: paragraph,
        score: scoreParagraph(paragraph, keywords),
      });
    });
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({ source: item.source, text: item.text }));
};
