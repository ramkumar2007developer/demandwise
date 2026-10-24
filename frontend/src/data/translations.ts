export type Language = 'en' | 'ta';

export interface Translations {
  nav: {
    home: string;
    features: string;
    howItWorks: string;
    about: string;
    contact: string;
    getStarted: string;
  };
  hero: {
    tag: string;
    headlinePart1: string;
    headlineHighlight: string;
    headlinePart2: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badgeAi: string;
    badgeRealtime: string;
    badgeEasy: string;
  };
  features: {
    tag: string;
    headingPart1: string;
    headingHighlight: string;
    description: string;
    exploreBtn: string;
    cards: Array<{
      title: string;
      desc: string;
    }>;
  };
  howItWorks: {
    tag: string;
    headingPart1: string;
    headingHighlight: string;
    description: string;
    steps: Array<{
      step: string;
      title: string;
      desc: string;
    }>;
  };
  dashboard: {
    title: string;
    subtitle: string;
    businessName: string;
    category: string;
    budget: string;
    area: string;
    latitude: string;
    longitude: string;
    floorArea: string;
    nearCollege: string;
    analyzeBtn: string;
    analyzingBtn: string;
    quickLocations: string;
    demoNotice: string;
    resultsTitle: string;
    stageProgress: string;
  };
  footer: {
    copyright: string;
    privacy: string;
    terms: string;
  };
}

