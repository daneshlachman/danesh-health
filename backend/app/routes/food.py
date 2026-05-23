import re
import requests
from flask import Blueprint, request, jsonify, current_app
from requests_oauthlib import OAuth1

food_bp = Blueprint("food", __name__)


def _parse_description(desc):
    """Parse FatSecret food_description to per-100g macros.
    Handles: 'Per 100g', 'Per 30g', 'Per 1 serving (30g)', 'Per 1 oz (28g)' etc.
    """
    # Try direct gram amount first: "Per 100g" or "Per 30.5g"
    m = re.search(r"Per\s+([\d.]+)\s*g\s*-", desc)
    if not m:
        # Try parenthesised: "Per 1 serving (30g)" or "Per 1 oz (28.3g)"
        m = re.search(r"\(([\d.]+)\s*g\)", desc)
    if not m:
        return None

    serving_g = float(m.group(1))
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


def _search_fatsecret(query, auth):
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
        return []

    foods = data.get("foods", {}).get("food", [])
    if isinstance(foods, dict):
        foods = [foods]

    results = []
    for f in foods:
        macros = _parse_description(f.get("food_description", ""))
        if not macros:
            continue
        results.append({
            "name": f.get("food_name", ""),
            "brand": f.get("brand_name", ""),
            **macros,
        })
    return results


def _search_off(query):
    """Open Food Facts fallback — good for branded supplements and packaged products."""
    try:
        resp = requests.get(
            "https://world.openfoodfacts.org/cgi/search.pl",
            params={
                "search_terms": query,
                "json": 1,
                "page_size": 10,
                "sort_by": "unique_scans_n",
                "fields": "product_name,brands,nutriments",
            },
            timeout=8,
        )
        resp.raise_for_status()
        products = resp.json().get("products", [])
    except Exception as e:
        current_app.logger.error(f"OFF error: {e}")
        return []

    results = []
    for p in products:
        n = p.get("nutriments", {})
        kcal = n.get("energy-kcal_100g")
        if not p.get("product_name") or not kcal:
            continue
        results.append({
            "name": p["product_name"],
            "brand": (p.get("brands") or "").split(",")[0].strip(),
            "calories_100g": round(kcal, 1),
            "protein_100g": round(n.get("proteins_100g") or 0, 2),
            "carbs_100g": round(n.get("carbohydrates_100g") or 0, 2),
            "fat_100g": round(n.get("fat_100g") or 0, 2),
        })
    return results


@food_bp.route("/food/search")
def food_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])

    auth = OAuth1(
        current_app.config["FATSECRET_KEY"],
        current_app.config["FATSECRET_SECRET"],
    )

    fs_results = _search_fatsecret(query, auth)

    # Als FatSecret weinig oplevert, vul aan met Open Food Facts
    if len(fs_results) < 3:
        off_results = _search_off(query)
        seen = {r["name"].lower() for r in fs_results}
        for r in off_results:
            if r["name"].lower() not in seen:
                fs_results.append(r)
                seen.add(r["name"].lower())

    return jsonify(fs_results)
