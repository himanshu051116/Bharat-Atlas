import test from 'node:test';
import assert from 'node:assert/strict';
import {canRetryRenderer,createRendererDiagnosticRecord,rendererFailureType} from '../src/renderer-health.mjs';
test('manual recovery has a cooldown after an actual attempt',()=>{
  assert.equal(canRetryRenderer({now:1000,lastAttemptAt:0,attempts:0}),true);
  assert.equal(canRetryRenderer({now:1100,lastAttemptAt:1000,attempts:1}),false);
  assert.equal(canRetryRenderer({now:2500,lastAttemptAt:1000,attempts:1}),true);
  assert.equal(canRetryRenderer({now:NaN,lastAttemptAt:1000,attempts:1}),false);
});
test('renderer failure classification distinguishes loss from missing engine and tile faults',()=>{
  assert.equal(rendererFailureType('The browser lost its WebGL context'), 'context_lost');
  assert.equal(rendererFailureType('MapLibre library could not load'), 'engine_missing_or_failed');
  assert.equal(rendererFailureType('SHA-256 integrity mismatch in tile'), 'tile_loading_or_integrity');
  assert.equal(rendererFailureType('boundary geometry missing'), 'boundary_data_unavailable');
});
test('JSON diagnostics are local, bounded and do not pretend to certify hardware or geography',()=>{
  const d=createRendererDiagnosticRecord({generatedAt:'2026-10-24T00:00:00Z', status:'fallback',reason:'WebGL context lost',engineAvailable:true,
    engineVersion:'5.13.0',engineSupported:true,webgl2Probe:'context_created',userAgent:'Local test UA',attemptCount:2,mapLoaded:false,politicalBordersLoaded:false,physicalLandLoaded:true});
  assert.equal(d.format,'BharatAtlasRendererDiagnostics1');
  assert.equal(d.failureType,'context_lost');
  assert.equal(d.map.politicalBordersLoaded,false);
  assert.equal(d.webgl2Probe,'context_created');
  assert.match(d.disclosure,/not a real-GPU rendering proof/);
  assert.equal(d.remoteUrl,undefined);
  assert.ok(createRendererDiagnosticRecord({reason:'A'.repeat(900)}).reason.length<=250);
});
