from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS

db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name=None):
    app = Flask(__name__)

    from app.config import config
    cfg = config.get(config_name or "default")
    app.config.from_object(cfg)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=app.config.get("CORS_ORIGINS", [
        "https://brave-ocean-004361b03.7.azurestaticapps.net",
        "http://localhost:5173",
    ]))

    from app.routes.chat import chat_bp
    from app.routes.nutrition import nutrition_bp
    from app.routes.weight import weight_bp
    from app.routes.workouts import workouts_bp
    from app.routes.sync import sync_bp
    from app.routes.whoop_auth import whoop_bp
    from app.routes.profile import profile_bp

    app.register_blueprint(chat_bp, url_prefix="/api")
    app.register_blueprint(nutrition_bp, url_prefix="/api")
    app.register_blueprint(weight_bp, url_prefix="/api")
    app.register_blueprint(workouts_bp, url_prefix="/api")
    app.register_blueprint(sync_bp, url_prefix="/api")
    app.register_blueprint(whoop_bp, url_prefix="/api")
    app.register_blueprint(profile_bp, url_prefix="/api")

    @app.route("/health")
    def health():
        return {"status": "ok"}, 200

    @app.errorhandler(404)
    def not_found(e):
        return {"error": "Not found"}, 404

    @app.errorhandler(500)
    def server_error(e):
        return {"error": "Internal server error"}, 500

    return app
