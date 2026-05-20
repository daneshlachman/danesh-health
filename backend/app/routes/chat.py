from flask import Blueprint, request, jsonify, current_app
from app import db
from app.models import ChatMessage, User
from app.services.claude import build_context, call_claude, extract_nutrition

chat_bp = Blueprint("chat", __name__)

# Hardcoded single-user ID for Phase 1 (auth added later)
DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


def _ensure_user():
    user = db.session.get(User, DEFAULT_USER_ID)
    if not user:
        user = User(id=DEFAULT_USER_ID)
        db.session.add(user)
        db.session.commit()
    return user


@chat_bp.route("/chat", methods=["POST"])
def chat():
    body = request.get_json(silent=True) or {}
    user_message = body.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "message is required"}), 400

    user = _ensure_user()

    # Persist user message
    user_msg = ChatMessage(user_id=user.id, role="user", content=user_message)
    db.session.add(user_msg)
    db.session.commit()

    # Build health context and call Claude
    context = build_context(user.id)
    reply = call_claude(user.id, user_message, context)

    # Persist assistant reply
    assistant_msg = ChatMessage(user_id=user.id, role="assistant", content=reply)
    db.session.add(assistant_msg)
    db.session.commit()

    # Extract and save any nutrition mentioned in the conversation
    nutrition_logged = extract_nutrition(user.id, reply)

    return jsonify({
        "message": reply,
        "nutrition_logged": nutrition_logged,
    })


@chat_bp.route("/chat/history", methods=["GET"])
def chat_history():
    user = _ensure_user()
    limit = min(int(request.args.get("limit", 50)), 200)
    messages = (
        ChatMessage.query
        .filter_by(user_id=user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([m.to_dict() for m in reversed(messages)])
