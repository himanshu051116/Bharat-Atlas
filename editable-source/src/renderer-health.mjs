/** Research viewer renderer diagnostics. Never calls a remote endpoint or claims GPU certification. */
export const RENDERER_DIAGNOSTICS_VERSION='BharatAtlasRendererDiagnostics1';
export const RENDERER_RETRY_COOLDOWN_MS=1500;

export function canRetryRenderer({now,lastAttemptAt=0,attempts=0}={}){
  return Number.isFinite(now)&&now>=0&&Number.isFinite(lastAttemptAt)
    &&(attempts===0||now-lastAttemptAt>=RENDERER_RETRY_COOLDOWN_MS);
}

export function rendererFailureType(message=''){
  const value=String(message).toLowerCase();
  if(/context.*lost|lost.*context|webglcontextlost|graphics interrupted/.test(value))return 'context_lost';
  if(/webgl|gpu|unsupported/.test(value))return 'webgl_unsupported_or_failed';
  if(/library|engine|script|maplibre/.test(value))return 'engine_missing_or_failed';
  if(/tile|sha-256|integrity|protocol/.test(value))return 'tile_loading_or_integrity';
  if(/boundar|geograph|source/.test(value))return 'boundary_data_unavailable';
  return 'other';
}

export function createRendererDiagnosticRecord(input={}){
  const status=String(input.status||'not_tested').slice(0,80);
  const reason=String(input.reason||'').slice(0,250);
  return {
    format:RENDERER_DIAGNOSTICS_VERSION,
    generatedAt:input.generatedAt||new Date().toISOString(),
    status,
    failureType:rendererFailureType(reason),
    reason,
    engine:{available:!!input.engineAvailable,version:String(input.engineVersion||'unknown').slice(0,40),supported:input.engineSupported??null},
    webgl2Probe:input.webgl2Probe??'not_tested',
    browser:{userAgent:input.userAgent?String(input.userAgent).slice(0,250):'not_shared'},
    map:{loaded:!!input.mapLoaded,politicalBordersLoaded:!!input.politicalBordersLoaded,physicalLandLoaded:!!input.physicalLandLoaded,
      verifiedTileCatalogueLoaded:!!input.tileCatalogueLoaded,attemptCount:Math.max(0,Math.min(999,Number(input.attemptCount)||0))},
    disclosure:'Local diagnostic only. This record is not a real-GPU rendering proof, source certification, or official political-map verification.'
  };
}
