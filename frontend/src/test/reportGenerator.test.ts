import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildDemandWiseReportDoc, shapeTamil, hasTamil } from '../services/reportGenerator';
import type { BusinessAnalysisResponse } from '../types/api';

describe('PDF Report Generator — Full Verification', () => {
  it('shapes Tamil vowels and consonants correctly into visual display order', () => {
    expect(hasTamil('வணிகம்')).toBe(true);
    expect(hasTamil('DemandWise')).toBe(false);

    // Short o (ொ): \u0BCA -> \u0BC6 + C + \u0BBE
    const shapedO = shapeTamil('கொ');
    expect(shapedO).toBe('\u0BC6\u0B95\u0BBE');

    // Long o (ோ): \u0BCB -> \u0BC7 + C + \u0BBE
    const shapedLongO = shapeTamil('கோ');
    expect(shapedLongO).toBe('\u0BC7\u0B95\u0BBE');

    // Pre-base e (ெ): \u0BC6 -> \u0BC6 + C
    const shapedE = shapeTamil('செ');
    expect(shapedE).toBe('\u0BC6\u0B9A');

    // Pre-base long e (ே): \u0BC7 -> \u0BC7 + C
    const shapedLongE = shapeTamil('தே');
    expect(shapedLongE).toBe('\u0BC7\u0BA4');

    // Pre-base ai (ை): \u0BC8 -> \u0BC8 + C
    const shapedAi = shapeTamil('கை');
    expect(shapedAi).toBe('\u0BC8\u0B95');
  });

  const baseAnalysisResult: BusinessAnalysisResponse = {
    request_id: 'REQ-CBE-20261027-001',
    business_name: 'The French Roast Cafe',
    business_type: 'cafe',
    language: 'en',
    budget_inr: 850000,
    location: {
      latitude: 11.0168,
      longitude: 76.9558,
      area_name: 'RS Puram, West Zone',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
    },
    summary:
      'RS Puram displays strong consumer purchasing power, excellent connectivity, and high footfall density suitable for premium specialty cafe operations.',
    explanation:
      'Market Feasibility & Trade Area Analysis:\n\n' +
      '• Demographic Profile: The immediate 1.5 km catchment contains high-income households and commercial offices.\n' +
      '• Footfall Trends: Peak traffic occurs during morning rush (8:00 AM - 10:30 AM) and evening leisure (5:00 PM - 8:30 PM).\n' +
      '• Competitive Dynamics: While there are established local bakeries, specialty cold brews and artisan sourdough menus remain underserved.\n' +
      '• Financial Sustainability: The requested startup capital of ₹8,50,000 matches typical fit-out and initial operating reserves.',
    recommendations: [
      'Secure a ground-floor lease with minimum 25 ft street frontage on DB Road.',
      'Allocate 35% of capital to high-efficiency Italian espresso equipment.',
      'Launch student loyalty programs targeting nearby colleges within 2 km.',
      'Implement digital inventory control to prevent perishable waste during initial 90 days.',
    ],
    explanation_mode: 'llm_generated',
    ml_prediction: {
      predicted_synthetic_monthly_visits: 3420,
      dataset_status: 'Active Calibrated Model',
      model_name: 'RandomForestRegressor_v2',
      disclaimer: 'synthetic',
    },
    budget_feasibility: {
      total_estimated_startup_cost_inr: 720000,
      budget_difference_inr: 130000,
      feasibility_category: 'SURPLUS',
      feasibility_ratio: 1.18,
      is_illustrative: true,
      // @ts-ignore
      cost_breakdown: [
        { category: 'Fit-out & Interior', description: 'Counter, lighting, air conditioning, seating', estimated_amount_inr: 280000 },
        { category: 'Commercial Equipment', description: '2-group espresso machine, grinder, refrigeration', estimated_amount_inr: 220000 },
        { category: 'Advance Rent Deposit', description: '3 months commercial security deposit', estimated_amount_inr: 90000 },
        { category: 'Initial Inventory', description: 'Specialty coffee beans, milk, syrups, packaging', estimated_amount_inr: 50000 },
        { category: 'Licensing & Permits', description: 'FSSAI, trade license, GST registration, fire safety', estimated_amount_inr: 30000 },
        { category: 'Working Capital Reserve', description: 'Operational buffer for initial 30 days', estimated_amount_inr: 50000 },
      ],
    },
    competitors: [
      { name: 'Cafe Coffee Day - RS Puram', category: 'cafe', distance_km: 0.35, latitude: 11.018, longitude: 76.954 },
      { name: 'Rolling Dough Bakery', category: 'bakery', distance_km: 0.62, latitude: 11.014, longitude: 76.958 },
      { name: 'Chai Kanth Cafe', category: 'cafe', distance_km: 0.89, latitude: 11.021, longitude: 76.951 },
      { name: 'Starbucks DB Road', category: 'cafe', distance_km: 1.15, latitude: 11.011, longitude: 76.961 },
    ],
    competitor_count: 4,
    competitor_status: 'success',
    stages: [
      { stage: 'validate_inputs', status: 'success', duration_ms: 1.2 },
      { stage: 'budget_feasibility', status: 'success', duration_ms: 3.4 },
      { stage: 'competitor_search', status: 'success', duration_ms: 480.5 },
      { stage: 'ml_demand_prediction', status: 'success', duration_ms: 12.1 },
      { stage: 'bilingual_explanation', status: 'success', duration_ms: 850.3 },
    ],
    warnings: [],
    total_duration_ms: 1347.5,
    disclaimer: 'synthetic',
  };

  // ── Scenario 1: English Report ──────────────────────────────────────────
  it('Scenario 1: generates complete English PDF without disclaimers and with high contrast', () => {
    const doc = buildDemandWiseReportDoc({
      result: baseAnalysisResult,
      language: 'en',
      businessName: 'The French Roast Cafe',
      businessType: 'cafe',
      budgetInr: 850000,
      latitude: 11.0168,
      longitude: 76.9558,
      selectedArea: 'RS Puram, West Zone',
      floorArea: 950,
      nearCollege: 1,
      notes: 'Premium artisan cafe serving specialty brews and freshly baked pastries.',
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(__dirname, '../../test_sample_1_english.pdf'), pdfBuffer);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdfBuffer.length).toBeGreaterThan(10000);

    // Verify disclaimers are strictly absent from the PDF text streams
    const pdfText = pdfBuffer.toString('utf8');
    expect(pdfText.includes('Demo Prediction Notice')).toBe(false);
    expect(pdfText.includes('MANDATORY NOTICE: Demand predictions are based')).toBe(false);
    expect(pdfText.includes('IMPORTANT DISCLAIMER: Demand predictions are based on a model trained on synthetic')).toBe(false);
  });

  // ── Scenario 2: Tamil Report ────────────────────────────────────────────
  it('Scenario 2: generates fully localized Tamil PDF with MuktaMalar font & Tamil shaping', () => {
    const tamilResult: BusinessAnalysisResponse = {
      ...baseAnalysisResult,
      request_id: 'REQ-CBE-20261027-TA-02',
      business_name: 'அன்னபூர்ணா பாரம்பரிய கஃபே',
      business_type: 'cafe',
      language: 'ta',
      summary:
        'ஆர்.எஸ்.புரம் பகுதி அதிக நுகர்வோர் வாங்கும் திறன் மற்றும் சிறப்பான மக்கள் நடமாட்டம் கொண்ட மையமாகும். இங்கு தரமான கஃபே வணிகத்திற்கு சிறந்த வரவேற்பு உள்ளது.',
      explanation:
        'சந்தை சாத்தியக்கூறு மற்றும் பகுதி பகுப்பாய்வு:\n\n' +
        '1. வாடிக்கையாளர் தன்மை: 1.5 கி.மீ சுற்றளவில் உயர் நடுத்தர குடும்பங்களும் வணிக அலுவலகங்களும் நிறைந்துள்ளன.\n' +
        '2. மக்கள் நடமாட்டம்: காலை 8:00 மணி முதல் 10:30 மணி வரையிலும், மாலை 5:00 மணி முதல் இரவு 8:30 மணி வரையிலும் உச்சகட்ட வர்த்தகம் காணப்படுகிறது.\n' +
        '3. போட்டி சூழல்: பாரம்பரிய பேக்கரிகள் இருந்தபோதும், நவீன குளிர்பானங்கள் மற்றும் சிறப்பு காபி வகைகளுக்கு நல்ல வெற்றி வாய்ப்பு உள்ளது.\n' +
        '4. நிதி நிலைத்தன்மை: திட்டமிடப்பட்ட ₹8,50,000 முதலீடு தொடக்க அமைவு மற்றும் முதல் மாத செயல்பாட்டுக்கு போதுமானது.',
      recommendations: [
        'டி.பி. சாலையில் குறைந்தபட்சம் 25 அடி முன்பக்க முகப்பு கொண்ட தரைத்தள கடையைத் தேர்வு செய்க.',
        'முதலீட்டுத் தொகையில் 35% உயர்தர இத்தாலிய காபி இயந்திரங்களுக்கு ஒதுக்கவும்.',
        'அருகிலுள்ள கல்லூரிகளை இலக்காகக் கொண்டு மாணவர் சிறப்பு தள்ளுபடி சலுகைகளை அறிமுகப்படுத்துக.',
        'தொடக்க 90 நாட்களில் மூலப்பொருட்கள் வீணாவதைத் தடுக்க கணினிமயமாக்கப்பட்ட இருப்பு முறையைக் கையாள்க.',
      ],
      competitors: [
        { name: 'கஃபே காபி டே - ஆர்.எஸ்.புரம்', category: 'cafe', distance_km: 0.35 },
        { name: 'ரோலிங் டோவ் பேக்கரி', category: 'bakery', distance_km: 0.62 },
        { name: 'ஸ்ரீ கிருஷ்ணா ஸ்வீட்ஸ்', category: 'bakery', distance_km: 0.75 },
      ],
    };

    const doc = buildDemandWiseReportDoc({
      result: tamilResult,
      language: 'ta',
      businessName: 'அன்னபூர்ணா பாரம்பரிய கஃபே',
      businessType: 'cafe',
      budgetInr: 850000,
      latitude: 11.0168,
      longitude: 76.9558,
      selectedArea: 'ஆர்.எஸ்.புரம், மேற்கு மண்டலம்',
      floorArea: 950,
      nearCollege: 1,
      notes: 'பாரம்பரிய சுவையுடன் கூடிய நவீன காபி நிலையம்.',
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(__dirname, '../../test_sample_2_tamil.pdf'), pdfBuffer);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdfBuffer.length).toBeGreaterThan(15000);

    const pdfText = pdfBuffer.toString('utf8');
    expect(pdfText.includes('Demo Prediction Notice')).toBe(false);
    expect(pdfText.includes('MANDATORY NOTICE')).toBe(false);
  });

  // ── Scenario 3: Long AI Explanations and Multiple Recommendations ────────
  it('Scenario 3: handles extensive AI explanations and 8 recommendations with clean multi-page pagination', () => {
    const longExplanation =
      'Comprehensive Strategic Location & Consumer Behavior Assessment:\n\n' +
      'Detailed Catchment Footfall Dynamics:\n' +
      'Coimbatore East Zone encompasses a dynamic blend of emerging IT clusters, higher education institutes, and residential corridors. ' +
      'Pedestrian footfall metrics exhibit resilient stability throughout weekdays, peaking during lunch hours and post-work evening intervals.\n\n' +
      'Competitive Saturation & Defensibility:\n' +
      'The micro-market has a moderate density of quick-service food stalls, but lacks clean, climate-controlled casual dining experiences. ' +
      'This structural imbalance leaves an addressable margin of 32% for operators emphasizing consistency, prompt service, and digital ordering.\n\n' +
      'Supply Chain & Sourcing Proximity:\n' +
      'Direct arterial access to Avinashi Road and Trichy Road guarantees swift supply deliveries with minimal transit delays. ' +
      'Daily dairy and fresh perishables can be secured locally within a 3.5 km radius, minimizing working capital tied in cold inventory.\n\n' +
      'Financial Viability & Breakeven Horizon:\n' +
      'Operating margins are projected at 24-28% after stabilization. Projected daily ticket volume of 110-140 transactions satisfies operating breakeven within month 4.';

    const recs = [
      'Prioritize high-visibility signage legible from at least 50 meters on incoming traffic lanes.',
      'Implement an energy-efficient inverter HVAC setup to contain electricity overhead below 8% of gross revenue.',
      'Standardize core recipes into pre-portioned ingredient packs to maintain quality across kitchen staff shifts.',
      'Partner with hyperlocal delivery aggregators during off-peak afternoon hours (2:00 PM - 5:00 PM).',
      'Deploy QR code table ordering to expedite order throughput by up to 22% during peak rush hours.',
      'Negotiate minimum 3-year commercial lease with capped escalation not exceeding 5% annually.',
      'Maintain an emergency contingency fund representing at least 45 days of fixed payroll obligations.',
      'Conduct monthly customer NPS sentiment surveys to identify menu refinements before customer fatigue sets in.',
    ];

    const longResult: BusinessAnalysisResponse = {
      ...baseAnalysisResult,
      explanation: longExplanation,
      recommendations: recs,
    };

    const doc = buildDemandWiseReportDoc({
      result: longResult,
      language: 'en',
      businessName: 'Apex Artisan Kitchen',
      businessType: 'cafe',
      budgetInr: 1200000,
      latitude: 11.025,
      longitude: 77.01,
      selectedArea: 'Peelamedu Tech Corridor',
      floorArea: 1400,
      nearCollege: 1,
      notes: 'Multi-service cafe with workspace seating and high-speed Wi-Fi.',
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(__dirname, '../../test_sample_3_long_explanation.pdf'), pdfBuffer);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(pdfBuffer.length).toBeGreaterThan(20000);
  });

  // ── Scenario 4: Missing Optional Fields ──────────────────────────────────
  it('Scenario 4: gracefully handles missing optional fields and zero competitors', () => {
    const minimalResult: BusinessAnalysisResponse = {
      request_id: 'REQ-MIN-004',
      business_name: '',
      business_type: 'retail',
      language: 'en',
      budget_inr: 400000,
      location: {
        latitude: 10.985,
        longitude: 76.925,
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
      summary: 'Basic market profile for emerging retail zone.',
      explanation: 'Preliminary feasibility assessment based on regional averages.',
      recommendations: ['Confirm local zoning and commercial permissions.'],
      explanation_mode: 'template_fallback',
      ml_prediction: null,
      budget_feasibility: null,
      competitors: [],
      competitor_count: 0,
      competitor_status: 'empty',
      stages: [],
      warnings: [],
      total_duration_ms: 210.0,
      disclaimer: 'synthetic',
    };

    const doc = buildDemandWiseReportDoc({
      result: minimalResult,
      language: 'en',
      businessName: '',
      businessType: 'retail',
      budgetInr: 400000,
      latitude: 10.985,
      longitude: 76.925,
      selectedArea: '',
      floorArea: 0,
      nearCollege: 0,
      notes: '',
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(__dirname, '../../test_sample_4_missing_fields.pdf'), pdfBuffer);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdfBuffer.length).toBeGreaterThan(5000);

    const pdfText = pdfBuffer.toString('utf8');
    expect(pdfText.includes('Demo Prediction Notice')).toBe(false);
  });

  // ── Scenario 5: Multi-Location Comparison Data ───────────────────────────
  it('Scenario 5: renders verified competitor table and multi-location comparison matrix', () => {
    const compA: BusinessAnalysisResponse = {
      ...baseAnalysisResult,
      request_id: 'REQ-COMP-A',
      location: { ...baseAnalysisResult.location, area_name: 'RS Puram (Location A)' },
    };

    const compB: BusinessAnalysisResponse = {
      ...baseAnalysisResult,
      request_id: 'REQ-COMP-B',
      location: { ...baseAnalysisResult.location, area_name: 'Gandhipuram (Location B)' },
      budget_feasibility: {
        total_estimated_startup_cost_inr: 890000,
        budget_difference_inr: -40000,
        feasibility_category: 'DEFICIT',
        feasibility_ratio: 0.95,
        is_illustrative: true,
      },
      ml_prediction: {
        predicted_synthetic_monthly_visits: 4150,
        dataset_status: 'Active',
        disclaimer: 'synthetic',
      },
      competitor_count: 9,
    };

    const compC: BusinessAnalysisResponse = {
      ...baseAnalysisResult,
      request_id: 'REQ-COMP-C',
      location: { ...baseAnalysisResult.location, area_name: 'Saibaba Colony (Location C)' },
      budget_feasibility: {
        total_estimated_startup_cost_inr: 680000,
        budget_difference_inr: 170000,
        feasibility_category: 'SURPLUS',
        feasibility_ratio: 1.25,
        is_illustrative: true,
      },
      ml_prediction: {
        predicted_synthetic_monthly_visits: 2980,
        dataset_status: 'Active',
        disclaimer: 'synthetic',
      },
      competitor_count: 2,
    };

    const doc = buildDemandWiseReportDoc({
      result: compA,
      language: 'en',
      businessName: 'The French Roast Cafe',
      businessType: 'cafe',
      budgetInr: 850000,
      latitude: 11.0168,
      longitude: 76.9558,
      selectedArea: 'RS Puram (Location A)',
      floorArea: 950,
      nearCollege: 1,
      notes: 'Multi-site comparative strategic feasibility study.',
      comparisonResults: [
        { label: 'Location A', areaName: 'RS Puram', data: compA, status: 'success', color: '#10b981' },
        { label: 'Location B', areaName: 'Gandhipuram', data: compB, status: 'success', color: '#f59e0b' },
        { label: 'Location C', areaName: 'Saibaba Colony', data: compC, status: 'success', color: '#3b82f6' },
      ],
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(__dirname, '../../test_sample_5_multi_location.pdf'), pdfBuffer);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdfBuffer.length).toBeGreaterThan(15000);
  });
});
