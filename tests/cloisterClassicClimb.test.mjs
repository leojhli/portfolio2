import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import {before,after,test} from "node:test"
import {createServer} from "vite"
import * as THREE from "three"

let server, route, legacyRunner, legacy, starts, durations, cameraData
const parent=new THREE.Group(), legacyActor=new THREE.Group()
before(async()=>{
  server=await createServer({server:{middlewareMode:true},logLevel:"silent"})
  const {loadCloisterClassicRoute}=await server.ssrLoadModule("/src/three/cloisterBakedRoute.ts")
  const {loadCloisterRunner}=await server.ssrLoadModule("/src/three/cloisterRunner.ts")
  const {createChoreography}=await server.ssrLoadModule("/src/three/cloisterChoreography.ts")
  ;({CLOISTER_SEGMENT_STARTS:starts,CLOISTER_SEGMENT_DURATIONS:durations}=await server.ssrLoadModule("/src/three/cloisterTimeline.ts"))
  legacy=createChoreography()
  const asset=await readFile(new URL("../public/models/cloister/classic-climb.glb",import.meta.url))
  const oldAsset=await readFile(new URL("../public/models/cloister/altair.glb",import.meta.url))
  cameraData=JSON.parse(await readFile(new URL("../public/models/cloister/classic-climb-camera.json",import.meta.url)))
  const fetch=globalThis.fetch
  globalThis.fetch=async url=>new Response(url.endsWith(".json")?JSON.stringify(cameraData):url.endsWith("altair.glb")?oldAsset:asset)
  try{route=await loadCloisterClassicRoute(parent);legacyRunner=await loadCloisterRunner(legacyActor)}
  finally{globalThis.fetch=fetch}
})
after(async()=>{route?.dispose();legacyRunner?.dispose();await server?.close()})
const near=(a,b,tol=2e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`)
function old(t,aspect=16/9){
  let s=4;while(s>0&&starts[s]>t+1e-8)s--
  return legacy(s,Math.round((t-starts[s])*1e9)/1e9,aspect,legacyRunner.actionDurations)
}
function pose(t){
  route.sample(t)
  const values=[]
  route.root.traverse(o=>{if(o.isBone)values.push(...o.position.toArray(),...o.quaternion.toArray())})
  return{root:route.actor.position.toArray(),yaw:route.actor.quaternion.toArray(),bones:values}
}
test("classic timing, opening, vault, and original Leap retain the published animation",()=>{
  assert.deepEqual(durations,[3.15,2.3,2.8,4.7,5])
  near(route.duration,17.95)
  for(const t of [0,.5,2,3.15,5.45,6.0333333333,11.35,11.8,12.95,13.2,14,17.95]){
    const p=old(t)
    legacyActor.position.copy(p.position);legacyActor.rotation.y=p.yaw
    legacyRunner.sample(p.action,p.actionTime,p.blend,{bank:p.bank,lean:p.lean})
    legacyActor.updateMatrixWorld(true);route.sample(t)
    for(const bone of ["pelvis","Head","hand_l","hand_r","foot_l","foot_r"]){
      const expected=legacyRunner.root.getObjectByName(bone).getWorldPosition(new THREE.Vector3())
      const actual=route.root.getObjectByName(bone).getWorldPosition(new THREE.Vector3())
      actual.toArray().forEach((v,i)=>near(v,expected.toArray()[i],.003))
    }
  }
})
test("the original camera composition is retained in landscape and portrait outside the wall replacement",()=>{
  for(const aspect of [16/9,390/844])for(const t of [0,.5,2,3.15,5.45,6,11.35,11.8,12.95,13.2,14,17.95]){
    const p=old(t,aspect),actual=route.sampleCamera(t,aspect)
    actual.camera.toArray().forEach((v,i)=>near(v,p.camera.toArray()[i],.001))
    actual.target.toArray().forEach((v,i)=>near(v,p.target.toArray()[i],.001))
    near(actual.fov,p.fov,.001);near(actual.framing,p.framing,.001)
  }
})
test("the replacement reaches the east wall and climbs to the original Leap without a route jump",()=>{
  let previous
  for(let i=363;i<=681;i++){
    const t=i/60,p=pose(t)
    assert.ok([...p.root,...p.yaw,...p.bones].every(Number.isFinite))
    if(previous){
      assert.ok(new THREE.Vector3(...p.root).distanceTo(new THREE.Vector3(...previous.root))<.3)
      assert.ok(new THREE.Quaternion(...p.yaw).angleTo(new THREE.Quaternion(...previous.yaw))<.2)
    }
    previous=p
  }
  const hanging=pose(8.25)
  assert.ok(hanging.root[0]>15 && hanging.root[1]>2 && hanging.root[1]<5)
  const top=pose(10.95)
  assert.ok(top.root[1]>7)
  const leap=pose(11.35)
  leap.root.forEach((v,i)=>near(v,[15.1,6.65,7][i]))
})
test("every chapter resumes the same complete pose after navigation or a seek to the end",()=>{
  for(let s=0;s<4;s++){
    const t=starts[s]+durations[s],held=pose(t)
    near(t,starts[s+1]);pose(17.95);pose(0)
    assert.deepEqual(pose(starts[s+1]),held)
    assert.notDeepEqual(pose(t-.05).bones,held.bones)
  }
})
test("shot samples never interpolate across a cut and the final frame clears blur",()=>{
  for(const shot of cameraData.shots.slice(1)){
    const at=route.sampleCamera(shot.start)
    assert.equal(at.shotId,shot.id)
    at.camera.toArray().forEach((v,i)=>near(v,shot.samples[0].position[i]))
  }
  assert.equal(route.sampleCamera(17.95).motionBlur,0)
})
