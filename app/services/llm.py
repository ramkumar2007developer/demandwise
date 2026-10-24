"""Bilingual LLM explanation service for DemandWise (English & Tamil).

Architectural Principles:
- Provider Agnostic: Connects to any OpenAI-compatible API endpoint
  (OpenAI, Ollama, Groq, OpenRouter, vLLM, etc.) using httpx.
- Secure by Design: API keys are loaded strictly on the backend from environment
  variables and are never exposed to the client or in health/config responses.
- Grounding & Integrity: Numerical prediction, competitor counts, and budget
  calculations remain immutable ground-truth; the LLM cannot alter them.
- Synthetic Status Disclosure: Explicitly notes the synthetic-demo status of
  the ML model and does not guarantee business outcomes.
- Resilient Fallback: If the API key is missing, or if the external provider
  times out or errors, a high-quality deterministic rule-based explanation
  is automatically generated in English or Tamil. ML and budget services
  remain completely functional.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.schemas.explain import ExplanationContext, ExplanationResponse

logger = logging.getLogger(__name__)

DISCLAIMER_TEXT_EN = (
    "DEMO NOTICE: Demand prediction is produced by a machine learning model trained "
    "on synthetic data. Budget figures are illustrative benchmarks for student planning in "
    "Coimbatore. This explanation does not constitute financial, legal, or commercial advice."
)

DISCLAIMER_TEXT_TA = (
    "மாதிரி எச்சரிக்கை: தேவை மதிப்பீடு செயற்கை தரவுகளில் (synthetic data) பயிற்றுவிக்கப்பட்ட "
    "இயந்திர கற்றல் மாதிரியால் உருவாக்கப்பட்டது. பட்ஜெட் மதிப்பீடுகள் கோயம்புத்தூர் மாணவர் திட்ட "
    "வழிகாட்டலுக்கானவை மட்டுமே. இது நிதி அல்லது வணிக உத்தரவாதம் அல்ல."
)


def _build_system_prompt(language: str) -> str:
    if language == "ta":
        return (
            "நீங்கள் கோயம்புத்தூரின் வணிக வழிகாட்டி (DemandWise Business Advisor). "
            "தொழில் முனைவோருக்கான திட்ட விவரங்களை ஆராய்ந்து எளிய, தெளிவான, மற்றும் நடைமுறைத் தமிழில் "
            "விளக்கம் அளிக்க வேண்டும்.\n"
            "முக்கிய விதிமுறைகள்:\n"
            "1. எண்களையோ, பட்ஜெட் விவரங்களையோ மாற்றக் கூடாது.\n"
            "2. கொடுக்கப்பட்ட போட்டி நிறுவனங்களை மட்டுமே விவரிக்க வேண்டும்; பொய்யான நிறுவனப் பெயர்களை உருவாக்கக் கூடாது.\n"
            "3. தேவை மதிப்பீடு (demand prediction) செயற்கை மாதிரி (synthetic demo) என்பதைத் தெளிவாகக் குறிப்பிட வேண்டும்.\n"
            "4. வணிக வெற்றி அல்லது லாபத்திற்கு எவ்வித உத்தரவாதமும் அளிக்கக் கூடாது.\n"
            "5. விடையை பின்வரும் JSON வடிவில் மட்டுமே வழங்கவும்:\n"
            '{"summary": "1-2 வாக்கியத்தில் திட்டச் சுருக்கம்", "explanation": "விரிவான தமிழ் விளக்கம்", "recommendations": ["பரிந்துரை 1", "பரிந்துரை 2", "பரிந்துரை 3"]}'
        )
    return (
        "You are the DemandWise Business Advisor for Coimbatore, Tamil Nadu. "
        "Provide a concise, practical, and objective explanation for an aspiring local business owner.\n"
        "Strict rules:\n"
        "1. Do NOT alter any numerical prediction, competitor count, or budget figure.\n"
        "2. Do NOT invent fictional competitor names or market statistics.\n"
        "3. Clearly state that the demand prediction comes from a synthetic-demo ML model.\n"
        "4. Do NOT guarantee commercial outcomes or profit.\n"
        "5. Return your response strictly as valid JSON with keys 'summary', 'explanation', and 'recommendations':\n"
        '{"summary": "1-2 sentence executive summary", "explanation": "comprehensive explanation text", "recommendations": ["step 1", "step 2", "step 3"]}'
    )


def _build_user_prompt(ctx: ExplanationContext) -> str:
    competitors_summary = (
        ", ".join(ctx.competitor_names[:5]) if ctx.competitor_names else "No nearby competitors found."
    )
    visits_str = (
        f"{ctx.predicted_synthetic_monthly_visits:.1f} visits/month (SYNTHETIC DEMO)"
        if ctx.predicted_synthetic_monthly_visits is not None
        else "Not calculated"
    )
    budget_diff_str = (
        f"INR {ctx.budget_difference_inr:,.2f}"
        if ctx.budget_difference_inr is not None
        else "Not calculated"
    )
    cost_str = (
        f"INR {ctx.total_estimated_startup_cost_inr:,.2f}"
        if ctx.total_estimated_startup_cost_inr is not None
        else "Not calculated"
    )

    return f"""Business Profile:
