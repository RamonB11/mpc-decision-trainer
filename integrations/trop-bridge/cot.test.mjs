import test from "node:test";
import assert from "node:assert/strict";
import {buildCot, xmlEscape} from "./cot.mjs";

const base = {
  sessionId:"exercise_001", objectId:"contact_1",
  callsign:"SIM CONTACT", affiliation:"unknown", lat:40.1, lon:-85.4
};
const when = new Date("2026-11-07T12:00:00.000Z");

test("synthetic CoT includes a stable, clearly labeled event", () => {
  const xml = buildCot(base, when);
  assert.match(xml, /uid="TDG-exercise_001-contact_1"/);
  assert.match(xml, /type="a-u-G-U-C"/);
  assert.match(xml, /time="2026-11-07T12:00:00.000Z"/);
  assert.match(xml, /stale="2026-11-07T12:02:00.000Z"/);
  assert.match(xml, /SIMULATED TRAINING CONTACT - NOT LIVE/);
  assert.match(xml, /lat="40.1" lon="-85.4"/);
});

test("affiliation changes CoT type", () => {
  assert.match(buildCot({...base, affiliation:"friendly"}, when), /type="a-f-G-U-C"/);
  assert.match(buildCot({...base, affiliation:"hostile"}, when), /type="a-h-G-U-C"/);
});

test("CoT contact names are XML escaped", () => {
  const xml = buildCot({...base,callsign:'SIM <A & "B">'}, when);
  assert.match(xml, /callsign="SIM &lt;A &amp; &quot;B&quot;&gt;"/);
  assert.equal(xmlEscape("'"), "&apos;");
});

test("reject malformed identifiers and out-of-range coordinates", () => {
  assert.throws(() => buildCot({...base,sessionId:"bad space"}, when));
  assert.throws(() => buildCot({...base,lat:91}, when));
  assert.throws(() => buildCot({...base,lon:Infinity}, when));
  assert.throws(() => buildCot({...base,lat:"40.1"}, when));
  assert.throws(() => buildCot({...base,affiliation:"other"}, when));
  assert.throws(() => buildCot({...base,callsign:""}, when));
});
