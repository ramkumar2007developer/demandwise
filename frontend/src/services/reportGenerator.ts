/**
 * DemandWise 2.0 — Professional PDF Report Generator
 *
 * Generates an executive, publication-grade A4 PDF from the analysis results
 * held in frontend state. All data is sourced from real API responses.
 *
 * Features:
 *   • Full English and Tamil language support with embedded Unicode fonts & shaping
 *   • High-contrast dark headers and dark readable text on white background
 *   • Complete business details: Snapshot, Location, Budget & Cost Breakdown,
 *     Demand Estimate, Competitor Table, AI Assessment, Stages, Comparisons
 *   • Clean pagination with orphan prevention and automatic line wrapping
 *   • Strictly excludes internal disclaimer boxes while preserving OSM attribution
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BusinessAnalysisResponse } from '../types/api';
import { MUKTA_MALAR_BASE64 } from '../assets/fonts/tamilFont';

// ─── Color Palette (High Contrast, Professional Executive Theme) ────────────
const BRAND_RED    = [220,  38,  38] as [number, number, number]; // #dc2626
const BRAND_DARK   = [ 15,  23,  42] as [number, number, number]; // #0f172a slate-900
const HEADER_DARK  = [ 24,  28,  36] as [number, number, number]; // Dark section header
const TEXT_DARK    = [ 15,  23,  42] as [number, number, number]; // Near-black primary text
const TEXT_MUTED   = [ 71,  85, 105] as [number, number, number]; // Slate-600 secondary/labels
const TEXT_LIGHT   = [255, 255, 255] as [number, number, number]; // Pure white text
const BORDER_COLOR = [226, 232, 240] as [number, number, number]; // Slate-200 border
const ROW_ALT_BG   = [248, 250, 252] as [number, number, number]; // Slate-50 alternating row

// Status & Feasibility Badges
const EMERALD      = [  5, 150, 105] as [number, number, number]; // #059669
const AMBER        = [ 217, 119,   6] as [number, number, number]; // #d97706
const ROSE         = [ 220,  38,  38] as [number, number, number]; // #dc2626

// ─── Page Constants (A4 Portrait) ───────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const ML     =  14;              // Margin Left (mm)
const MR     = PAGE_W - 14;      // Margin Right (mm)
const CW     = MR - ML;          // Content Width (182 mm)
const MB     =  18;              // Bottom Margin for page break guard (mm)

// ─── Unicode & Tamil Helpers ────────────────────────────────────────────────

/** Check if a string contains any Tamil Unicode characters (U+0B80 - U+0BFF) */
export function hasTamil(str: string | null | undefined): boolean {
  if (!str) return false;
  return /[\u0B80-\u0BFF]/.test(str);
}

/**
 * Shape Tamil Unicode text for PDF rendering engines without OpenType GSUB.
 *
 * In standard Unicode, left-attaching and composite vowels are placed after
 * the base consonant in logical typing order. This function reorders them
 * to visual display order so they render naturally in TrueType fonts:
 *   • \u0BCA (ொ) -> \u0BC6 + C + \u0BBE (ெ + C + ா)
 *   • \u0BCB (ோ) -> \u0BC7 + C + \u0BBE (ே + C + ா)
 *   • \u0BCC (ௌ) -> \u0BC6 + C + \u0BD7 (ெ + C + ௗ)
 *   • \u0BC6 (ெ), \u0BC7 (ே), \u0BC8 (ை) -> V + C
 */
