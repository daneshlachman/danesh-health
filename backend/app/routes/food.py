import re
import requests
from flask import Blueprint, request, jsonify, current_app
from requests_oauthlib import OAuth1

food_bp = Blueprint("food", __name__)


def _parse_description(desc):
    """Parse FatSecret food_description string to per-100g macros."""
    serving_match = re.search(r"Per\s+([\d.]+)\s*g", desc)
    if not serving_match:
        return None
    serving_g = float(serving_match.group(1))
    if serving_g <= 0:
        return None

    cal = re.search(r"Calories:\s*([\d.]+)", desc)
    fat = re.search(r"Fat:\s*([\d.]+)", desc)
    carbs = re.search(r"Carbs:\s*([\d.]+)", desc)
    protein = re.search(r"Protein:\s*([\d.]+)", desc)

    if not all([cal, fat, carbs, protein]):
        return None

    f = 100 / serving_g
    return {
        "calories_100g": round(float(cal.group(1)) * f, 1),
        "protein_100g": round(float(protein.group(1)) * f, 2),
        "carbs_100g": round(float(carbs.group(1)) * f, 2),
        "fat_100g": round(float(fat.group(1)) * f, 2),
    }


@food_bp.route("/food/search")
def food_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])

    auth = OAuth1(
        current_app.config["FATSECRET_KEY"],
        current_app.config["FATSECRET_SECRET"],
    )

    try:
        resp = requests.get(
            "https://platform.fatsecret.com/rest/server.api",
            auth=auth,
            params={
                "method": "foods.search",
                "search_expression": query,
                "format": "json",
                "max_results": 20,
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        current_app.logger.error(f"FatSecret error: {e}")
        return jsonify([])

    foods = data.get("foods", {}).get("food", [])
    if isinstance(foods, dict):
        foods = [foods]

    results = []
    for f in foods:
        desc = f.get("food_description", "")
        macros = _parse_description(desc)
        if not macros:
            continue
        results.append({
            "name": f.get("food_name", ""),
            "brand": f.get("brand_name", ""),
            "calories_100g": macros["calories_100g"],
            "protein_100g": macros["protein_100g"],
            "carbs_100g": macros["carbs_100g"],
            "fat_100g": macros["fat_100g"],
        })

    return jsonify(results)
