import json
import re
from datetime import date, timedelta
from flask import current_app
import anthropic

from app import db
from app.models import WhoopData, NutritionLog, WeightLog, Workout, ChatMessage

MODEL = "claude-sonnet-4-6"
MAX_HISTORY = 20  # previous messages sent for context


HEIGHT_CM = 192
DATE_OF_BIRTH = date(1999, 10, 3)
AVG_DAILY_STEPS = 10000


def calculate_tdee(user_id: str, today: date) -> str:
    latest_weight = (
        WeightLog.query.filter_by(user_id=user_id)
        .order_by(WeightLog.date.desc()).first()
    )
    weight_kg = latest_weight.weight_kg if latest_weight else 88

    age = (today - DATE_OF_BIRTH).days / 365.25
    bmr = 10 * weight_kg + 6.25 * HEIGHT_CM - 5 * age + 5  # Mifflin-St Jeor male
    step_kcal = AVG_DAILY_STEPS * 0.04 * (weight_kg / 70)
    tef = bmr * 0.10

    todays_workouts = Workout.query.filter_by(user_id=user_id, date=today).all()
    workout_kcal = 0
    workout_notes = []
    for w in todays_workouts:
        raw = w.raw_json or {}
        if w.source == "garmin" and raw.get("calories"):
            cal = raw["calories"]
            workout_kcal += cal
            workout_notes.append(f"{w.title} {cal} kcal (Garmin)")
        elif w.source == "hevy" and w.duration_minutes:
            cal = round(5 * weight_kg * (w.duration_minutes / 60))
            workout_kcal += cal
            workout_notes.append(f"{w.title} ~{cal} kcal (Hevy estimate)")

    tdee = round(bmr + step_kcal + tef + workout_kcal)
    breakdown = f"BMR {round(bmr)} + steps {round(step_kcal)} + TEF {round(tef)}"
    if workout_notes:
        breakdown += " + " + " + ".join(workout_notes)

    return f"~{tdee} kcal ({breakdown})"


def build_context(user_id: str) -> str:
    today = date.today()
    week_ago = today - timedelta(days=7)

    # Weight trend (7 days)
    weights = (
        WeightLog.query
        .filter(WeightLog.user_id == user_id, WeightLog.date >= week_ago)
        .order_by(WeightLog.date)
        .all()
    )
    weight_trend = " → ".join(f"{w.weight_kg}kg" for w in weights) if weights else "No data"

    # Today's Whoop data
    whoop = WhoopData.query.filter_by(user_id=user_id, date=today).first()
    whoop_str = "No data"
    if whoop:
        whoop_str = (
            f"Recovery: {whoop.recovery_score}, HRV: {whoop.hrv_ms}ms, "
            f"Resting HR: {whoop.resting_hr}bpm, Sleep: {whoop.sleep_duration_hours}h"
        )

    # Today's nutrition
    nutrition = NutritionLog.query.filter_by(user_id=user_id, date=today).all()
    if nutrition:
        total_cal = sum(n.calories or 0 for n in nutrition)
        total_protein = sum(n.protein_g or 0 for n in nutrition)
        total_carbs = sum(n.carbs_g or 0 for n in nutrition)
        total_fat = sum(n.fat_g or 0 for n in nutrition)
        nutrition_str = (
            f"{total_cal} kcal (protein: {total_protein}g, "
            f"carbs: {total_carbs}g, fat: {total_fat}g)"
        )
    else:
        nutrition_str = "Nothing logged yet"

    # Last 5 workouts with exercise details
    workouts = (
        Workout.query
        .filter_by(user_id=user_id)
        .order_by(Workout.date.desc())
        .limit(5)
        .all()
    )
    workout_lines = []
    for w in workouts:
        raw = w.raw_json or {}
        exercises = raw.get("exercises", [])
        ex_summary = []
        for ex in exercises[:6]:
            sets = ex.get("sets", [])
            if sets:
                top_set = max(sets, key=lambda s: (s.get("weight_kg") or 0))
                ex_summary.append(
                    f"{ex.get('title', '?')} {top_set.get('reps')}x{top_set.get('weight_kg')}kg"
                )
        detail = ", ".join(ex_summary) if ex_summary else "no detail"
        dur = f"{w.duration_minutes}min " if w.duration_minutes else ""
        workout_lines.append(f"{w.date} {w.title} ({dur}{detail})")
    workout_str = "\n".join(workout_lines) if workout_lines else "No recent workouts"

    tdee_str = calculate_tdee(user_id, today)
    tdee_line = f"Estimated TDEE today: {tdee_str}" if tdee_str else "TDEE: set up profile in Settings for TDEE tracking"

    return f"""Today: {today}
Weight trend (7d): {weight_trend}
Today's Whoop: {whoop_str}
Today's nutrition so far: {nutrition_str}
{tdee_line}
Recent workouts: {workout_str}"""


WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search"}


def _get_history(user_id: str) -> list[dict]:
    messages = (
        ChatMessage.query
        .filter_by(user_id=user_id, date=date.today())
        .order_by(ChatMessage.created_at.asc())
        .limit(MAX_HISTORY)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in messages]


def call_claude(user_id: str, user_message: str, context: str) -> str:
    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])

    system_prompt = f"""You are a personal health coach with access to the user's health data. Today's snapshot:

{context}

When the user mentions food they ate, log EACH food item as a separate entry. Append a JSON array at the very end of your response (after your full reply):
```json
[
  {{"log_nutrition": true, "meal_type": "lunch", "description": "1 sneetje bruinbrood", "calories": 80, "protein_g": 3.0, "carbs_g": 14.0, "fat_g": 1.0}},
  {{"log_nutrition": true, "meal_type": "lunch", "description": "3 volkoren knäckebröd", "calories": 174, "protein_g": 4.5, "carbs_g": 33.0, "fat_g": 1.5}}
]
```
Nutrition logging rules (follow strictly):
- One JSON entry per individual food item or drink — never combine multiple foods into one entry.
- Use correct meal_type: breakfast / lunch / dinner / snack.
- Use realistic Dutch/European nutritional values (NEVO database standards).
- For packaged products: use web search to find the exact nutritional values, then log based on the quantity eaten.
- Calories must match: roughly 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat.
- If the user corrects a previous log, only log the correction — never re-log already saved items.
- If food was not eaten (e.g. "I'm planning to eat..."), do NOT log it.
- Only log when the user explicitly says they ate/drank something.
Respond in the same language the user writes in. Be concise and data-driven."""

    history = _get_history(user_id)
    messages = history + [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system_prompt,
            tools=[WEB_SEARCH_TOOL],
            messages=messages,
        )

        text_blocks = [b for b in response.content if hasattr(b, "text") and b.text]

        if response.stop_reason == "end_turn":
            return "\n".join(b.text for b in text_blocks) if text_blocks else ""

        if response.stop_reason == "tool_use":
            # Continue loop — web_search is server-side, pass back tool results
            messages.append({"role": "assistant", "content": response.content})
            tool_results = [
                {"type": "tool_result", "tool_use_id": b.id, "content": ""}
                for b in response.content if hasattr(b, "id") and b.type == "tool_use"
            ]
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
        else:
            return "\n".join(b.text for b in text_blocks) if text_blocks else ""


def extract_nutrition(user_id: str, assistant_reply: str) -> bool:
    """Parse nutrition JSON array (or single object) from Claude's reply and persist."""
    # Match array or single object inside a code block, or bare
    code_block = re.search(r'```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```', assistant_reply, re.DOTALL)
    bare_arr = re.search(r'\[\s*\{[^[\]]*"log_nutrition"[^[\]]*\}\s*(?:,\s*\{[^[\]]*\}\s*)*\]', assistant_reply, re.DOTALL)
    bare_obj = re.search(r'\{[^{}]*"log_nutrition"\s*:\s*true[^{}]*\}', assistant_reply, re.DOTALL)

    raw = None
    if code_block:
        raw = code_block.group(1)
    elif bare_arr:
        raw = bare_arr.group()
    elif bare_obj:
        raw = bare_obj.group()

    if not raw:
        return False

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return False

    entries = data if isinstance(data, list) else [data]
    saved = 0
    for item in entries:
        if not item.get("log_nutrition"):
            continue
        log = NutritionLog(
            user_id=user_id,
            date=date.today(),
            meal_type=item.get("meal_type"),
            description=item.get("description", ""),
            calories=item.get("calories"),
            protein_g=item.get("protein_g"),
            carbs_g=item.get("carbs_g"),
            fat_g=item.get("fat_g"),
        )
        db.session.add(log)
        saved += 1

    if saved:
        db.session.commit()
    return saved > 0
