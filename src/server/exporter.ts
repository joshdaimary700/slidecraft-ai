import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { PRESENTATION_THEMES } from '../shared/types.ts';
import type { PresentationRecord, SlideData, ThemeConfig } from '../shared/types.ts';

function stripHash(hex: string | undefined, fallback: string): string {
  const clean = (hex || fallback || '#0F172A').replace('#', '').trim();
  return /^[0-9A-Fa-f]{6}$/.test(clean) ? clean : fallback.replace('#', '');
}

function getTheme(themeId: string): ThemeConfig {
  return PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0];
}

function resolveLocalImagePath(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/src/assets/images/')) {
    const p = path.join(process.cwd(), imageUrl.slice(1));
    return fs.existsSync(p) ? p : null;
  }
  if (imageUrl.startsWith('/uploads/')) {
    const p = path.join(process.cwd(), imageUrl.slice(1));
    return fs.existsSync(p) ? p : null;
  }
  return null;
}

function loadImageDataUri(imageUrl?: string): string | null {
  const localPath = resolveLocalImagePath(imageUrl);
  if (!localPath) return null;
  try {
    const buf = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generatePptxBuffer(
  presentation: PresentationRecord,
  slides: SlideData[]
): Promise<Buffer> {
  const PptxCtor = (PptxGenJS as any).default || PptxGenJS;
  const pptx = new PptxCtor();
  pptx.title = presentation.title;
  pptx.subject = presentation.topic;
  pptx.author = 'SlideCraft AI';

  const is43 = presentation.aspectRatio === '4:3';
  pptx.layout = is43 ? 'LAYOUT_4x3' : 'LAYOUT_16x9';

  const W = 10;
  const H = is43 ? 7.5 : 5.625;
  const theme = getTheme(presentation.themeId);

  for (let idx = 0; idx < slides.length; idx++) {
    const s = slides[idx];
    const slide = pptx.addSlide();

    const bgHex = stripHash(s.backgroundColor || theme.canvasBg, 'FFFFFF');
    const surfaceHex = stripHash(theme.surfaceBg, 'F8FAFC');
    const titleHex = stripHash(s.titleColor || theme.titleColor, '0F172A');
    const bodyHex = stripHash(s.bodyColor || theme.bodyColor, '334155');
    const mutedHex = stripHash(theme.mutedColor, '64748B');
    const accentHex = stripHash(theme.accentColor, '4F46E5');
    const borderHex = stripHash(theme.borderColor, 'E2E8F0');
    const titleFont = s.titleFont || theme.titleFont || 'Arial';
    const bodyFont = s.bodyFont || theme.bodyFont || 'Arial';
    const imgData = loadImageDataUri(s.imageUrl);

    slide.background = { color: bgHex };

    if (s.layout === 'full-image-title') {
      if (imgData) {
        slide.addImage({ data: imgData, x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: W,
          h: H,
          fill: { color: '0F172A', transparency: 38 },
          line: { color: '0F172A', transparency: 100 },
        });
      } else {
        slide.background = { color: '0F172A' };
      }

      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: H * 0.25,
        w: 0.9,
        h: 0.08,
        fill: { color: accentHex },
        line: { color: accentHex },
      });

      slide.addText(s.title, {
        x: 0.8,
        y: H * 0.3,
        w: 8.4,
        h: 1.4,
        fontFace: titleFont,
        fontSize: Math.min(40, (s.titleSize || 34) + 2),
        bold: true,
        color: 'FFFFFF',
        valign: 'top',
      });

      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.8,
          y: H * 0.57,
          w: 8.0,
          h: 0.8,
          fontFace: bodyFont,
          fontSize: 18,
          color: 'E2E8F0',
        });
      }

      if (s.paragraphs.length > 0) {
        slide.addText(s.paragraphs.join(' '), {
          x: 0.8,
          y: H * 0.74,
          w: 7.5,
          h: 0.6,
          fontFace: bodyFont,
          fontSize: 13,
          color: 'CBD5E1',
        });
      }
    } else {
      // Top Master Template Accent Stripe across content slides 2..N
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: W,
        h: 0.07,
        fill: { color: accentHex },
        line: { color: accentHex },
      });

      // Slide Index Badge + Standard Header on content slides
      slide.addText(String(idx + 1).padStart(2, '0'), {
        x: 0.6,
        y: 0.42,
        w: 0.45,
        h: 0.45,
        fontFace: titleFont,
        fontSize: 12,
        bold: true,
        color: accentHex,
        valign: 'middle',
      });

      slide.addText(s.title, {
        x: 1.05,
        y: 0.38,
        w: 8.35,
        h: 0.62,
        fontFace: titleFont,
        fontSize: Math.min(28, s.titleSize || 23),
        bold: true,
        color: titleHex,
      });

      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 1.05,
          y: 0.98,
          w: 8.35,
          h: 0.38,
          fontFace: bodyFont,
          fontSize: 13,
          color: mutedHex,
        });
      }

      slide.addShape(pptx.ShapeType.line, {
        x: 0.6,
        y: 1.44,
        w: 8.8,
        h: 0,
        line: { color: borderHex, width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.6,
        y: 1.42,
        w: 0.75,
        h: 0.04,
        fill: { color: accentHex },
        line: { color: accentHex },
      });

      const contentTop = 1.66;
      const contentH = H - contentTop - 0.55;

      if (s.layout === 'image-left' || s.layout === 'image-right') {
        const isLeft = s.layout === 'image-left';
        const imgX = isLeft ? 0.6 : 5.35;
        const textX = isLeft ? 5.15 : 0.6;

        if (imgData) {
          slide.addImage({
            data: imgData,
            x: imgX,
            y: contentTop,
            w: 4.05,
            h: contentH,
            sizing: { type: 'cover', w: 4.05, h: contentH },
          });
        } else {
          slide.addShape(pptx.ShapeType.rect, {
            x: imgX,
            y: contentTop,
            w: 4.05,
            h: contentH,
            fill: { color: surfaceHex },
            line: { color: borderHex, width: 1 },
          });
        }

        const textLines: any[] = [];
        for (const p of s.paragraphs) {
          textLines.push({
            text: p,
            options: { fontFace: bodyFont, fontSize: s.bodySize || 14, color: bodyHex, breakLine: true, paraSpaceAfter: 10 },
          });
        }
        for (const b of s.bullets) {
          textLines.push({
            text: b,
            options: {
              fontFace: bodyFont,
              fontSize: s.bodySize || 14,
              color: bodyHex,
              bullet: { code: '2022', color: accentHex },
              paraSpaceAfter: 8,
            },
          });
        }
        if (textLines.length > 0) {
          slide.addText(textLines, {
            x: textX,
            y: contentTop,
            w: 4.25,
            h: contentH,
            valign: 'top',
          });
        }
      } else if (s.layout === 'two-column-comparison') {
        const cols = s.comparison?.length
          ? s.comparison.slice(0, 2)
          : [
              { heading: 'Key Focus A', points: s.bullets.slice(0, Math.ceil(s.bullets.length / 2)) },
              { heading: 'Key Focus B', points: s.bullets.slice(Math.ceil(s.bullets.length / 2)) },
            ];
        cols.forEach((col, cIdx) => {
          const cx = cIdx === 0 ? 0.6 : 5.15;
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop,
            w: 4.25,
            h: contentH,
            fill: { color: surfaceHex },
            line: { color: borderHex, width: 1 },
          });
          slide.addText(col.heading, {
            x: cx + 0.25,
            y: contentTop + 0.2,
            w: 3.75,
            h: 0.4,
            fontFace: titleFont,
            fontSize: 16,
            bold: true,
            color: accentHex,
          });
          const pts = (col.points || []).map((pt) => ({
            text: pt,
            options: {
              fontFace: bodyFont,
              fontSize: 13,
              color: bodyHex,
              bullet: { code: '2022', color: accentHex },
              paraSpaceAfter: 8,
            },
          }));
          if (pts.length > 0) {
            slide.addText(pts, {
              x: cx + 0.25,
              y: contentTop + 0.7,
              w: 3.75,
              h: contentH - 0.9,
              valign: 'top',
            });
          }
        });
      } else if (s.layout === 'three-column-cards') {
        const cards = s.featureCards?.length
          ? s.featureCards.slice(0, 3)
          : s.bullets.slice(0, 3).map((b, i) => ({ title: `Pillar ${i + 1}`, description: b }));
        const cardW = 2.75;
        cards.forEach((card, cIdx) => {
          const cx = 0.6 + cIdx * 3.02;
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop,
            w: cardW,
            h: contentH,
            fill: { color: surfaceHex },
            line: { color: borderHex, width: 1 },
          });
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop,
            w: cardW,
            h: 0.05,
            fill: { color: accentHex },
            line: { color: accentHex },
          });
          slide.addText(`0${cIdx + 1}`, {
            x: cx + 0.2,
            y: contentTop + 0.2,
            w: 1,
            h: 0.3,
            fontFace: titleFont,
            fontSize: 12,
            bold: true,
            color: accentHex,
          });
          slide.addText(card.title, {
            x: cx + 0.2,
            y: contentTop + 0.55,
            w: cardW - 0.4,
            h: 0.55,
            fontFace: titleFont,
            fontSize: 15,
            bold: true,
            color: titleHex,
          });
          slide.addText(card.description, {
            x: cx + 0.2,
            y: contentTop + 1.15,
            w: cardW - 0.4,
            h: contentH - 1.35,
            fontFace: bodyFont,
            fontSize: 12.5,
            color: bodyHex,
            valign: 'top',
          });
        });
      } else if (s.layout === 'stat-highlight') {
        const stats = s.stats?.length
          ? s.stats.slice(0, 3)
          : [{ value: '01', label: s.title, context: s.paragraphs[0] || '' }];
        const cardW = stats.length === 1 ? 8.8 : stats.length === 2 ? 4.25 : 2.75;
        const statH = contentH * 0.58;
        stats.forEach((st, sIdx) => {
          const cx = 0.6 + sIdx * (cardW + 0.27);
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop,
            w: cardW,
            h: statH,
            fill: { color: surfaceHex },
            line: { color: borderHex, width: 1 },
          });
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop,
            w: cardW,
            h: 0.05,
            fill: { color: accentHex },
            line: { color: accentHex },
          });
          slide.addText(st.value, {
            x: cx + 0.2,
            y: contentTop + 0.22,
            w: cardW - 0.4,
            h: 0.65,
            fontFace: titleFont,
            fontSize: 30,
            bold: true,
            color: accentHex,
          });
          slide.addText(st.label, {
            x: cx + 0.2,
            y: contentTop + 0.92,
            w: cardW - 0.4,
            h: 0.45,
            fontFace: titleFont,
            fontSize: 13,
            bold: true,
            color: titleHex,
          });
          if (st.context) {
            slide.addText(st.context, {
              x: cx + 0.2,
              y: contentTop + 1.38,
              w: cardW - 0.4,
              h: 0.45,
              fontFace: bodyFont,
              fontSize: 11,
              color: mutedHex,
            });
          }
        });
        const summaryText = [...s.paragraphs, ...s.bullets].join('  •  ');
        if (summaryText) {
          slide.addText(summaryText, {
            x: 0.6,
            y: contentTop + statH + 0.25,
            w: 8.8,
            h: contentH - statH - 0.3,
            fontFace: bodyFont,
            fontSize: 13,
            color: bodyHex,
          });
        }
      } else if (s.layout === 'timeline') {
        const items = s.timeline?.length
          ? s.timeline.slice(0, 4)
          : s.bullets.slice(0, 4).map((b, i) => ({ date: `Phase ${i + 1}`, title: b, description: '' }));
        const stepW = (8.8 - (items.length - 1) * 0.2) / Math.max(1, items.length);
        slide.addShape(pptx.ShapeType.line, {
          x: 0.8,
          y: contentTop + 0.45,
          w: 8.4,
          h: 0,
          line: { color: accentHex, width: 2 },
        });
        items.forEach((item, tIdx) => {
          const cx = 0.6 + tIdx * (stepW + 0.2);
          slide.addShape(pptx.ShapeType.ellipse, {
            x: cx + 0.15,
            y: contentTop + 0.33,
            w: 0.24,
            h: 0.24,
            fill: { color: accentHex },
            line: { color: bgHex, width: 1.5 },
          });
          slide.addText(item.date, {
            x: cx,
            y: contentTop,
            w: stepW,
            h: 0.28,
            fontFace: titleFont,
            fontSize: 11,
            bold: true,
            color: accentHex,
          });
          slide.addShape(pptx.ShapeType.rect, {
            x: cx,
            y: contentTop + 0.72,
            w: stepW,
            h: contentH - 0.8,
            fill: { color: surfaceHex },
            line: { color: borderHex, width: 1 },
          });
          slide.addText(item.title, {
            x: cx + 0.12,
            y: contentTop + 0.86,
            w: stepW - 0.24,
            h: 0.5,
            fontFace: titleFont,
            fontSize: 13,
            bold: true,
            color: titleHex,
          });
          slide.addText(item.description || '', {
            x: cx + 0.12,
            y: contentTop + 1.38,
            w: stepW - 0.24,
            h: contentH - 1.6,
            fontFace: bodyFont,
            fontSize: 11.5,
            color: bodyHex,
            valign: 'top',
          });
        });
      } else if (s.layout === 'process-diagram') {
        const steps = s.processSteps?.length
          ? s.processSteps.slice(0, 4)
          : s.bullets.slice(0, 4).map((b, i) => ({ stepNumber: i + 1, title: `Step ${i + 1}`, description: b }));
        const stepW = (8.8 - (steps.length - 1) * 0.25) / Math.max(1, steps.length);
        steps.forEach((st, pIdx) => {
          const cx = 0.6 + pIdx * (stepW + 0.25);
          slide.addShape(pptx.ShapeType.roundRect, {
            x: cx,
            y: contentTop + 0.25,
            w: stepW,
            h: contentH - 0.5,
            fill: { color: surfaceHex },
            line: { color: accentHex, width: 1.2 },
            rectRadius: 0.08,
          });
          slide.addText(`STEP ${st.stepNumber || pIdx + 1}`, {
            x: cx + 0.15,
            y: contentTop + 0.42,
            w: stepW - 0.3,
            h: 0.3,
            fontFace: titleFont,
            fontSize: 10,
            bold: true,
            color: accentHex,
          });
          slide.addText(st.title, {
            x: cx + 0.15,
            y: contentTop + 0.78,
            w: stepW - 0.3,
            h: 0.5,
            fontFace: titleFont,
            fontSize: 14,
            bold: true,
            color: titleHex,
          });
          slide.addText(st.description, {
            x: cx + 0.15,
            y: contentTop + 1.32,
            w: stepW - 0.3,
            h: contentH - 1.7,
            fontFace: bodyFont,
            fontSize: 12,
            color: bodyHex,
            valign: 'top',
          });
        });
      } else if (s.layout === 'quote-image') {
        if (imgData) {
          slide.addImage({
            data: imgData,
            x: 0.6,
            y: contentTop,
            w: 3.6,
            h: contentH,
            sizing: { type: 'cover', w: 3.6, h: contentH },
          });
        }
        const quoteText = s.quote?.text || s.paragraphs[0] || s.title;
        const quoteAttr = s.quote?.attribution || s.subtitle || '';
        slide.addShape(pptx.ShapeType.rect, {
          x: imgData ? 4.5 : 0.6,
          y: contentTop + 0.2,
          w: imgData ? 4.9 : 8.8,
          h: contentH - 0.4,
          fill: { color: surfaceHex },
          line: { color: borderHex, width: 1 },
        });
        slide.addText(`"${quoteText}"`, {
          x: (imgData ? 4.5 : 0.6) + 0.35,
          y: contentTop + 0.55,
          w: (imgData ? 4.9 : 8.8) - 0.7,
          h: contentH - 1.5,
          fontFace: titleFont,
          fontSize: 19,
          italic: true,
          color: titleHex,
          valign: 'middle',
        });
        if (quoteAttr) {
          slide.addText(`— ${quoteAttr}`, {
            x: (imgData ? 4.5 : 0.6) + 0.35,
            y: contentTop + contentH - 0.85,
            w: (imgData ? 4.9 : 8.8) - 0.7,
            h: 0.4,
            fontFace: bodyFont,
            fontSize: 12,
            bold: true,
            color: accentHex,
          });
        }
      } else if (s.layout === 'chart-analysis' && s.chartData?.data?.length) {
        const chartType =
          s.chartData.type === 'line'
            ? pptx.ChartType.line
            : s.chartData.type === 'pie'
              ? pptx.ChartType.pie
              : pptx.ChartType.bar;
        slide.addChart(
          chartType,
          [
            {
              name: s.chartData.seriesName || 'Values',
              labels: s.chartData.data.map((d) => d.label),
              values: s.chartData.data.map((d) => d.value),
            },
          ],
          {
            x: 0.6,
            y: contentTop,
            w: 5.5,
            h: contentH,
            chartColors: [accentHex, '0F172A', '059669', 'B45309'],
            showLegend: s.chartData.type === 'pie',
            showTitle: true,
            title: s.chartData.title,
            titleFontSize: 12,
            titleColor: titleHex,
          }
        );

        const rightLines = [...s.paragraphs, ...s.bullets].map((t) => ({
          text: t,
          options: { fontFace: bodyFont, fontSize: 13, color: bodyHex, bullet: { code: '2022', color: accentHex }, paraSpaceAfter: 8 },
        }));
        if (rightLines.length > 0) {
          slide.addText(rightLines, {
            x: 6.35,
            y: contentTop + 0.1,
            w: 3.05,
            h: contentH - 0.2,
            valign: 'top',
          });
        }
      } else {
        // closing-summary or fallback with top accent stripe + numbered executive takeaways
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.6,
          y: contentTop,
          w: 8.8,
          h: contentH,
          fill: { color: surfaceHex },
          line: { color: borderHex, width: 1 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.6,
          y: contentTop,
          w: 8.8,
          h: 0.05,
          fill: { color: accentHex },
          line: { color: accentHex },
        });

        let cursorY = contentTop + 0.24;
        if (s.paragraphs.length > 0) {
          const paraH = Math.min(1.15, Math.max(0.55, s.paragraphs.length * 0.42));
          slide.addText(
            s.paragraphs.map((p) => ({
              text: p,
              options: { fontFace: bodyFont, fontSize: 14, color: bodyHex, breakLine: true, paraSpaceAfter: 6 },
            })),
            { x: 0.9, y: cursorY, w: 8.2, h: paraH, valign: 'top' }
          );
          cursorY += paraH + 0.1;
        }

        const visibleBullets = s.bullets.slice(0, 5);
        if (visibleBullets.length > 0) {
          const remainingH = Math.max(1.0, contentTop + contentH - cursorY - 0.16);
          const rowH = Math.min(0.62, remainingH / visibleBullets.length - 0.06);
          visibleBullets.forEach((b, bIdx) => {
            const ry = cursorY + bIdx * (rowH + 0.07);
            slide.addShape(pptx.ShapeType.rect, {
              x: 0.9,
              y: ry,
              w: 8.2,
              h: rowH,
              fill: { color: bgHex },
              line: { color: borderHex, width: 0.75 },
            });
            slide.addText(String(bIdx + 1).padStart(2, '0'), {
              x: 1.05,
              y: ry,
              w: 0.45,
              h: rowH,
              fontFace: titleFont,
              fontSize: 11,
              bold: true,
              color: accentHex,
              valign: 'middle',
            });
            slide.addText(b, {
              x: 1.5,
              y: ry,
              w: 7.45,
              h: rowH,
              fontFace: bodyFont,
              fontSize: 13,
              color: titleHex,
              valign: 'middle',
            });
          });
        }
      }

      // Custom shapes added in editor
      for (const sh of s.shapes || []) {
        const shapeType =
          sh.type === 'circle' ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect;
        slide.addShape(shapeType, {
          x: (sh.x / 100) * W,
          y: (sh.y / 100) * H,
          w: (sh.w / 100) * W,
          h: (sh.h / 100) * H,
          fill: { color: stripHash(sh.color, accentHex), transparency: 15 },
          line: { color: stripHash(sh.color, accentHex), width: 1 },
        });
        if (sh.label) {
          slide.addText(sh.label, {
            x: (sh.x / 100) * W,
            y: (sh.y / 100) * H,
            w: (sh.w / 100) * W,
            h: (sh.h / 100) * H,
            fontFace: bodyFont,
            fontSize: 11,
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
          });
        }
      }

      // Slide footer page number
      slide.addText(`${presentation.title}  ·  ${idx + 1} / ${slides.length}`, {
        x: 0.6,
        y: H - 0.35,
        w: 8.8,
        h: 0.25,
        fontFace: bodyFont,
        fontSize: 9,
        color: mutedHex,
        align: 'right',
      });
    }

    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as Uint8Array);
}

