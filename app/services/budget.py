"""Budget feasibility service for DemandWise.

This service evaluates startup capital requirements against baseline costs for
a proposed business in Coimbatore.

Crucial Architectural Guarantees:
- Completely independent of the Machine Learning demand model and LLM.
- Fully rule-based, deterministic, and verifiable.
- Cost assumptions are baseline illustrative benchmarks for student project
  planning in Coimbatore and are explicitly labeled as such.
"""

from __future__ import annotations

from typing import Any

from app.config import Settings, get_settings
from app.schemas.budget import (
    BudgetFeasibilityResponse,
    FeasibilityCategory,
    StartupCostItem,
)


def get_default_cost_breakdown(
    business_type: str, settings: Settings | None = None
) -> list[StartupCostItem]:
    """Retrieve default baseline startup cost line items for a given business category."""
    cfg = settings or get_settings()
    btype = business_type.lower().strip()

    if btype in {"cafe", "café", "coffee_shop"}:
        return [
            StartupCostItem(
                category="setup_renovation",
                description="Interior decoration, acoustic treatment, seating, lighting, and counter fabrication.",
                estimated_amount_inr=cfg.cafe_setup_renovation_inr,
            ),
            StartupCostItem(
                category="equipment",
                description="Commercial espresso machine, grinders, blenders, refrigeration, ice machine, and POS.",
                estimated_amount_inr=cfg.cafe_equipment_inr,
            ),
            StartupCostItem(
                category="initial_rent_deposit",
                description="Commercial space rental advance (typically 3-6 months deposit in Coimbatore).",
                estimated_amount_inr=cfg.cafe_rent_deposit_inr,
            ),
            StartupCostItem(
                category="initial_inventory",
                description="Opening coffee beans, dairy, syrups, bakery ingredients, disposable packaging.",
                estimated_amount_inr=cfg.cafe_initial_inventory_inr,
            ),
            StartupCostItem(
                category="working_capital_reserve",
                description="2 to 3 months operational cash buffer for utilities, staff wages, and marketing.",
                estimated_amount_inr=cfg.cafe_working_capital_reserve_inr,
            ),
            StartupCostItem(
                category="licensing_permits",
                description="FSSAI registration, Coimbatore municipal trade license, GST, fire safety compliance.",
                estimated_amount_inr=cfg.cafe_licensing_permits_inr,
            ),
        ]
    elif btype in {"hotel", "small_restaurant", "restaurant", "hotel/small_restaurant"}:
        return [
            StartupCostItem(
                category="setup_renovation",
                description="Dining hall interiors, heavy exhaust ducting, kitchen tiling, and furniture setup.",
                estimated_amount_inr=cfg.hotel_setup_renovation_inr,
            ),
            StartupCostItem(
                category="equipment",
                description="Commercial burners, deep fryers, tandoor/ovens, cold storage, billing system, cookware.",
                estimated_amount_inr=cfg.hotel_equipment_inr,
            ),
            StartupCostItem(
                category="initial_rent_deposit",
                description="Commercial building rental advance deposit in Coimbatore high-footfall zone.",
                estimated_amount_inr=cfg.hotel_rent_deposit_inr,
            ),
            StartupCostItem(
                category="initial_inventory",
                description="Initial grocery, spices, oils, grains, perishables, and cleaning supplies.",
                estimated_amount_inr=cfg.hotel_initial_inventory_inr,
            ),
            StartupCostItem(
                category="working_capital_reserve",
                description="Operating buffer for chef/kitchen staff salaries, electricity, water, and initial marketing.",
                estimated_amount_inr=cfg.hotel_working_capital_reserve_inr,
            ),
            StartupCostItem(
                category="licensing_permits",
                description="FSSAI state license, commercial trade license, health NOC, pollution board compliance.",
                estimated_amount_inr=cfg.hotel_licensing_permits_inr,
            ),
        ]
    else:  # retail or general shop
        return [
            StartupCostItem(
                category="setup_renovation",
                description="Modular display racks, shelving, cashier desk, signage board, and LED spotlighting.",
                estimated_amount_inr=cfg.retail_setup_renovation_inr,
            ),
            StartupCostItem(
                category="equipment",
                description="Barcode scanners, receipt printer, digital billing terminal, CCTV, inverter backup.",
                estimated_amount_inr=cfg.retail_equipment_inr,
            ),
            StartupCostItem(
                category="initial_rent_deposit",
                description="Commercial shop room rental advance (standard Coimbatore commercial lease deposit).",
                estimated_amount_inr=cfg.retail_rent_deposit_inr,
            ),
            StartupCostItem(
                category="initial_inventory",
                description="Opening wholesale inventory, packaged retail merchandise, display stock.",
                estimated_amount_inr=cfg.retail_initial_inventory_inr,
            ),
            StartupCostItem(
                category="working_capital_reserve",
                description="Contingency cash reserve for first 2 months utility bills and vendor credit gap.",
                estimated_amount_inr=cfg.retail_working_capital_reserve_inr,
            ),
            StartupCostItem(
                category="licensing_permits",
                description="Shops & Establishments registration, GST registration, local trade license.",
                estimated_amount_inr=cfg.retail_licensing_permits_inr,
            ),
        ]


