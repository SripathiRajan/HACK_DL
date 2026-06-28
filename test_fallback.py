from backend.modules.agent.engine import AgentEngine
from backend.modules.fines.fine_lookup import FineLookup
from backend.modules.rules.rules_loader import RulesLoader
from backend.modules.geofencing.geofencing_engine import GeofencingEngine

class MockSearch:
    def search(self, text, top_k=3):
        return [{"score": 0.5, "metadata": {"title": "Mock rule"}, "content": "This is a mock rule."}]

fine_lookup = FineLookup("backend/data/fines.db")
rules = RulesLoader("backend/data/rules.json")
geo = GeofencingEngine("backend/data/zones.json")

engine = AgentEngine(fine_lookup, rules, geo)
engine.hybrid_search = MockSearch()
engine.ollama_available = False
engine.gemini_available = False

print("Test 47:", engine.run("Thanks for the information!", None))
print("Test 48:", engine.run("Give me a recipe for chocolate cake.", None))
print("Test 10:", engine.run("Fine for wrong-way driving in Gujarat for a truck.", None))
