"""Nutrition parsing helpers (used by Claude service in Phase 3)."""


def parse_nutrition_from_text(text: str) -> dict | None:
    """Attempt to extract macro data from free-form text via Claude.

    This is a thin wrapper used when nutrition data needs to be parsed
    outside of the main chat flow (e.g., batch import). Full implementation
    in Phase 3.
    """
    return None
