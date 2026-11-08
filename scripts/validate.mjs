import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const failures = [];

function requireMatch(description, pattern) {
  if (!pattern.test(html)) failures.push(description);
}

const requiredIds = [
  "screen-formation",
  "openTdmModule",
  "screen-tdm-menu",
  "formationGrid",
  "screen-menu",
  "scenarioGrid",
  "screen-mode",
  "screen-intro",
  "beginBtn",
  "screen-decision",
  "choices",
  "commitBtn",
  "inlineConsequence",
  "inlineContinueBtn",
  "screen-aar",
  "overallScore",
  "trainingRecordBtn",
  "exportProgressBtn",
  "importProgressBtn",
  "systemCheckBtn"
];

for (const id of requiredIds) {
  requireMatch(`Missing required element #${id}`, new RegExp(`id=["']${id}["']`));
}

for (const mode of ["easy", "medium", "hard"]) {
  requireMatch(
    `Missing ${mode} TDM difficulty control`,
    new RegExp(`data-mode=["']${mode}["']`)
  );
}

const requiredFunctions = [
  "showTdmMenu",
  "renderFormations",
  "selectFormation",
  "selectScenario",
  "startMode",
  "goDecision",
  "showAAR",
  "loadProgress",
  "persistProgress",
  "exportProgress",
  "importProgressFile"
];

for (const fn of requiredFunctions) {
  if (!html.includes("function " + fn + "(")) failures.push("Missing required function " + fn + "()");
}

function requireText(description, value) {
  if (!html.includes(value)) failures.push(description);
}
requireText("TRAINER_BUILD constant is missing", "const TRAINER_BUILD");
requireText("Progress persistence no longer references localStorage", "localStorage");
requireText("TDM scenario data is missing", "const DATA");
requireText("Telemetry helper is missing", "function trackTrainingEvent(");
requireText("Vercel Web Analytics script is missing", "/_vercel/insights/script.js");
requireText("Vercel Speed Insights script is missing", "/_vercel/speed-insights/script.js");
requireText("TDM start telemetry is missing", "tdm_scenario_started");
requireText("TDM completion telemetry is missing", "tdm_scenario_completed");
requireText("Reports telemetry is missing", "report_completed");
requireText("CFFT telemetry is missing", "cfft_completed");

if (/^(<<<<<<< .+|=======|>>>>>>> .+)$/m.test(html)) {
  failures.push("Unresolved merge-conflict marker found in index.html");
}

if (failures.length) {
  console.error("TDM structural validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("TDM structural validation passed.");
console.log(`Validated ${requiredIds.length} required UI elements, ${requiredFunctions.length} core functions, and all three difficulty modes.`);