export const translations: Record<'en' | 'ta', Translations> = {
  en: {
    nav: {
      home: 'Home',
      features: 'Features',
      howItWorks: 'How It Works',
      about: 'About',
      contact: 'Contact',
      getStarted: 'Get Started',
    },
    hero: {
      tag: 'AI-POWERED BUSINESS INTELLIGENCE',
      headlinePart1: 'Smarter Insights.\nBetter Business ',
      headlineHighlight: 'Decisions.',
      headlinePart2: '',
      subheadline:
        'DemandWise helps you analyze demand, find competitors, plan your budget and get AI-powered insights — all in one place.',
      ctaPrimary: 'Get Started',
      ctaSecondary: 'Demo',
      badgeAi: 'AI Powered',
      badgeRealtime: 'Real-time Analysis',
      badgeEasy: 'Easy to Use',
    },
    features: {
      tag: 'KEY FEATURES',
      headingPart1: 'Everything You Need to\nBuild a ',
      headingHighlight: 'Successful Business',
      description:
        'From demand prediction to competitor analysis, get complete insights to make smarter decisions, faster.',
      exploreBtn: 'Explore All Features',
      cards: [
        {
          title: 'Demand Prediction',
          desc: 'Forecast customer demand using AI and spatial location patterns.',
        },
        {
          title: 'Competitor Analysis',
          desc: 'Find and analyze nearby competitors and their proximity via OpenStreetMap.',
        },
        {
          title: 'Budget Planning',
          desc: 'Get detailed cost estimates and startup feasibility reports for Coimbatore.',
        },
        {
          title: 'Location Intelligence',
          desc: 'Use real geographic coordinates and neighborhood boundaries for market analysis.',
        },
        {
          title: 'AI Explanations',
          desc: 'Understand complex analytics in simple, actionable English or Tamil.',
        },
        {
          title: 'Comprehensive Reports',
          desc: 'Get complete, synthesized diagnostic reports with timing and stage tracking.',
        },
      ],
    },
    howItWorks: {
      tag: 'HOW IT WORKS',
      headingPart1: 'Get Insights in ',
      headingHighlight: '4 Simple Steps',
      description: 'Start with your business idea and get complete analysis in minutes.',
      steps: [
        {
          step: '1',
          title: 'Enter Details',
          desc: 'Add your business type, target location coordinates, and budget in INR.',
        },
        {
          step: '2',
          title: 'AI Analysis',
          desc: 'Our engine computes budget fit, retrieves competitors, and runs the ML model.',
        },
        {
          step: '3',
          title: 'Get Insights',
          desc: 'Receive transparent predictions, competitor proximity, and feasibility ratios.',
        },
        {
          step: '4',
          title: 'Take Action',
          desc: 'Use practical bilingual recommendations to plan, launch, and succeed.',
        },
      ],
    },
    dashboard: {
      title: 'Business Analysis Dashboard',
      subtitle: 'Get AI-powered insights for your business location in Coimbatore',
      businessName: 'Business Name',
      category: 'Business Category',
      budget: 'Investment Budget (₹ INR)',
      area: 'Neighborhood / Area',
      latitude: 'Latitude',
      longitude: 'Longitude',
      floorArea: 'Floor Area (sq ft)',
      nearCollege: 'Near College / University Campus',
      analyzeBtn: 'Run Full Analysis',
      analyzingBtn: 'Analyzing Coimbatore Opportunity...',
      quickLocations: 'Quick Coimbatore Locations:',
      demoNotice:
        'Demo Prediction: This demand estimate is generated using synthetic training data. It is for demonstration purposes only and is not a verified real-world business forecast.',
      resultsTitle: 'Opportunity Analysis Results',
      stageProgress: 'Pipeline Orchestration Stages',
    },
    footer: {
      copyright: '© 2025 DemandWise. All rights reserved.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
  },
  ta: {
    nav: {
      home: 'முகப்பு',
      features: 'அம்சங்கள்',
      howItWorks: 'எவ்வாறு செயல்படுகிறது',
      about: 'பற்றி',
      contact: 'தொடர்பு',
      getStarted: 'தொடங்குங்கள்',
    },
    hero: {
      tag: 'AI-ஆற்றல் வணிக நுண்ணறிவு',
      headlinePart1: 'நுண்ணறிவுத் தகவல்கள்.\nசிறந்த வணிக ',
      headlineHighlight: 'முடிவுகள்.',
      headlinePart2: '',
      subheadline:
        'தேவையை மதிப்பிடவும், போட்டியாளர்களைக் கண்டறியவும், பட்ஜெட்டைத் திட்டமிடவும், AI நுண்ணறிவுகளைப் பெறவும் — அனைத்தும் ஒரே தளத்தில்.',
      ctaPrimary: 'இலவசமாகத் தொடங்குங்கள்',
      ctaSecondary: 'டெமோ காண்க',
      badgeAi: 'AI ஆற்றல்',
      badgeRealtime: 'நிகழ்நேர பகுப்பாய்வு',
      badgeEasy: 'எளிதான பயன்பாடு',
    },
    features: {
      tag: 'முக்கிய அம்சங்கள்',
      headingPart1: 'வெற்றிகரமான வணிகத்தை உருவாக்க\n',
      headingHighlight: 'தேவையான அனைத்தும்',
      description:
        'தேவை மதிப்பீடு முதல் போட்டி பகுப்பாய்வு வரை, விரைவான வணிக முடிவுகளை எடுக்க முழுமையான நுண்ணறிவு.',
      exploreBtn: 'அனைத்து அம்சங்களையும் காண்க',
      cards: [
        {
          title: 'தேவை மதிப்பீடு',
          desc: 'AI மற்றும் புவியியல் தரவைப் பயன்படுத்தி வாடிக்கையாளர் தேவையை மதிப்பிடுங்கள்.',
        },
        {
          title: 'போட்டியாளர் ஆய்வு',
          desc: 'OpenStreetMap மூலம் அருகிலுள்ள போட்டியாளர்களை நேரலையாகக் கண்டறியுங்கள்.',
        },
        {
          title: 'பட்ஜெட் திட்டமிடல்',
          desc: 'கோயம்புத்தூருக்கான விரிவான தொடக்கச் செலவுகள் மற்றும் சாத்தியக்கூறு அறிக்கை.',
        },
        {
          title: 'இருப்பிட நுண்ணறிவு',
          desc: 'துல்லியமான கோயம்புத்தூர் ஆயத்தொலைவுகளைப் பயன்படுத்தி சந்தை ஆய்வு.',
        },
        {
          title: 'AI எளிய விளக்கங்கள்',
          desc: 'வணிகத் தரவுகளை எளிய தமிழ் அல்லது ஆங்கிலத்தில் தெளிவாகப் புரிந்து கொள்ளுங்கள்.',
        },
        {
          title: 'முழுமையான அறிக்கை',
          desc: 'ஒவ்வொரு கட்டத்தின் நேரக்கணிப்பு மற்றும் எச்சரிக்கைகளுடன் முழு அறிக்கை.',
        },
      ],
    },
    howItWorks: {
      tag: 'செயல்முறை',
      headingPart1: 'நுண்ணறிவைப்பெற ',
      headingHighlight: '4 எளிய படிகள்',
      description: 'உங்கள் வணிக யோசனையுடன் தொடங்கி நிமிடங்களில் முழு பகுப்பாய்வைப் பெறுங்கள்.',
      steps: [
        {
          step: '1',
          title: 'விவரங்களை உள்ளிடுக',
          desc: 'வணிக வகை, இலக்கு இருப்பிட ஆயத்தொலைவுகள் மற்றும் முதலீட்டு பட்ஜெட்டை உள்ளிடவும்.',
        },
        {
          step: '2',
          title: 'AI பகுப்பாய்வு',
          desc: 'எங்கள் அமைப்பு பட்ஜெட், போட்டியாளர்கள் மற்றும் ML மாதிரியை உடனடியாக இயக்குகிறது.',
        },
        {
          step: '3',
          title: 'முடிவுகளைப் பெறுக',
          desc: 'மதிப்பிடப்பட்ட வருகை, போட்டியாளர் தூரம் மற்றும் நிதி நிலவரத்தைப் பெறுங்கள்.',
        },
        {
          step: '4',
          title: 'செயல்படுத்துங்கள்',
          desc: 'நடைமுறைப் பரிந்துரைகளைப் பயன்படுத்தி உங்கள் வணிகத்தைத் தொடங்குங்கள்.',
        },
      ],
    },
    dashboard: {
      title: 'வணிக வாய்ப்பு பகுப்பாய்வு டாஷ்போர்டு',
      subtitle: 'கோயம்புத்தூரில் உங்கள் வணிக இடத்திற்கான AI நுண்ணறிவுகள்',
      businessName: 'வணிகப் பெயர்',
      category: 'வணிக வகை',
      budget: 'முதலீட்டு பட்ஜெட் (₹ INR)',
      area: 'பகுதி / ஊர் பெயர்',
      latitude: 'அட்சரேகை (Latitude)',
      longitude: 'தீர்க்கரேகை (Longitude)',
      floorArea: 'தளப் பரப்பளவு (சதுர அடி)',
      nearCollege: 'கல்லூரி / பல்கலைக்கழகம் அருகில் உள்ளதா',
      analyzeBtn: 'முழு பகுப்பாய்வை இயக்குக',
      analyzingBtn: 'கோயம்புத்தூர் வாய்ப்புகளை பகுப்பாய்வு செய்கிறது...',
      quickLocations: 'கோயம்புத்தூரின் முக்கிய பகுதிகள்:',
      demoNotice:
        'மாதிரி கணிப்பு: இந்த தேவை மதிப்பீடு செயற்கை தரவுகளின் அடிப்படையில் உருவாக்கப்பட்டது. இது ஒரு மாதிரி பயன்பாட்டுக்கு மட்டுமே, உண்மையான வணிக உத்தரவாதம் அல்ல.',
      resultsTitle: 'வணிக பகுப்பாய்வு முடிவுகள்',
      stageProgress: 'பகுப்பாய்வு கட்டங்களின் நிலை',
    },
    footer: {
      copyright: '© 2025 DemandWise. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
      privacy: 'தனியுரிமைக் கொள்கை',
      terms: 'பயன்பாட்டு விதிமுறைகள்',
    },
  },
};
