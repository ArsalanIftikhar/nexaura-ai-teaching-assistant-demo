import fs from "node:fs";
import path from "node:path";

export interface CurriculumSnippet {
  source: string;
  text: string;
}

const curriculumRoot = path.join(process.cwd(), "data", "curriculum");

const loadDocuments = (curriculumKey: string) => {
  const folderPath = path.join(curriculumRoot, curriculumKey);
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  const files = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".md"));

  return files.map((file) => ({
    source: file,
    content: fs.readFileSync(path.join(folderPath, file), "utf-8"),
  }));
};

const scoreParagraph = (paragraph: string, keywords: string[]) => {
  const lower = paragraph.toLowerCase();
  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    return score + (lower.includes(keyword) ? 1 : 0);
  }, 0);
};

export const retrieveCurriculumSnippets = (
  query: string,
  curriculumKey: string
): CurriculumSnippet[] => {
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  const documents = loadDocuments(curriculumKey);
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
    .slice(0, 4)
    .map((item) => ({ source: item.source, text: item.text }));
};