- Business Name: {ctx.business_name}
- Category: {ctx.business_type}
- Target Location: {ctx.city}, {ctx.state} (Lat: {ctx.latitude}, Lng: {ctx.longitude}, Area: {ctx.area_name or 'Not specified'})
- Language Requested: {ctx.language}

ML Demand Prediction:
- Predicted Visits: {visits_str}
- Dataset Status: {ctx.dataset_status}

Competitor Landscape (OpenStreetMap):
- Nearby Competitors Found: {ctx.competitor_count}
- Key Competitors: {competitors_summary}

Budget Feasibility:
- Planned Budget: INR {ctx.user_budget_inr:,.2f}
- Estimated Startup Cost: {cost_str}
- Budget Difference: {budget_diff_str}
- Feasibility Category: {ctx.feasibility_category or 'UNKNOWN'}

User Notes: {ctx.notes or 'None'}
"""


def generate_fallback_explanation(ctx: ExplanationContext, settings: Settings | None = None) -> ExplanationResponse:
    """Generate a high-quality deterministic rule-based explanation in English or Tamil.

    Used when the external LLM is unconfigured, unreachable, or errors out.
    Ensures complete business continuity and zero downtime.
    """
    cfg = settings or get_settings()
    is_tamil = ctx.language == "ta"

    visits_val = ctx.predicted_synthetic_monthly_visits
    visits_formatted = f"{visits_val:.1f}" if visits_val is not None else "N/A"
    competitors_count = ctx.competitor_count
    competitor_list_str = (
        ", ".join(ctx.competitor_names[:4]) if ctx.competitor_names else ("இல்லை" if is_tamil else "None")
    )
    budget_inr = ctx.user_budget_inr
    est_cost = ctx.total_estimated_startup_cost_inr or 0.0
    diff_inr = ctx.budget_difference_inr or (budget_inr - est_cost)
    category = ctx.feasibility_category or ("SURPLUS" if diff_inr >= 0 else "DEFICIT")

    if is_tamil:
        # Tamil deterministic template
        feasibility_tamil = {
            "SURPLUS": "உபரி (போதுமான நிதி உள்ளது)",
            "FEASIBLE": "சாத்தியமானது (சரியான பட்ஜெட் ஒதுக்கீடு)",
            "DEFICIT": "பற்றாக்குறை (கூடுதல் நிதி தேவைப்படலாம்)",
        }.get(category, category)

        summary = (
            f"'{ctx.business_name}' ({ctx.business_type}) திட்டத்திற்கு கோயம்புத்தூரில் திட்டமிடப்பட்ட பட்ஜெட் "
            f"₹{budget_inr:,.0f} ஆகும். நிதி நிலை: {feasibility_tamil}."
        )

        explanation = f"""### 1. திட்டச் சுருக்கம்
'{ctx.business_name}' என்ற {ctx.business_type} வணிகம் கோயம்புத்தூர் பகுதியில் ({ctx.area_name or 'நகரப் பகுதி'}) தொடங்குவதற்காக முன்மொழியப்பட்டுள்ளது.

### 2. தேவை மதிப்பீடு (செயற்கை மாதிரி ஆய்வு)
- மதிப்பிடப்பட்ட மாதாந்திர வாடிக்கையாளர் வருகை: **{visits_formatted}** (செயற்கை மாதிரி முடிவு).
- **கவனிக்க**: இது மாதிரி ஆய்வுக்காக உருவாக்கப்பட்ட ஒரு செயற்கை கணிப்பு மட்டுமே. நிஜ சந்தை வணிக விற்பனையை இது நேரடியாகக் குறிக்காது.

