import json
import os

class RulesLoader:
    """Minimal stub for loading rule JSON files.

    Used by test_fallback to provide a `rules` attribute to AgentEngine.
    """
    def __init__(self, path: str):
        self.path = path
        self.rules = {}
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    self.rules = json.load(f)
            except Exception:
                # If loading fails, keep rules empty
                self.rules = {}

    def get_rules(self):
        """Return loaded rules dictionary."""
        return self.rules