// MapLibre GL JS 6 uses ES modules. Load it before the existing application.
try {
  window.maplibregl = await import('./vendor/maplibre-gl.mjs');
} catch (error) {
  console.warn('Bharat Atlas: interactive map engine unavailable; starting the static fallback', error);
}
// Run the app even if WebGL or the engine cannot initialize, so the directory and
// physical reference remain usable. The map-specific code handles this gracefully.
await import('./app.bundle.js');