### 3. உள்ளூர் போட்டி நிலவரம் (OpenStreetMap)
- கண்டறியப்பட்ட நேரடிப் போட்டியாளர்கள்: **{competitors_count}**
- முக்கிய போட்டியாளர்கள்: {competitor_list_str}
{"- அருகாமையில் நேரடிப் போட்டியாளர்கள் குறைவாக இருப்பதால் புதிய வாடிக்கையாளர்களை ஈர்க்க வாய்ப்புள்ளது." if competitors_count < 3 else "- பகுதியில் போட்டியாளர்கள் உள்ளதால் தரம் மற்றும் சேவையில் தனித்துவம் தேவை."}

### 4. நிதி மற்றும் பட்ஜெட் சாத்தியக்கூறு
- திட்டமிடப்பட்ட முதலீடு: ₹{budget_inr:,.2f}
- மதிப்பிடப்பட்ட ஆரம்பச் செலவு: ₹{est_cost:,.2f}
- பட்ஜெட் வேறுபாடு: ₹{diff_inr:,.2f} ({feasibility_tamil})
{"- உங்களிடம் ஆரம்பச் செலவுகளுக்குப் பிறகு கூடுதல் பாதுகாப்பு நிதி உள்ளது." if category == "SURPLUS" else "- ஆரம்பச் செலவுகள் மற்றும் இருப்புக்கான தொகையை கவனமாக நிர்வகிக்க வேண்டும்."}

### 5. அடுத்த கட்டப் பரிந்துரைகள்
1. கோயம்புத்தூரில் தேர்ந்தெடுக்கப்பட்ட பகுதியில் நேரடி கள ஆய்வு செய்து வாடிக்கையாளர் நடமாட்டத்தை உறுதி செய்யவும்.
2. FSSAI, வணிக உரிமம் மற்றும் உள்ளூர் நகராட்சி அனுமதிகளை முன்கூட்டியே பெறவும்.
3. ஆரம்ப இருப்பு மற்றும் விளம்பரச் செலவுகளைத் திட்டமிட்டு கட்டுப்படுத்தவும்.

### 6. எச்சரிக்கைகள்
இந்த அறிக்கை மாதிரி வழிகாட்டலுக்கானது மட்டுமே. வணிக முடிவுகளை எடுக்கும் முன் உள்ளூர் சந்தை நிலவரத்தை நேரில் சரிபார்க்கவும்.
"""
        recs = [
            f"கோயம்புத்தூர் {ctx.area_name or 'தேர்ந்தெடுக்கப்பட்ட'} பகுதியில் நேரடி சந்தை ஆய்வு மேற்கொள்ளவும்.",
            "ஆரம்பக்கட்ட செலவுகளைக் கட்டுப்படுத்த உபகரணங்களை நிதானமாக தேர்வு செய்யவும்.",
            "உள்ளூர் நகராட்சி மற்றும் வணிக உரிமங்களை முன்கூட்டியே முறைப்படுத்தவும்.",
        ]
        disclaimer = DISCLAIMER_TEXT_TA

    else:
        # English deterministic template
        summary = (
            f"Assessment for '{ctx.business_name}' ({ctx.business_type}) in Coimbatore: "
            f"Budget of INR {budget_inr:,.0f} shows a financial status of {category} "
            f"against estimated startup costs of INR {est_cost:,.0f}."
        )

        explanation = f"""### 1. Executive Summary
'{ctx.business_name}' is evaluated for establishment as a {ctx.business_type} in Coimbatore, Tamil Nadu ({ctx.area_name or 'Central area'}).

### 2. Demand Prediction & Contributing Features
- Predicted Monthly Visits: **{visits_formatted}** (derived from Phase 2 synthetic demo pipeline).
- Feature Factors: Evaluation accounts for investment budget, approximate location coordinates, competitive density, and college proximity.
- *Notice*: Model was trained on synthetic data. This figure represents an experimental baseline index, not observed customer footfall.

### 3. Competitor Landscape (OpenStreetMap)
- Verified Nearby Competitors: **{competitors_count}**
- Sample Identified Venues: {competitor_list_str}
{"- Competitive density is low in the immediate vicinity, suggesting open room for market entry." if competitors_count < 3 else "- Established competitors exist nearby; focus on distinct value proposition and service speed."}

### 4. Budget & Financial Feasibility
- Proposed Capital: INR {budget_inr:,.2f}
- Estimated Baseline Startup Cost: INR {est_cost:,.2f}
- Budget Variance: INR {diff_inr:,.2f} ({category})
{"- The proposed budget provides an adequate capital buffer exceeding baseline setup expenditures." if category == "SURPLUS" else "- Capital closely aligns with or falls below baseline requirements. Phased equipment acquisition is recommended."}

