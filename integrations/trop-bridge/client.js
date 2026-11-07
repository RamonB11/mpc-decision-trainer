/* Opt-in companion for the isolated TDG training bridge.
 * Never sends location, free text, scoring details or stored progress.
 * Credentials exist only in this tab's JavaScript memory.
 */
(() => {
  "use strict";
  let connection = null;
  let busy = false;
  const safeId = (value) => String(value || "").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64);

  async function send(type, detail) {
    if (!connection || busy) return;
    if (detail.scenarioId !== connection.scenarioId) {
      setStatus("Scenario mismatch", true);
      return;
    }
    const body = {
      type,
      scenarioId:detail.scenarioId,
      runId:safeId(detail.runId),
      mode:detail.mode,
      decisionIndex:detail.decisionIndex
    };
    try {
      const response = await fetch(connection.url + "/v1/sessions/" + connection.id + "/game-event", {
        method:"POST",
        headers:{"content-type":"application/json","authorization":"Bearer " + connection.token},
        body:JSON.stringify(body)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      setStatus("TROP Lab paired");
    } catch (error) {
      setStatus("Bridge unavailable", true);
      console.warn("TDG training bridge send failed:", error.message);
    }
  }

  let button;
  function setStatus(message, error = false) {
    if (!button) return;
    button.textContent = message;
    button.style.borderColor = error ? "#b65f58" : "#68b684";
  }

  function makeControl() {
    const header = document.querySelector(".topin") || document.querySelector(".top");
    if (!header) return;
    button = document.createElement("button");
    button.type = "button";
    button.textContent = "TROP Lab · Connect";
    button.title = "Pair this browser with a simulated TDG training session";
    button.className = "secondary";
    button.style.cssText = "font-size:11px;min-height:36px;padding:7px;white-space:nowrap";
    header.appendChild(button);

    const dialog = document.createElement("dialog");
    dialog.style.cssText = "background:#172026;color:#e8edef;border:1px solid #344148;border-radius:12px;padding:18px;max-width:390px;width:90vw";
    dialog.innerHTML = '<form method="dialog" style="display:grid;gap:10px">' +
      '<strong>Pair training session</strong>' +
      '<small>Simulated training only. Do not use operational TAK credentials.</small>' +
      '<label>Bridge URL<input name="url" placeholder="https://training-gateway.example" required style="display:block;width:100%;padding:8px"></label>' +
      '<label>Session ID<input name="id" autocomplete="off" required style="display:block;width:100%;padding:8px"></label>' +
      '<label>Scenario ID<input name="scenario" autocomplete="off" required style="display:block;width:100%;padding:8px"></label>' +
      '<label>Player token<input name="token" type="password" autocomplete="off" required style="display:block;width:100%;padding:8px"></label>' +
      '<p id="tdg-pair-error" style="font-size:12px;color:#f0b1ab;margin:0"></p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="secondary" value="cancel">Cancel</button><button class="primary" id="tdg-pair-save" value="save">Connect</button></div></form>';
    document.body.appendChild(dialog);
    button.addEventListener("click", () => dialog.showModal());
    const form = dialog.querySelector("form");
    form.addEventListener("submit", async (event) => {
      if (event.submitter?.value !== "save") return;
      event.preventDefault();
      const data = new FormData(form);
      const error = dialog.querySelector("#tdg-pair-error");
      const inputUrl = String(data.get("url") || "");
      const raw = inputUrl.endsWith("/") ? inputUrl.slice(0, -1) : inputUrl;
      let url;
      try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:" &&
            !(parsed.protocol === "http:" && ["localhost","127.0.0.1"].includes(parsed.hostname))) {
          throw new Error("Use HTTPS or localhost");
        }
        if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("Use a plain origin URL");
        url = parsed.origin;
      } catch (e) {error.textContent = e.message; return;}
      const id = String(data.get("id") || "");
      const scenarioId = String(data.get("scenario") || "");
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !/^[A-Za-z0-9_-]{1,64}$/.test(scenarioId)) {
        error.textContent = "Use the IDs supplied by EXCON"; return;
      }
      const token = String(data.get("token") || "");
      if (!token) {error.textContent = "Player token required"; return;}
      busy = true;
      try {
        const check = await fetch(url + "/health");
        if (!check.ok) throw new Error("Cannot reach training bridge");
        connection = {url,id,scenarioId,token};
        dialog.close();
        form.reset();
        setStatus("TROP Lab paired");
      } catch (e) {error.textContent = e.message;}
      finally {busy = false;}
    });
  }
  window.addEventListener("tdg:scenario-started", (e) => {void send("scenario-started", e.detail);});
  window.addEventListener("tdg:decision-committed", (e) => {void send("decision-committed", e.detail);});
  window.addEventListener("tdg:aar-opened", (e) => {void send("aar-opened", e.detail);});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", makeControl);
  else makeControl();
})();