export async function generatePdfBuffer(
  presentation: PresentationRecord,
  slides: SlideData[]
): Promise<Buffer> {
  const is43 = presentation.aspectRatio === '4:3';
  const pageW = 960;
  const pageH = is43 ? 720 : 540;
  const theme = getTheme(presentation.themeId);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [pageW, pageH],
      margin: 0,
      info: {
        Title: presentation.title,
        Author: 'SlideCraft AI',
        Subject: presentation.topic,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    slides.forEach((s, idx) => {
      if (idx > 0) doc.addPage({ size: [pageW, pageH], margin: 0 });

      const bg = s.backgroundColor || theme.canvasBg;
      const surface = theme.surfaceBg;
      const titleColor = s.titleColor || theme.titleColor;
      const bodyColor = s.bodyColor || theme.bodyColor;
      const mutedColor = theme.mutedColor;
      const accentColor = theme.accentColor;
      const borderColor = theme.borderColor;
      const imgPath = resolveLocalImagePath(s.imageUrl);

      doc.rect(0, 0, pageW, pageH).fill(bg);

      if (s.layout === 'full-image-title') {
        if (imgPath) {
          try {
            doc.image(imgPath, 0, 0, { cover: [pageW, pageH] });
          } catch {
            // fallback background
          }
          doc.save().fillOpacity(0.62).rect(0, 0, pageW, pageH).fill('#0F172A').restore();
        } else {
          doc.rect(0, 0, pageW, pageH).fill('#0F172A');
        }

        doc.rect(64, pageH * 0.28, 72, 5).fill(accentColor);
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(34)
          .text(s.title, 64, pageH * 0.33, { width: pageW - 140 });

        if (s.subtitle) {
          doc
            .fillColor('#E2E8F0')
            .font('Helvetica')
            .fontSize(17)
            .text(s.subtitle, 64, pageH * 0.58, { width: pageW - 160 });
        }

        if (s.paragraphs.length > 0) {
          doc
            .fillColor('#CBD5E1')
            .font('Helvetica')
            .fontSize(13)
            .text(s.paragraphs.join(' '), 64, pageH * 0.74, { width: pageW - 180 });
        }
      } else {
        doc.rect(0, 0, pageW, 5).fill(accentColor);
        doc
          .fillColor(accentColor)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(String(idx + 1).padStart(2, '0'), 54, 42);
        doc
          .fillColor(titleColor)
          .font('Helvetica-Bold')
          .fontSize(24)
          .text(s.title, 86, 36, { width: pageW - 140 });

        if (s.subtitle) {
          doc
            .fillColor(mutedColor)
            .font('Helvetica')
            .fontSize(13)
            .text(s.subtitle, 86, 70, { width: pageW - 140 });
        }

        doc.moveTo(54, 102).lineTo(pageW - 54, 102).strokeColor(borderColor).lineWidth(1).stroke();
        doc.rect(54, 100, 68, 3).fill(accentColor);

        const topY = 122;
        const bodyH = pageH - topY - 46;

        if ((s.layout === 'image-left' || s.layout === 'image-right') && imgPath) {
          const isLeft = s.layout === 'image-left';
          const imgX = isLeft ? 54 : 514;
          const textX = isLeft ? 482 : 54;
          try {
            doc.image(imgPath, imgX, topY, { fit: [392, bodyH], align: 'center', valign: 'center' });
          } catch {
            doc.rect(imgX, topY, 392, bodyH).fill(surface);
          }

          let cursorY = topY + 6;
          doc.fillColor(bodyColor).font('Helvetica').fontSize(14);
          for (const p of s.paragraphs) {
            doc.text(p, textX, cursorY, { width: 400 });
            cursorY = doc.y + 12;
          }
          for (const b of s.bullets) {
            doc.fillColor(accentColor).text('•', textX, cursorY);
            doc.fillColor(bodyColor).text(b, textX + 16, cursorY, { width: 384 });
            cursorY = doc.y + 8;
          }
        } else if (s.layout === 'two-column-comparison') {
          const cols = s.comparison?.length
            ? s.comparison.slice(0, 2)
            : [
                { heading: 'Column A', points: s.bullets.slice(0, Math.ceil(s.bullets.length / 2)) },
                { heading: 'Column B', points: s.bullets.slice(Math.ceil(s.bullets.length / 2)) },
              ];
          cols.forEach((col, cIdx) => {
            const cx = cIdx === 0 ? 54 : 494;
            doc.roundedRect(cx, topY, 412, bodyH, 8).fillAndStroke(surface, borderColor);
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(16).text(col.heading, cx + 22, topY + 20, { width: 368 });
            let cy = topY + 52;
            doc.font('Helvetica').fontSize(13);
            for (const pt of col.points || []) {
              doc.fillColor(accentColor).text('•', cx + 22, cy);
              doc.fillColor(bodyColor).text(pt, cx + 38, cy, { width: 350 });
              cy = doc.y + 8;
            }
          });
        } else if (s.layout === 'three-column-cards') {
          const cards = s.featureCards?.length
            ? s.featureCards.slice(0, 3)
            : s.bullets.slice(0, 3).map((b, i) => ({ title: `Pillar ${i + 1}`, description: b }));
          cards.forEach((card, cIdx) => {
            const cx = 54 + cIdx * 290;
            doc.roundedRect(cx, topY, 272, bodyH, 8).fillAndStroke(surface, borderColor);
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(12).text(`0${cIdx + 1}`, cx + 18, topY + 18);
            doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(15).text(card.title, cx + 18, topY + 44, { width: 236 });
            doc.fillColor(bodyColor).font('Helvetica').fontSize(12.5).text(card.description, cx + 18, doc.y + 10, { width: 236 });
          });
        } else if (s.layout === 'stat-highlight') {
          const stats = s.stats?.length ? s.stats.slice(0, 3) : [{ value: 'Key', label: s.title, context: '' }];
          const w = stats.length === 1 ? 852 : stats.length === 2 ? 416 : 272;
          stats.forEach((st, sIdx) => {
            const cx = 54 + sIdx * (w + 18);
            doc.roundedRect(cx, topY, w, 190, 8).fillAndStroke(surface, borderColor);
            doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(30).text(st.value, cx + 20, topY + 22, { width: w - 40 });
            doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(13).text(st.label, cx + 20, topY + 72, { width: w - 40 });
            if (st.context) {
              doc.fillColor(mutedColor).font('Helvetica').fontSize(11).text(st.context, cx + 20, topY + 112, { width: w - 40 });
            }
          });
          const summary = [...s.paragraphs, ...s.bullets].join('  •  ');
          if (summary) {
            doc.fillColor(bodyColor).font('Helvetica').fontSize(13).text(summary, 54, topY + 215, { width: 852 });
          }
        } else if (s.layout === 'chart-analysis' && s.chartData?.data?.length) {
          const chartX = 54;
          const chartW = 490;
          const chartH = bodyH - 20;
          doc.roundedRect(chartX, topY, chartW, chartH, 8).fillAndStroke(surface, borderColor);
          doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(13).text(s.chartData.title, chartX + 20, topY + 18);

          const maxVal = Math.max(1, ...s.chartData.data.map((d) => d.value));
          const barAreaTop = topY + 55;
          const barAreaH = chartH - 95;
          const barStep = (chartW - 60) / s.chartData.data.length;

          s.chartData.data.forEach((d, dIdx) => {
            const bh = (d.value / maxVal) * barAreaH;
            const bx = chartX + 35 + dIdx * barStep;
            const by = barAreaTop + (barAreaH - bh);
            const bw = Math.min(48, barStep * 0.6);
            doc.rect(bx, by, bw, bh).fill(accentColor);
            doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(10).text(String(d.value), bx, by - 14, { width: bw, align: 'center' });
            doc.fillColor(mutedColor).font('Helvetica').fontSize(9).text(d.label, bx - 6, barAreaTop + barAreaH + 8, { width: bw + 12, align: 'center' });
          });

          let cy = topY + 10;
          doc.font('Helvetica').fontSize(13);
          for (const p of s.paragraphs) {
            doc.fillColor(bodyColor).text(p, 568, cy, { width: 338 });
            cy = doc.y + 10;
          }
          for (const b of s.bullets) {
            doc.fillColor(accentColor).text('•', 568, cy);
            doc.fillColor(bodyColor).text(b, 584, cy, { width: 322 });
            cy = doc.y + 8;
          }
        } else {
          // timeline, process-diagram, quote-image, closing-summary
          let cy = topY + 10;
          if (s.quote?.text) {
            doc.roundedRect(54, topY, 852, 180, 8).fillAndStroke(surface, borderColor);
            doc.fillColor(titleColor).font('Helvetica-Oblique').fontSize(19).text(`"${s.quote.text}"`, 84, topY + 36, { width: 792 });
            if (s.quote.attribution) {
              doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(13).text(`— ${s.quote.attribution}`, 84, topY + 135);
            }
            cy = topY + 205;
          } else if (s.timeline?.length) {
            const stepW = 852 / s.timeline.length;
            s.timeline.forEach((item, tIdx) => {
              const cx = 54 + tIdx * stepW;
              doc.roundedRect(cx, topY + 20, stepW - 14, bodyH - 40, 8).fillAndStroke(surface, borderColor);
              doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(11).text(item.date, cx + 14, topY + 36, { width: stepW - 42 });
              doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(13).text(item.title, cx + 14, topY + 60, { width: stepW - 42 });
              doc.fillColor(bodyColor).font('Helvetica').fontSize(11.5).text(item.description, cx + 14, doc.y + 8, { width: stepW - 42 });
            });
            cy = pageH;
          } else if (s.processSteps?.length) {
            const stepW = 852 / s.processSteps.length;
            s.processSteps.forEach((st, pIdx) => {
              const cx = 54 + pIdx * stepW;
              doc.roundedRect(cx, topY + 20, stepW - 14, bodyH - 40, 8).fillAndStroke(surface, accentColor);
              doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(10).text(`STEP ${st.stepNumber || pIdx + 1}`, cx + 14, topY + 36);
              doc.fillColor(titleColor).font('Helvetica-Bold').fontSize(14).text(st.title, cx + 14, topY + 60, { width: stepW - 42 });
              doc.fillColor(bodyColor).font('Helvetica').fontSize(12).text(st.description, cx + 14, doc.y + 8, { width: stepW - 42 });
            });
            cy = pageH;
          }

          if (cy < pageH - 60) {
            doc.font('Helvetica').fontSize(14);
            for (const p of s.paragraphs) {
              doc.fillColor(bodyColor).text(p, 54, cy, { width: 852 });
              cy = doc.y + 10;
            }
            for (const b of s.bullets) {
              doc.fillColor(accentColor).text('•', 54, cy);
              doc.fillColor(bodyColor).text(b, 72, cy, { width: 834 });
              cy = doc.y + 8;
            }
          }
        }

        doc
          .fillColor(mutedColor)
          .font('Helvetica')
          .fontSize(10)
          .text(`${presentation.title}  ·  Slide ${idx + 1} of ${slides.length}`, 54, pageH - 28, {
            width: pageW - 108,
            align: 'right',
          });
      }
    });

    doc.end();
  });
}