### 5. Recommended Action Steps
1. Conduct an in-person foot-traffic count in the proposed Coimbatore neighborhood at peak hours.
2. Finalize lease terms and commercial advance agreements to lock in the rental deposit.
3. Secure FSSAI registration, municipal trade licenses, and local utility connections.

### 6. Limitations & Assumptions
All demand figures are synthetic approximations for student project demonstration. Startup cost benchmarks represent baseline averages and vary with location and supplier agreements.
"""
        recs = [
            f"Conduct in-person footfall counts around {ctx.area_name or 'the target coordinates'} in Coimbatore.",
            "Verify commercial lease advance and rental deposit with local landlords.",
            "Initiate regulatory licensing (FSSAI, GST, municipal trade license) prior to launch.",
        ]
        disclaimer = DISCLAIMER_TEXT_EN

    return ExplanationResponse(
        language=ctx.language,
        explanation=explanation.strip(),
        summary=summary.strip(),
        recommendations=recs,
        explanation_mode="template_fallback",
        llm_provider=cfg.llm_provider,
        llm_model=cfg.llm_model,
        disclaimer=disclaimer,
    )


def generate_explanation(
    context: ExplanationContext | dict[str, Any],
    settings: Settings | None = None,
    http_client: httpx.Client | None = None,
) -> ExplanationResponse:
    """Generate a bilingual explanation via OpenAI-compatible LLM with robust fallback.

    Parameters
    ----------
    context : ExplanationContext or dict
        Combined business, ML, competitor, and budget data.
    settings : Settings, optional
        Application configuration.
    http_client : httpx.Client, optional
        Injected HTTP client for testing or custom transport.

    Returns
    -------
    ExplanationResponse
        Structured explanation with executive summary, recommendations, mode, and disclaimers.
    """
    cfg = settings or get_settings()

    if isinstance(context, dict):
        ctx = ExplanationContext(**context)
    else:
        ctx = context

    # If no API key is configured, immediately return the deterministic fallback
    if not cfg.llm_api_key or not cfg.llm_api_key.strip():
        logger.info("No LLM API key configured. Using deterministic template explanation.")
        return generate_fallback_explanation(ctx, settings=cfg)

    # Build prompt messages
    system_prompt = _build_system_prompt(ctx.language)
    user_prompt = _build_user_prompt(ctx)
    endpoint_url = f"{cfg.llm_base_url.rstrip('/')}/chat/completions"

    payload = {
        "model": cfg.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": cfg.llm_temperature,
    }

    headers = {
        "Authorization": f"Bearer {cfg.llm_api_key}",
        "Content-Type": "application/json",
    }

    client_provided = http_client is not None
    client = http_client or httpx.Client(timeout=cfg.llm_timeout_seconds)

    try:
        response = client.post(endpoint_url, json=payload, headers=headers)
        response.raise_for_status()
        res_json = response.json()
        content = res_json["choices"][0]["message"]["content"].strip()

        # Parse JSON output from the model
        summary = ""
        explanation_text = ""
        recommendations = []

        try:
            # Handle possible markdown fences around JSON
            clean_content = content
            if clean_content.startswith("```"):
                lines = clean_content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                clean_content = "\n".join(lines).strip()

            parsed = json.loads(clean_content)
            summary = parsed.get("summary", "")
            explanation_text = parsed.get("explanation", "")
            recommendations = parsed.get("recommendations", [])
        except (json.JSONDecodeError, AttributeError):
            # If the model returned plain text instead of JSON, extract safely
            explanation_text = content
            summary = content[:200] + ("..." if len(content) > 200 else "")
            recommendations = [
                "Conduct on-site location validation in Coimbatore.",
                "Review baseline startup cost budget allocations.",
            ]

        disclaimer = DISCLAIMER_TEXT_TA if ctx.language == "ta" else DISCLAIMER_TEXT_EN

        return ExplanationResponse(
            language=ctx.language,
            explanation=explanation_text or content,
            summary=summary or f"Analysis for {ctx.business_name} in Coimbatore.",
            recommendations=recommendations or [],
            explanation_mode="llm_generated",
            llm_provider=cfg.llm_provider,
            llm_model=cfg.llm_model,
            disclaimer=disclaimer,
        )

    except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.RequestError, KeyError, IndexError) as exc:
        logger.warning("LLM explanation request failed (%s). Falling back to rule-based template.", exc)
        return generate_fallback_explanation(ctx, settings=cfg)
    finally:
        if not client_provided:
            client.close()
