import JSZip from 'jszip';
import mammoth from 'mammoth';
import path from 'path';
import type { DocumentSection } from '../shared/types.ts';

export interface ExtractedDocumentResult {
  text: string;
  sections: DocumentSection[];
  detectedSlideCount: number;
  fileType: string;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function classifyLinesToSection(
  rawLines: string[],
  fallbackTitle: string,
  explicitBulletFlags?: boolean[]
): DocumentSection {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { title: fallbackTitle, paragraphs: [], bullets: [] };
  }

  const rawFirst = lines[0].replace(/^#{1,6}\s+/, '').trim();
  const title = rawFirst || fallbackTitle;
  const paragraphs: string[] = [];
  const bullets: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(?:[•◦▪▫●○]|[-*])\s+(.+)$/);
    const isExplicitBullet = explicitBulletFlags ? explicitBulletFlags[i] : false;

    if (bulletMatch) {
      bullets.push(bulletMatch[1].trim());
    } else if (isExplicitBullet) {
      bullets.push(line);
    } else {
      paragraphs.push(line);
    }
  }

  return { title, paragraphs, bullets };
}

export function parsePlainTextToSections(rawText: string, fallbackTitle = 'Slide'): DocumentSection[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // 1. Explicit slide separator (--- on its own line)
  if (/\n\s*---+\s*\n/.test(normalized)) {
    const blocks = normalized
      .split(/\n\s*---+\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    return blocks.map((block, idx) =>
      classifyLinesToSection(block.split('\n'), `${fallbackTitle} ${idx + 1}`)
    );
  }

  // 2. Markdown headings (# or ##)
  const allLines = normalized.split('\n');
  const hasMarkdownHeadings = allLines.some((l) => /^#{1,3}\s+\S/.test(l.trim()));
  if (hasMarkdownHeadings) {
    const sections: DocumentSection[] = [];
    let currentLines: string[] = [];

    for (const line of allLines) {
      const trimmed = line.trim();
      if (/^#{1,3}\s+\S/.test(trimmed)) {
        if (currentLines.length > 0) {
          sections.push(classifyLinesToSection(currentLines, `${fallbackTitle} ${sections.length + 1}`));
          currentLines = [];
        }
        currentLines.push(trimmed);
      } else if (trimmed) {
        currentLines.push(trimmed);
      }
    }
    if (currentLines.length > 0) {
      sections.push(classifyLinesToSection(currentLines, `${fallbackTitle} ${sections.length + 1}`));
    }
    if (sections.length > 0) return sections;
  }

  // 3. Blank-line separated blocks
  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length > 1) {
    // Pair standalone short heading blocks with immediately following body block when obvious
    const sections: DocumentSection[] = [];
    let i = 0;
    while (i < blocks.length) {
      const current = blocks[i];
      const currentLines = current.split('\n').map((l) => l.trim()).filter(Boolean);
      const isSingleShortHeading =
        currentLines.length === 1 &&
        currentLines[0].length <= 95 &&
        !/[.!?]$/.test(currentLines[0]) &&
        i + 1 < blocks.length;

      if (isSingleShortHeading) {
        const nextLines = blocks[i + 1].split('\n').map((l) => l.trim()).filter(Boolean);
        sections.push(
          classifyLinesToSection([currentLines[0], ...nextLines], `${fallbackTitle} ${sections.length + 1}`)
        );
        i += 2;
      } else {
        sections.push(classifyLinesToSection(currentLines, `${fallbackTitle} ${sections.length + 1}`));
        i += 1;
      }
    }
    return sections;
  }

  return [classifyLinesToSection(allLines, `${fallbackTitle} 1`)];
}

export async function extractDocumentStructured(
  buffer: Buffer,
  originalName: string
): Promise<ExtractedDocumentResult> {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext).trim() || 'Presentation';

  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    const text = buffer.toString('utf8').trim();
    if (!text) {
      throw new Error('The uploaded text file is empty.');
    }
    const sections = parsePlainTextToSections(text, baseName);
    return {
      text,
      sections,
      detectedSlideCount: sections.length,
      fileType: ext.replace('.', '').toUpperCase(),
    };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (!text) {
      throw new Error('Could not extract readable text from this DOCX document.');
    }
    const sections = parsePlainTextToSections(text, baseName);
    return {
      text,
      sections,
      detectedSlideCount: sections.length,
      fileType: 'DOCX',
    };
  }

  if (ext === '.pptx') {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return na - nb;
      });

    if (slideFiles.length === 0) {
      throw new Error('No slides found in this PPTX file.');
    }

    const sections: DocumentSection[] = [];
    const textBlocks: string[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string');
      const pMatches = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)];

      const rawLines: string[] = [];
      const bulletFlags: boolean[] = [];

      for (const pm of pMatches) {
        const pInner = pm[1];
        const tMatches = [...pInner.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
        const paraText = tMatches.map((tm) => decodeXmlEntities(tm[1])).join('').trim();
        if (paraText) {
          const hasBulletXml = /<a:buChar\b|<a:buAutoNum\b/.test(pInner);
          rawLines.push(paraText);
          bulletFlags.push(hasBulletXml);
        }
      }

      // Fallback if XML structure has text outside <a:p>
      if (rawLines.length === 0) {
        const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
        const joined = matches.map((m) => decodeXmlEntities(m[1]).trim()).filter(Boolean);
        for (const j of joined) {
          rawLines.push(j);
          bulletFlags.push(false);
        }
      }

      if (rawLines.length > 0) {
        sections.push(classifyLinesToSection(rawLines, `Slide ${i + 1}`, bulletFlags));
        textBlocks.push(rawLines.join('\n'));
      }
    }

    const text = textBlocks.join('\n\n---\n\n').trim();
    if (!text || sections.length === 0) {
      throw new Error('No readable text found inside the uploaded PPTX file.');
    }

    return {
      text,
      sections,
      detectedSlideCount: sections.length,
      fileType: 'PPTX',
    };
  }

  if (ext === '.pdf') {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const sections: DocumentSection[] = [];
    const textBlocks: string[] = [];
    const maxPages = Math.min(pdf.numPages, 60);

    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const rawItem of content.items as any[]) {
        const str = typeof rawItem.str === 'string' ? rawItem.str : '';
        const y = Array.isArray(rawItem.transform) ? Number(rawItem.transform[5]) : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = '';
        }

        if (str) {
          currentLine = currentLine ? `${currentLine} ${str}` : str;
        }

        if (rawItem.hasEOL) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = '';
          lastY = null;
        } else if (y !== null) {
          lastY = y;
        }
      }

      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }

      const cleanLines = lines.map((l) => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
      if (cleanLines.length > 0) {
        sections.push(classifyLinesToSection(cleanLines, `${baseName} (${p})`));
        textBlocks.push(cleanLines.join('\n'));
      }
    }

    const text = textBlocks.join('\n\n---\n\n').trim();
    if (!text || sections.length === 0) {
      throw new Error('No extractable text found in PDF (scanned image PDFs without OCR are not supported).');
    }

    return {
      text,
      sections,
      detectedSlideCount: sections.length,
      fileType: 'PDF',
    };
  }

  throw new Error(`Unsupported file format (${ext}). Please upload PDF, DOCX, TXT, or PPTX.`);
}

export async function extractDocumentText(buffer: Buffer, originalName: string): Promise<string> {
  const result = await extractDocumentStructured(buffer, originalName);
  return result.text;
}