def evaluate_budget_feasibility(
    business_type: str,
    budget_inr: float,
    overrides: dict[str, float | None] | None = None,
    settings: Settings | None = None,
) -> BudgetFeasibilityResponse:
    """Assess whether a proposed investment budget covers estimated startup costs.

    Parameters
    ----------
    business_type : str
        Target category ('cafe', 'hotel', 'retail').
    budget_inr : float
        User's proposed investment budget in INR (must be positive).
    overrides : dict, optional
        Custom numeric estimates for specific cost categories.
    settings : Settings, optional
        Configuration instance.

    Returns
    -------
    BudgetFeasibilityResponse
        Itemized cost breakdown, total startup cost, budget difference,
        feasibility ratio, categorical classification, and illustrative disclaimer.
    """
    if budget_inr <= 0:
        raise ValueError("budget_inr must be strictly positive.")

    base_items = get_default_cost_breakdown(business_type, settings=settings)
    overrides = overrides or {}

    override_mapping = {
        "setup_renovation": overrides.get("setup_renovation_override_inr"),
        "equipment": overrides.get("equipment_override_inr"),
        "initial_rent_deposit": overrides.get("rent_deposit_override_inr"),
        "initial_inventory": overrides.get("initial_inventory_override_inr"),
        "working_capital_reserve": overrides.get("working_capital_reserve_override_inr"),
        "licensing_permits": overrides.get("licensing_permits_override_inr"),
    }

    final_breakdown: list[StartupCostItem] = []
    total_startup_cost = 0.0

    for item in base_items:
        custom_val = override_mapping.get(item.category)
        effective_amount = float(custom_val) if custom_val is not None else float(item.estimated_amount_inr)
        final_breakdown.append(
            StartupCostItem(
                category=item.category,
                description=item.description,
                estimated_amount_inr=effective_amount,
            )
        )
        total_startup_cost += effective_amount

    budget_difference = budget_inr - total_startup_cost
    ratio = budget_inr / total_startup_cost if total_startup_cost > 0 else 1.0

    # Categorical classification:
    # SURPLUS: budget covers >= 115% of estimated costs (providing a healthy 15%+ buffer)
    # FEASIBLE: budget covers between 90% and 114% (tightly aligned, manageable)
    # DEFICIT: budget covers < 90% (underfunded for standard baseline setup)
    if ratio >= 1.15:
        category = FeasibilityCategory.SURPLUS
    elif ratio >= 0.90:
        category = FeasibilityCategory.FEASIBLE
    else:
        category = FeasibilityCategory.DEFICIT

    return BudgetFeasibilityResponse(
        business_type=business_type.lower().strip(),
        user_budget_inr=budget_inr,
        total_estimated_startup_cost_inr=round(total_startup_cost, 2),
        budget_difference_inr=round(budget_difference, 2),
        feasibility_category=category,
        feasibility_ratio=round(ratio, 4),
        cost_breakdown=final_breakdown,
        is_illustrative=True,
    )
