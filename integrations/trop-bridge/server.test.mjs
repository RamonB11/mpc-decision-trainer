import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {setTimeout as sleep} from "node:timers/promises";

const TOKENS = {
  excon:"excon-test-0123456789-abcdefghijklmnopqrstuvwxyz",
  player:"player-test-0123456789-abcdefghijklmnopqrstuvwxyz",
  observer:"observer-test-0123456789-abcdefghijklmnopqrstuvwxyz"
};
async function unusedPort() {
  const server=createServer();
  await new Promise((resolve,reject)=>server.listen(0,"127.0.0.1",resolve).on("error",reject));
  const port=server.address().port;
  await new Promise((resolve)=>server.close(resolve));
  return port;
}

test("EXCON sessions enforce authorization and withhold ground truth", {timeout:15000}, async () => {
  const port=await unusedPort();
  const base="http://127.0.0.1:"+port;
  const child=spawn(process.execPath,["integrations/trop-bridge/server.mjs"],{
    env:{...process.env,TDG_BIND_HOST:"127.0.0.1",TDG_PORT:String(port),
      TDG_EXCON_TOKEN:TOKENS.excon,TDG_PLAYER_TOKEN:TOKENS.player,
      TDG_OBSERVER_TOKEN:TOKENS.observer,TDG_PUBLISH_ENABLED:"0"},
    stdio:["ignore","pipe","pipe"]
  });
  let errors="";
  child.stderr.on("data",(chunk)=>{errors+=chunk.toString();});
  try {
    let ready=false;
    for(let i=0;i<50;i++){
      if(child.exitCode!==null) throw new Error("Server exited: "+errors);
      try {const resp=await fetch(base+"/health");if(resp.ok){ready=true;break;}} catch {}
      await sleep(100);
    }
    assert.equal(ready,true,"Bridge did not start: "+errors);
    const call=async (path,role,method="GET",payload) => {
      const response=await fetch(base+path,{
        method,headers:{"Authorization":"Bearer "+(TOKENS[role]||"invalid"),"Content-Type":"application/json"},
        body:payload?JSON.stringify(payload):undefined
      });
      return {status:response.status,data:await response.json()};
    };
    assert.equal((await call("/v1/sessions","player","POST",{scenarioId:"recon-continuous"})).status,403);
    const created=await call("/v1/sessions","excon","POST",{scenarioId:"recon-continuous"});
    assert.equal(created.status,201);
    const id=created.data.sessionId;
    assert.ok(id);
    const suffix="/v1/sessions/"+id;
    assert.equal((await call(suffix+"/game-event","player","POST",{
      type:"scenario-started",scenarioId:"recon-continuous",runId:"run_1",mode:"easy"
    })).status,201);
    assert.equal((await call(suffix+"/game-event","player","POST",{
      type:"decision-committed",scenarioId:"wrong",runId:"run_1",mode:"easy",decisionIndex:0
    })).status,400);
    assert.equal((await call(suffix+"/inject","excon","POST",{
      objectId:"private_1",callsign:"EXCON CONTACT",affiliation:"unknown",
      lat:39,lon:-86.5,visibility:"excon"
    })).status,201);
    const observer=await call(suffix+"/events","observer");
    assert.equal(observer.status,200);
    assert.equal(observer.data.events.some((e)=>e.objectId==="private_1"),false);
    const excon=await call(suffix+"/events","excon");
    assert.equal(excon.data.events.some((e)=>e.objectId==="private_1"),true);
    const release=await call(suffix+"/inject","excon","POST",{
      objectId:"released_1",callsign:"SIM MARKER",affiliation:"friendly",
      lat:39,lon:-86.5,visibility:"player"
    });
    assert.equal(release.status,201);
    assert.equal(release.data.event.delivery,"dry-run");
    assert.match(release.data.cotPreview,/SIMULATED TRAINING CONTACT/);
    assert.equal((await call(suffix+"/events","observer")).data.events.some((e)=>e.objectId==="released_1"),true);
  } finally {
    child.kill();
  }
});