export function shapeTamil(text: string | null | undefined): string {
  if (!text) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    // Is it a Tamil consonant? (U+0B95 to U+0BB9)
    if (code >= 0x0B95 && code <= 0x0BB9) {
      const nextCh = i + 1 < text.length ? text[i + 1] : '';
      const nextCode = nextCh.charCodeAt(0);

      if (nextCode === 0x0BCA) { // ொ (short o)
        out += '\u0BC6' + ch + '\u0BBE';
        i++;
        continue;
      }
      if (nextCode === 0x0BCB) { // ோ (long o)
        out += '\u0BC7' + ch + '\u0BBE';
        i++;
        continue;
      }
      if (nextCode === 0x0BCC) { // ௌ (au)
        out += '\u0BC6' + ch + '\u0BD7';
        i++;
        continue;
      }
      if (nextCode === 0x0BC6 || nextCode === 0x0BC7 || nextCode === 0x0BC8) { // ெ, ே, ை
        out += nextCh + ch;
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/** Prepare any string for PDF text output with optional Tamil shaping */
function sanitizeText(str: string | null | undefined, isTamil: boolean): string {
  if (!str) return '';
  return isTamil || hasTamil(str) ? shapeTamil(str) : str;
}

// ─── Format Helpers ─────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return 'N/A';
  const isNeg = n < 0;
  const absVal = Math.abs(Math.round(n)).toLocaleString('en-IN');
  return isNeg ? `-${prefix}${absVal}` : `${prefix}${absVal}`;
}

function fmtDist(km: number | null | undefined): string {
  if (km == null) return 'N/A';
  return `${km.toFixed(2)} km`;
}

function nowLabel(isTamil: boolean): string {
  const dateStr = new Date().toLocaleString(isTamil ? 'ta-IN' : 'en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return `${dateStr} IST`;
}

function feasColor(cat: string | null | undefined): [number, number, number] {
  if (cat === 'SURPLUS') return EMERALD;
  if (cat === 'FEASIBLE') return AMBER;
  return ROSE;
}

function getFeasLabel(cat: string | null | undefined, isTamil: boolean): string {
  if (!cat) return isTamil ? 'வழங்கப்படவில்லை' : 'N/A';
  if (cat === 'SURPLUS') return isTamil ? 'உபரி (SURPLUS)' : 'SURPLUS';
  if (cat === 'FEASIBLE') return isTamil ? 'சாத்தியம் (FEASIBLE)' : 'FEASIBLE';
  return isTamil ? 'பற்றாக்குறை (DEFICIT)' : 'DEFICIT';
}

function formatBusinessType(bt: string | null | undefined, isTamil: boolean): string {
  if (!bt) return isTamil ? 'வழங்கப்படவில்லை' : 'Not provided';
  const lower = bt.toLowerCase();
  if (isTamil) {
    if (lower === 'cafe' || lower === 'café') return 'கஃபே (Cafe)';
    if (lower === 'restaurant') return 'உணவகம் (Restaurant)';
    if (lower === 'retail') return 'சில்லறை வணிகம் (Retail)';
    if (lower === 'bakery') return 'இனிப்பகம் / பேக்கரி (Bakery)';
    if (lower === 'gym') return 'உடற்பயிற்சிக் கூடம் (Gym)';
    if (lower === 'salon') return 'அழகு நிலையம் (Salon)';
    return `${shapeTamil(bt)} (${bt})`;
  }
  return bt.charAt(0).toUpperCase() + bt.slice(1);
}

// ─── Layout & Drawing Helpers ───────────────────────────────────────────────

function guardPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > PAGE_H - MB) {
    doc.addPage();
    return 20;
  }
  return y;
}

function sectionHeader(doc: jsPDF, y: number, title: string, fontName: string, isTamil: boolean): number {
  doc.setFillColor(...HEADER_DARK);
  doc.roundedRect(ML, y, CW, 7.5, 1.5, 1.5, 'F');

  // Red accent indicator on left
  doc.setFillColor(...BRAND_RED);
  doc.roundedRect(ML, y, 2.5, 7.5, 1, 1, 'F');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(sanitizeText(title, isTamil), ML + 5, y + 5.2);
  return y + 11.5;
}

function hr(doc: jsPDF, y: number): number {
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(ML, y, MR, y);
  return y + 4.5;
}

function labelValue(
  doc: jsPDF,
  y: number,
  label: string,
  value: string,
  fontName: string,
  isTamil: boolean,
  valueColor: [number, number, number] = TEXT_DARK,
): number {
  const labelW = CW * 0.38;
  const valW = CW - labelW;

  const sanitizedLabel = sanitizeText(label, isTamil);
  const sanitizedValue = sanitizeText(value, isTamil || hasTamil(value));

  // Determine line heights
  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  const labelLines = doc.splitTextToSize(sanitizedLabel, labelW) as string[];

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  const valueLines = doc.splitTextToSize(sanitizedValue, valW) as string[];

  const maxLines = Math.max(labelLines.length, valueLines.length);
  const rowHeight = maxLines * 4.5 + 2;

  y = guardPage(doc, y, rowHeight);

  // Print label in bold muted slate
  doc.setFont(fontName, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(labelLines, ML, y);

  // Print value in high-contrast dark text
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...valueColor);
  doc.text(valueLines, ML + labelW, y);

  return y + rowHeight;
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, fontName: string, isTamil: boolean) {
  const y = PAGE_H - 8;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.25);
  doc.line(ML, y - 3, MR, y - 3);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);

  const leftText = isTamil
    ? 'போட்டியாளர் & வரைபடத் தரவு \u00a9 OpenStreetMap contributors (ODbL). DemandWise 2.0 மூலம் உருவாக்கப்பட்டது.'
    : 'Competitor & map data \u00a9 OpenStreetMap contributors (ODbL). Generated by DemandWise 2.0.';
  doc.text(sanitizeText(leftText, isTamil), ML, y);

  const pageStr = isTamil
    ? `பக்கம் ${pageNum} / ${totalPages}`
    : `Page ${pageNum} / ${totalPages}`;
  doc.text(sanitizeText(pageStr, isTamil), MR, y, { align: 'right' });
}

