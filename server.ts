// Trigger save state
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import archiver from "archiver";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Backup route
  app.get("/api/download-backup", (_req, res) => {
    res.attachment("tutorengmate-ai-backup.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    archive.on("error", (err) => {
      res.status(500).send({ error: err.message });
    });
    
    archive.pipe(res);
    
    // Add the src folder
    archive.directory(path.join(process.cwd(), "src"), "src");
    
    // Add important root files
    const filesToInclude = [
      "package.json",
      "server.ts",
      "vite.config.ts",
      "tailwind.config.js",
      "tsconfig.json",
      "index.html",
      "firebase-applet-config.json",
      "firebase-blueprint.json",
      "firestore.rules",
      ".env.example"
    ];
    
    filesToInclude.forEach((file) => {
      archive.file(path.join(process.cwd(), file), { name: file });
    });
    
    archive.finalize();
  });

  app.post("/api/gemini", async (req, res) => {
    try {
      const { message } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY2 });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: message,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Something went wrong" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
