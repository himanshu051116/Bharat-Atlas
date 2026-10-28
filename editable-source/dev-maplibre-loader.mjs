// Developer preview loader: serve the repository root after npm install.
try {
  window.maplibregl=await import('../node_modules/maplibre-gl/dist/maplibre-gl.mjs');
} catch(error) {
  console.warn('MapLibre v6 is unavailable; the static map fallback remains accessible',error);
}
await import('./src/main.mjs');