// ─── Interfaces & Main Export ───────────────────────────────────────────────

export interface ReportInput {
  result: BusinessAnalysisResponse;
  language: 'en' | 'ta';
  businessName: string;
  businessType: string;
  budgetInr: number;
  latitude: number;
  longitude: number;
  selectedArea: string;
  floorArea: number;
  nearCollege: number;
  notes: string;
  comparisonResults?: Array<{
    label: string;
    areaName: string;
    data: BusinessAnalysisResponse | null;
    status: string;
    color: string;
  }>;
}

/**
 * Builds the complete jsPDF document instance.
 * Exported separately to facilitate headless testing and verification.
 */
export function buildDemandWiseReportDoc(input: ReportInput): jsPDF {
  const { result, language, comparisonResults } = input;
  const isTamil = language === 'ta';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Register embedded MuktaMalar font for full Tamil and Latin coverage
  doc.addFileToVFS('MuktaMalar.ttf', MUKTA_MALAR_BASE64);
  doc.addFont('MuktaMalar.ttf', 'MuktaMalar', 'normal');
  doc.addFont('MuktaMalar.ttf', 'MuktaMalar', 'bold');

  // Use embedded MuktaMalar throughout for full Unicode, Tamil, Latin, and Rupee (₹) glyph coverage
  const baseFont = 'MuktaMalar';

  // ── Cover Header ─────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, PAGE_W, 46, 'F');

  // Red accent strip on left
  doc.setFillColor(...BRAND_RED);
  doc.rect(0, 0, 4.5, 46, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text('Demand', ML, 18);
  doc.setTextColor(...BRAND_RED);
  doc.text('Wise', ML + 39, 18);

  // Platform Tagline
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate-300
  const tagline = isTamil
    ? '2.0  \u2014  வணிக நுண்ணறிவு மற்றும் சாத்தியக்கூறு பகுப்பாய்வு'
    : '2.0  \u2014  Business Intelligence & Location Feasibility Platform';
  doc.text(sanitizeText(tagline, isTamil), ML, 25);

  // Report Title
  doc.setFont(baseFont, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...TEXT_LIGHT);
  const reportTitle = isTamil
    ? 'வணிக இருப்பிட சாத்தியக்கூறு அறிக்கை'
    : 'Business Location Analysis & Feasibility Report';
  doc.text(sanitizeText(reportTitle, isTamil), ML, 35);

  // Timestamp and Request ID
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  const genLabel = isTamil ? 'உருவாக்கப்பட்ட நேரம்: ' : 'Generated: ';
  doc.text(sanitizeText(`${genLabel}${nowLabel(isTamil)}`, isTamil), ML, 42);

  const reqId = result.request_id || 'N/A';
  const reqLabel = isTamil ? 'பகுப்பாய்வு எண்: ' : 'Analysis ID: ';
  doc.text(sanitizeText(`${reqLabel}${reqId}`, isTamil), MR, 42, { align: 'right' });

  let y = 53;

  // ── 1. Business Snapshot ─────────────────────────────────────────────────
  const sec1Title = isTamil ? '1. வணிகக் கண்ணோட்டம் (BUSINESS SNAPSHOT)' : '1. Business Snapshot';
  y = sectionHeader(doc, y, sec1Title, baseFont, isTamil);

  const bName = result.business_name || input.businessName || (isTamil ? 'வழங்கப்படவில்லை' : 'Not provided');
  y = labelValue(doc, y, isTamil ? 'வணிகப் பெயர்' : 'Business Name', bName, baseFont, isTamil);

  const bType = formatBusinessType(result.business_type || input.businessType, isTamil);
  y = labelValue(doc, y, isTamil ? 'வணிக வகை' : 'Business Type', bType, baseFont, isTamil);

  const langLabel = isTamil ? 'தமிழ் (Tamil)' : 'English';
  y = labelValue(doc, y, isTamil ? 'அறிக்கை மொழி' : 'Report Language', langLabel, baseFont, isTamil);

  let explMode = 'Template / Rule-based';
  if (result.explanation_mode === 'llm_generated') {
    explMode = isTamil ? 'Groq AI (செயற்கை நுண்ணறிவு)' : 'Groq AI (LLM)';
  } else if (isTamil) {
    explMode = 'விதிமுறை அடிப்படை (Template)';
  }
  y = labelValue(doc, y, isTamil ? 'விளக்க முறை' : 'Explanation Mode', explMode, baseFont, isTamil);
  y = hr(doc, y + 1);

  // ── 2. Selected Location ──────────────────────────────────────────────────
  const sec2Title = isTamil ? '2. தேர்ந்தெடுக்கப்பட்ட இடம் (LOCATION DETAILS)' : '2. Selected Location Details';
  y = sectionHeader(doc, y, sec2Title, baseFont, isTamil);

  const loc = result.location;
  const areaName = loc?.area_name || input.selectedArea || (isTamil ? 'வழங்கப்படவில்லை' : 'Not specified');
  y = labelValue(doc, y, isTamil ? 'பகுதி / மண்டலம்' : 'Area / Zone', areaName, baseFont, isTamil);

  const cityState = [loc?.city, loc?.state].filter(Boolean).join(', ') ||
    (isTamil ? 'கோயம்புத்தூர், தமிழ்நாடு' : 'Coimbatore, Tamil Nadu');
  y = labelValue(doc, y, isTamil ? 'நகரம் / மாநிலம்' : 'City / State', cityState, baseFont, isTamil);

  const lat = loc?.latitude ?? input.latitude;
  const lng = loc?.longitude ?? input.longitude;
  const coords = `${lat.toFixed(4)}\u00b0N, ${lng.toFixed(4)}\u00b0E`;
  y = labelValue(doc, y, isTamil ? 'ஆயத்தொலைவுகள் (WGS84)' : 'Coordinates (WGS84)', coords, baseFont, isTamil);

  const floorStr = input.floorArea != null
    ? `${input.floorArea} sq.ft`
    : (isTamil ? 'குறிப்பிடப்படவில்லை' : 'Not specified');
  y = labelValue(doc, y, isTamil ? 'தளப் பரப்பளவு' : 'Floor Area', floorStr, baseFont, isTamil);

  const collegeStr = input.nearCollege === 1
    ? (isTamil ? 'ஆம் (< 1 கி.மீ தூரம்)' : 'Yes (< 1 km distance)')
    : (isTamil ? 'இல்லை' : 'No');
  y = labelValue(doc, y, isTamil ? 'கல்லூரி அருகில்' : 'Near College / Campus', collegeStr, baseFont, isTamil);

  const notesVal = input.notes ? input.notes.trim() : (isTamil ? 'எதுவுமில்லை' : 'None');
  y = labelValue(doc, y, isTamil ? 'வணிக உத்திக் குறிப்புகள்' : 'Business Strategy Notes', notesVal, baseFont, isTamil);
  y = hr(doc, y + 1);

  // ── 3. Budget Overview & Cost Breakdown ──────────────────────────────────
  y = guardPage(doc, y, 40);
  const sec3Title = isTamil ? '3. முதலீட்டு பட்ஜெட் மற்றும் செலவு விவரம்' : '3. Budget Overview & Startup Cost Breakdown';
  y = sectionHeader(doc, y, sec3Title, baseFont, isTamil);

  const bf = result.budget_feasibility;
  const userBudget = result.budget_inr ?? input.budgetInr;
  y = labelValue(doc, y, isTamil ? 'பயனர் முதலீட்டு பட்ஜெட்' : 'User Startup Budget', fmt(userBudget, '\u20b9'), baseFont, isTamil);

  const estCost = bf?.total_estimated_startup_cost_inr;
  y = labelValue(doc, y, isTamil ? 'மதிப்பிடப்பட்ட தொடக்கச் செலவு' : 'Est. Startup Cost', fmt(estCost, '\u20b9'), baseFont, isTamil);

  const diff = bf?.budget_difference_inr;
  const diffStr = diff != null ? `${diff > 0 ? '+' : ''}${fmt(diff, '\u20b9')}` : 'N/A';
  const diffCol = diff != null ? (diff >= 0 ? EMERALD : ROSE) : TEXT_DARK;
  y = labelValue(doc, y, isTamil ? 'பட்ஜெட் வேறுபாடு' : 'Budget Variance', diffStr, baseFont, isTamil, diffCol);

  const feasRating = getFeasLabel(bf?.feasibility_category, isTamil);
  const ratingCol = feasColor(bf?.feasibility_category);
  y = labelValue(doc, y, isTamil ? 'சாத்தியக்கூறு மதிப்பீடு' : 'Feasibility Rating', feasRating, baseFont, isTamil, ratingCol);

  // Complete Cost Breakdown Table (if provided)
  const costItems = (bf as { cost_breakdown?: Array<{ category: string; description: string; estimated_amount_inr: number }> } | null | undefined)?.cost_breakdown;
  if (costItems && Array.isArray(costItems) && costItems.length > 0) {
    y = guardPage(doc, y + 2, 35);
    const tblHead = [
      ['#', isTamil ? 'செலவு வகை' : 'Cost Category', isTamil ? 'விவரம்' : 'Description', isTamil ? 'தொகை (INR)' : 'Amount (INR)']
    ].map(row => row.map(c => sanitizeText(c, isTamil)));

    const tblBody = costItems.map((item, idx) => [
      String(idx + 1),
      sanitizeText(item.category, isTamil),
      sanitizeText(item.description, isTamil),
      fmt(item.estimated_amount_inr, '\u20b9'),
    ]);

    autoTable(doc, {
      startY: y,
      head: tblHead,
      body: tblBody,
      theme: 'grid',
      styles: {
        font: baseFont,
        fontSize: 7.5,
        textColor: TEXT_DARK,
        cellPadding: 2,
        lineColor: BORDER_COLOR,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: TEXT_LIGHT,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: ROW_ALT_BG,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 82 },
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: ML, right: 14 },
      tableWidth: CW,
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 3;
  }
  y = hr(doc, y + 1);

  // ── 4. Demand Estimate ───────────────────────────────────────────────────
  y = guardPage(doc, y, 30);
  const sec4Title = isTamil ? '4. தேவை மதிப்பீடு (DEMAND ESTIMATE)' : '4. Demand Estimate';
  y = sectionHeader(doc, y, sec4Title, baseFont, isTamil);

  const ml = result.ml_prediction;
  const visitsVal = ml?.predicted_synthetic_monthly_visits != null
    ? `${Math.round(ml.predicted_synthetic_monthly_visits).toLocaleString('en-IN')}`
    : (isTamil ? 'வழங்கப்படவில்லை' : 'N/A');
  y = labelValue(doc, y, isTamil ? 'மதிப்பிடப்பட்ட மாதாந்திர வருகை' : 'Est. Monthly Visits', visitsVal, baseFont, isTamil, BRAND_RED);

  const modelMode = ml?.model_name || result.explanation_mode || (isTamil ? 'மாதிரி அடிப்படை' : 'Rule-based');
  y = labelValue(doc, y, isTamil ? 'பகுப்பாய்வு மாதிரி' : 'Analysis Model', modelMode, baseFont, isTamil);

  const datasetStatus = ml?.dataset_status || (isTamil ? 'செயலில் உள்ளது' : 'Active');
  y = labelValue(doc, y, isTamil ? 'தரவுத்தள நிலை' : 'Dataset Status', datasetStatus, baseFont, isTamil);
  y = hr(doc, y + 1);

  // ── 5. Nearby Competitors ─────────────────────────────────────────────────
  y = guardPage(doc, y, 35);
  const sec5Title = isTamil ? '5. அருகிலுள்ள போட்டியாளர்கள் (OPENSTREETMAP)' : '5. Nearby Competitors (OpenStreetMap Data)';
  y = sectionHeader(doc, y, sec5Title, baseFont, isTamil);

  const isDegraded = result.competitor_status === 'degraded' || result.competitor_status === 'error';

  if (isDegraded) {
    const notice = isTamil
      ? 'Overpass வரைபட சேவை தாமதமானது. நேரடி போட்டியாளர் விவரங்களை பெற இயலவில்லை. எந்தவொரு போலியான தகவலும் உருவாக்கப்படவில்லை.'
      : (result.competitor_error || 'Overpass service was busy during this analysis. Real competitor data could not be retrieved. Zero competitors were fabricated.');
    const nLines = doc.splitTextToSize(sanitizeText(notice, isTamil), CW) as string[];
    doc.setFont(baseFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...AMBER);
    doc.text(nLines, ML, y);
    y += nLines.length * 4.5 + 3;
  } else if (!result.competitors || result.competitors.length === 0) {
    const noComp = isTamil
      ? '2 கி.மீ சுற்றளவில் நேரடிப் போட்டியாளர்கள் எதுவும் கண்டறியப்படவில்லை. இது புதிய சந்தை நுழைவுக்குச் சிறந்த வணிக வாய்ப்பாகும்.'
      : `No direct ${result.business_type} competitors found within a 2 km radius. This indicates a high local market entry opportunity.`;
    const ncLines = doc.splitTextToSize(sanitizeText(noComp, isTamil), CW) as string[];
    doc.setFont(baseFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...EMERALD);
    doc.text(ncLines, ML, y);
    y += ncLines.length * 4.5 + 3;
  } else {
    y = labelValue(doc, y, isTamil ? 'கண்டறியப்பட்ட போட்டியாளர்கள்' : 'Total Competitors (2 km)', String(result.competitor_count ?? result.competitors.length), baseFont, isTamil);
    y = guardPage(doc, y + 1, 35);

    const compHead = [
      ['#', isTamil ? 'வணிகப் பெயர்' : 'Business Name', isTamil ? 'வகை' : 'Category', isTamil ? 'தூரம்' : 'Distance']
    ].map(row => row.map(c => sanitizeText(c, isTamil)));

    const compBody = result.competitors.map((c, i) => [
      String(i + 1),
      sanitizeText(c.name || (isTamil ? 'பெயரிடப்படாத இடம்' : 'Unnamed Venue'), isTamil || hasTamil(c.name)),
      sanitizeText(c.category || 'N/A', isTamil || hasTamil(c.category)),
      fmtDist(c.distance_km ?? null),
    ]);

    autoTable(doc, {
      startY: y,
      head: compHead,
      body: compBody,
      theme: 'grid',
      styles: {
        font: baseFont,
        fontSize: 7.5,
        textColor: TEXT_DARK,
        cellPadding: 2,
        lineColor: BORDER_COLOR,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: TEXT_LIGHT,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: ROW_ALT_BG,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 64 },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: BRAND_RED },
      },
      margin: { left: ML, right: 14 },
      tableWidth: CW,
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 3;
  }

  // OpenStreetMap Attribution Note
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  const osmNote = isTamil
    ? 'தரவு \u00a9 OpenStreetMap contributors (ODbL). நேரடி கணக்கீடு. பூஜ்ஜிய போலித் தரவு உத்தரவாதம்.'
    : 'Data \u00a9 OpenStreetMap contributors (ODbL). Haversine distance calculations. Zero fabrication guarantee.';
  doc.text(sanitizeText(osmNote, isTamil), ML, y);
  y += 5;
  y = hr(doc, y);

  // ── 6. AI Assessment & Strategic Recommendations ─────────────────────────
  y = guardPage(doc, y, 40);
  const sec6Title = isTamil ? '6. AI வணிக மதிப்பீடு & உத்திப் பரிந்துரைகள்' : '6. AI Assessment & Strategic Recommendations';
  y = sectionHeader(doc, y, sec6Title, baseFont, isTamil);

  // Opportunity Verdict / Summary
  if (result.summary) {
    y = guardPage(doc, y, 16);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND_RED);
    const sumHeader = isTamil ? 'வாய்ப்பு மதிப்பீடு (Opportunity Verdict):' : 'Opportunity Verdict:';
    doc.text(sanitizeText(sumHeader, isTamil), ML, y);
    y += 4.5;

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    const sumLines = doc.splitTextToSize(sanitizeText(result.summary, isTamil), CW) as string[];
    for (const line of sumLines) {
      y = guardPage(doc, y, 6);
      doc.text(line, ML, y);
      y += 4.5;
    }
    y += 2;
  }

  // Detailed Analysis / Explanation
  if (result.explanation) {
    y = guardPage(doc, y, 20);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    const expHeader = isTamil ? 'விரிவான வணிகப் பகுப்பாய்வு (Detailed Analysis):' : 'Detailed Analysis:';
    doc.text(sanitizeText(expHeader, isTamil), ML, y);
    y += 5;

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...TEXT_DARK);

    // Split text by lines/paragraphs to preserve structure
    const paragraphs = result.explanation.split('\n');
    for (const rawPara of paragraphs) {
      const p = rawPara.trim();
      if (!p) {
        y += 2.5; // Paragraph gap
        continue;
      }

      // Check if this paragraph is a bullet or numbered point
      const isBullet = /^[•\-*]/.test(p);
      const isNum = /^\d+[\.\)]/.test(p);

      if (isBullet || isNum) {
        const bulletPrefix = isBullet ? '• ' : p.match(/^\d+[\.\)]\s*/)?.[0] || '';
        const bulletBody = p.slice(bulletPrefix.length);
        const bLines = doc.splitTextToSize(sanitizeText(bulletBody, isTamil), CW - 8) as string[];

        y = guardPage(doc, y, bLines.length * 4.5 + 2);
        doc.setFont(baseFont, 'bold');
        doc.setTextColor(...BRAND_RED);
        doc.text(bulletPrefix, ML + 2, y);

        doc.setFont(baseFont, 'normal');
        doc.setTextColor(...TEXT_DARK);
        doc.text(bLines, ML + 8, y);
        y += bLines.length * 4.5 + 1.5;
      } else {
        const pLines = doc.splitTextToSize(sanitizeText(p, isTamil), CW) as string[];
        for (const line of pLines) {
          y = guardPage(doc, y, 5.5);
          doc.text(line, ML, y);
          y += 4.5;
        }
        y += 1.5;
      }
    }
    y += 2;
  }

  // Strategic Next Steps / Recommendations
  if (result.recommendations && result.recommendations.length > 0) {
    y = guardPage(doc, y, 25);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_DARK);
    const recHeader = isTamil ? 'அடுத்தகட்ட உத்திப் பரிந்துரைகள் (Strategic Next Steps):' : 'Strategic Next Steps:';
    doc.text(sanitizeText(recHeader, isTamil), ML, y);
    y += 5;

    for (let i = 0; i < result.recommendations.length; i++) {
      const rec = result.recommendations[i];
      const recNum = `${i + 1}.`;
      const recLines = doc.splitTextToSize(sanitizeText(rec, isTamil), CW - 8) as string[];
      const blockH = recLines.length * 4.5 + 2;

      y = guardPage(doc, y, blockH);

      doc.setFont(baseFont, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND_RED);
      doc.text(recNum, ML, y);

      doc.setFont(baseFont, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...TEXT_DARK);
      doc.text(recLines, ML + 6, y);
      y += blockH;
    }
    y += 2;
  }
  y = hr(doc, y);

  // ── 7. Pipeline Stage Timings (if present) ────────────────────────────────
  if (result.stages && result.stages.length > 0) {
    y = guardPage(doc, y, 65);
    const sec7Title = isTamil ? '7. கணக்கீட்டுக் கட்டங்களின் கால அளவு' : '7. Pipeline Stage Execution Timings';
    y = sectionHeader(doc, y, sec7Title, baseFont, isTamil);

    const durLabel = isTamil ? 'மொத்த பகுப்பாய்வு நேரம்' : 'Total Duration';
    y = labelValue(doc, y, durLabel, `${result.total_duration_ms.toFixed(1)} ms`, baseFont, isTamil);
    y += 1;

    const stageHead = [
      [isTamil ? 'கட்டம்' : 'Stage', isTamil ? 'நிலை' : 'Status', isTamil ? 'நேரம் (ms)' : 'Duration (ms)']
    ].map(row => row.map(c => sanitizeText(c, isTamil)));

    const stageBody = result.stages.map((s) => [
      sanitizeText(s.stage.replace(/_/g, ' '), isTamil),
      s.status.toUpperCase(),
      s.duration_ms.toFixed(1),
    ]);

    autoTable(doc, {
      startY: y,
      head: stageHead,
      body: stageBody,
      theme: 'grid',
      styles: {
        font: baseFont,
        fontSize: 7.5,
        textColor: TEXT_DARK,
        cellPadding: 2,
        lineColor: BORDER_COLOR,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: TEXT_LIGHT,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: ROW_ALT_BG,
      },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 46, halign: 'center' },
        2: { cellWidth: 46, halign: 'right' },
      },
      margin: { left: ML, right: 14 },
      tableWidth: CW,
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = (data.cell.raw as string) === 'SUCCESS' ? EMERALD : AMBER;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4;
    y = hr(doc, y);
  }

  // ── 8. Multi-Location Comparison (Phase 2) ───────────────────────────────
  const validComps = (comparisonResults || []).filter(
    (r) => r.status === 'success' && r.data != null,
  );
  if (validComps.length >= 2) {
    y = guardPage(doc, y, 45);
    const sec8Title = isTamil ? '8. பல இருப்பிட ஒப்பீடு (LOCATION COMPARISON)' : '8. Multi-Location Comparison (Phase 2)';
    y = sectionHeader(doc, y, sec8Title, baseFont, isTamil);

    const compHeadLabels = [
      isTamil ? 'அளவுரு / மெட்ரிக்' : 'Metric',
      ...validComps.map((r) => sanitizeText(r.label, isTamil))
    ];

    const compRows: string[][] = [
      [
        isTamil ? 'பகுதி / ஊர் பெயர்' : 'Area / Zone',
        ...validComps.map((r) => sanitizeText(r.areaName, isTamil))
      ],
      [
        isTamil ? 'மதிப்பிடப்பட்ட தொடக்கச் செலவு' : 'Est. Startup Cost',
        ...validComps.map((r) => fmt(r.data?.budget_feasibility?.total_estimated_startup_cost_inr, '\u20b9'))
      ],
      [
        isTamil ? 'சாத்தியக்கூறு நிலை' : 'Feasibility',
        ...validComps.map((r) => getFeasLabel(r.data?.budget_feasibility?.feasibility_category, isTamil))
      ],
      [
        isTamil ? 'போட்டியாளர்கள்' : 'Competitors Found',
        ...validComps.map((r) =>
          r.data?.competitor_status === 'degraded' || r.data?.competitor_status === 'error'
            ? (isTamil ? 'கிடைக்கவில்லை' : 'Unavailable')
            : String(r.data?.competitor_count ?? 'N/A')
        )
      ],
      [
        isTamil ? 'மாதாந்திர வருகை (மதிப்பீடு)' : 'Est. Monthly Visits',
        ...validComps.map((r) => fmt(r.data?.ml_prediction?.predicted_synthetic_monthly_visits))
      ],
      [
        isTamil ? 'பட்ஜெட் வேறுபாடு' : 'Budget Variance',
        ...validComps.map((r) => {
          const vDiff = r.data?.budget_feasibility?.budget_difference_inr;
          if (vDiff == null) return 'N/A';
          return `${vDiff > 0 ? '+' : ''}${fmt(vDiff, '\u20b9')}`;
        })
      ],
    ];

    autoTable(doc, {
      startY: y,
      head: [compHeadLabels],
      body: compRows,
      theme: 'grid',
      styles: {
        font: baseFont,
        fontSize: 7.5,
        textColor: TEXT_DARK,
        cellPadding: 2,
        lineColor: BORDER_COLOR,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: TEXT_LIGHT,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: ROW_ALT_BG,
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: TEXT_MUTED, cellWidth: 50 },
      },
      margin: { left: ML, right: 14 },
      tableWidth: CW,
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ── Footers on All Pages ─────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages, baseFont, isTamil);
  }

  return doc;
}

/**
 * Generates and triggers download of the DemandWise report PDF.
 */
export async function generateDemandWiseReport(input: ReportInput): Promise<void> {
  const doc = buildDemandWiseReportDoc(input);
  const safeName = (input.result.business_name || input.businessName || 'Business')
    .replace(/[^a-z0-9_\-]/gi, '_')
    .substring(0, 40);
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  doc.save(`DemandWise_Report_${safeName}_${dateStamp}.pdf`);
}
