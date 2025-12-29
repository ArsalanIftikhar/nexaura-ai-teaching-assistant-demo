import fs from "node:fs";
import path from "node:path";

const uploadsDir = path.join(process.cwd(), "data", "curriculum", "uploads");
const outputPath = path.join(process.cwd(), "data", "curriculum", "index.json");

const readTextFile = (filePath: string) => fs.readFileSync(filePath, "utf-8");

const ingest = () => {
  if (!fs.existsSync(uploadsDir)) {
    console.error("Uploads directory not found:", uploadsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(uploadsDir).filter((file) => !file.startsWith("."));
  const documents: { source: string; content: string }[] = [];

  files.forEach((file) => {
    const fullPath = path.join(uploadsDir, file);
    const ext = path.extname(file).toLowerCase();

    if ([".md", ".txt"].includes(ext)) {
      documents.push({
        source: file,
        content: readTextFile(fullPath),
      });
      return;
    }

    if (ext === ".pdf") {
      console.warn(
        `Skipping ${file}. Add PDF extraction here (e.g., pdf-parse) before production ingestion.`
      );
      return;
    }

    console.warn(`Skipping unsupported file: ${file}`);
  });

  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));
  console.log(`Wrote curriculum index with ${documents.length} documents to ${outputPath}`);
};

ingest();
