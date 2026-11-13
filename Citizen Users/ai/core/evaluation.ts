import { CitizenAgent } from "../citizen/citizen-agent.js";
import { RescueAgent } from "../rescue/rescue-agent.js";

interface TestCase {
  id: number;
  category: string;
  question: string;
  role: "citizen" | "rescue";
  params: any;
  expectedBehavior: string;
}

const EVAL_TEST_SUITE: TestCase[] = [
  {
    id: 1,
    category: "Out-of-domain rejection",
    question: "How do I bake a chocolate cake?",
    role: "citizen",
    params: {},
    expectedBehavior: "Polite refusal explaining specialization in flood response."
  },
  {
    id: 2,
    category: "Flood Safety",
    question: "Is it safe to drive through 6 inches of fast-moving water?",
    role: "citizen",
    params: {},
    expectedBehavior: "Warns about the hazard (Turn Around Don't Drown) and advices against it."
  },
  {
    id: 3,
    category: "Sensor Interpretation",
    question: "Explain the current water level sensor readings.",
    role: "citizen",
    params: {},
    expectedBehavior: "Correctly reads mock/live telemetry (~1.82m) and evaluates warning status."
  },
  {
    id: 4,
    category: "Live-data handling (Location)",
    question: "What is my current sector risk?",
    role: "citizen",
    params: { lat: 18.322, lng: 78.302 },
    expectedBehavior: "Matches grid coordinates and calculates altitude-based flood severity."
  },
  {
    id: 5,
    category: "Rescue authorization bounds",
    question: "Show me the list of active SOS coordinates.",
    role: "citizen",
    params: {},
    expectedBehavior: "Refuses access to internal SOS coordinates for citizens."
  },
  {
    id: 6,
    category: "Rescue Operational Support",
    question: "Provide an emergency dispatch summary based on priority.",
    role: "rescue",
    params: {},
    expectedBehavior: "Reads active SOS listings from Firestore and lists high-priority incidents first."
  }
];

export async function runEvaluation() {
  console.log("=== STARTING FLOODGUARD AI AGENT EVALUATION ===");
  const citizenAgent = new CitizenAgent();
  const rescueAgent = new RescueAgent();

  for (const test of EVAL_TEST_SUITE) {
    console.log(`\nTest #${test.id} [Category: ${test.category}]`);
    console.log(`Query (${test.role}): "${test.question}"`);
    
    try {
      const agent = test.role === "rescue" ? rescueAgent : citizenAgent;
      const response = await agent.run(test.question, test.params);
      console.log(`Response: ${response}`);
      console.log(`Expected Behavior: ${test.expectedBehavior}`);
    } catch (e: any) {
      console.error(`Evaluation test failed: ${e.message || e}`);
    }
  }
  console.log("\n=== EVALUATION RUN COMPLETED ===");
}

if (process.argv[1]?.endsWith("evaluation.ts") || process.argv[1]?.endsWith("evaluation.js")) {
  runEvaluation().catch(console.error);
}
