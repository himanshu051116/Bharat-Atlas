const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../world-camera-scheduler.js');
test('high frequency camera changes produce a single settled redraw',()=>{
 const pending=new Map();let index=0,redraw=0,moving=0;
 const scheduler=create({onSettle:()=>redraw++,onMoving:()=>moving++,setDelay:fn=>{const id=++index;pending.set(id,fn);return id},clearDelay:id=>pending.delete(id)});
 for(let i=0;i<250;i++)scheduler.defer();
 assert.equal(redraw,0);assert.equal(moving,1);assert.equal(pending.size,1);
 [...pending.values()][0]();
 assert.equal(redraw,1);assert.equal(scheduler.isMoving(),false);
 assert.equal(scheduler.flush(),false);
});
test('pointer release flushes immediately and cancels idle callback',()=>{
 const tasks=new Map();let token=0,paints=0;
 const scheduler=create({onSettle:()=>paints++,setDelay:fn=>{const k=++token;tasks.set(k,fn);return k},clearDelay:k=>tasks.delete(k)});
 scheduler.defer();scheduler.defer();assert.equal(tasks.size,1);
 assert.equal(scheduler.flush(),true);assert.equal(tasks.size,0);assert.equal(paints,1);
 scheduler.defer();scheduler.dispose();assert.equal(tasks.size,0);assert.equal(paints,1);
});