export function generateOutlineText(presentation: PresentationRecord, slides: SlideData[]): string {
  const lines: string[] = [
    `${presentation.title}`,
    `Topic: ${presentation.topic}`,
    `Audience: ${presentation.audience} | Purpose: ${presentation.purpose} | Language: ${presentation.language} | Ratio: ${presentation.aspectRatio}`,
    '='.repeat(72),
    '',
  ];

  slides.forEach((s, idx) => {
    lines.push(`SLIDE ${idx + 1}: ${s.title} [${s.layout}]`);
    if (s.subtitle) lines.push(`Subtitle: ${s.subtitle}`);
    for (const p of s.paragraphs) {
      lines.push(`  ${p}`);
    }
    for (const b of s.bullets) {
      lines.push(`  - ${b}`);
    }
    if (s.stats?.length) {
      for (const st of s.stats) {
        lines.push(`  * ${st.value} — ${st.label}${st.context ? ` (${st.context})` : ''}`);
      }
    }
    if (s.timeline?.length) {
      for (const tm of s.timeline) {
        lines.push(`  [${tm.date}] ${tm.title}: ${tm.description}`);
      }
    }
    if (s.processSteps?.length) {
      for (const ps of s.processSteps) {
        lines.push(`  Step ${ps.stepNumber}: ${ps.title} — ${ps.description}`);
      }
    }
    if (s.comparison?.length) {
      for (const col of s.comparison) {
        lines.push(`  Column (${col.heading}): ${col.points.join('; ')}`);
      }
    }
    if (s.quote?.text) {
      lines.push(`  "${s.quote.text}" — ${s.quote.attribution}`);
    }
    if (s.speakerNotes) {
      lines.push(`  Speaker Notes: ${s.speakerNotes}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
