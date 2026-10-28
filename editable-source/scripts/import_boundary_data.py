#!/usr/bin/env python3
"""Offline, untrusted GIS candidate importer; NOT a Survey of India verifier.

Reads Shapefile, GeoPackage or GeoJSON, reconciles 36 top-level region names,
reprojects explicitly identified source CRS to EPSG:4326, screens topology,
and writes a versioned *candidate* snapshot and review report.

No network, deployment, automatic authority claims, or silent geometry repairs.
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'legacy' / 'scripts'))
from validate_geojson import STATES, UTS, name as legacy_name
sys.path.insert(0, str(HERE))
from geometry_audit import audit

EXPECTED = STATES | UTS
ALIASES = {
    'Orissa': 'Odisha', 'Uttaranchal': 'Uttarakhand',
    'Andaman and Nicobar': 'Andaman and Nicobar Islands',
    'NCT of Delhi': 'Delhi', 'Jammu & Kashmir': 'Jammu and Kashmir',
    'Pondicherry': 'Puducherry'
}


def import_dataset(source, output_dir, *, name_field, source_url, licence, attribution, require_complete=True):
    source, output_dir = Path(source), Path(output_dir)
    if not source.is_file():
        raise ValueError('Source must be a local GIS file')
    if source.stat().st_size > 250_000_000:
        raise ValueError('GIS input exceeds the 250 MB import limit')
    if not name_field or not name_field.isidentifier():
        raise ValueError('Supply a valid administrative-name column')
    if not source_url.startswith('https://') or not licence.strip() or not attribution.strip():
        raise ValueError('HTTPS source link, licence and attribution are mandatory')
    if output_dir.exists():
        raise FileExistsError('Output folder exists: refusing to overwrite prior evidence')
    if not output_dir.parent.exists():
        raise ValueError('Create the output parent directory explicitly')

    try:
        dataframe = gpd.read_file(source)
    except Exception as exc:
        raise ValueError(f'Cannot read GIS source: {exc}') from exc
    if name_field not in dataframe.columns:
        raise ValueError(f'Missing administrative-name field {name_field!r}')
    if dataframe.crs is None:
        raise ValueError('Source CRS undefined: supply a dataset with declared CRS; no guessing')
    if dataframe.empty or len(dataframe) > 5000:
        raise ValueError('Expected 1–5000 administrative rows')
    if dataframe.geometry.isna().any() or dataframe.geometry.is_empty.any():
        raise ValueError('Dataset contains missing or empty geometries')
    if not all(g.geom_type in ('Polygon', 'MultiPolygon') for g in dataframe.geometry):
        raise ValueError('Expected polygonal state/UT geography')
    if not all(g.is_valid for g in dataframe.geometry):
        raise ValueError('Invalid input topology; review in QGIS before importing (no automatic repairs)')
    original_crs = str(dataframe.crs)
    dataframe = dataframe.to_crs('EPSG:4326')
    names = [ALIASES.get(str(v).strip(), str(v).strip()) for v in dataframe[name_field]]
    if any(n not in EXPECTED for n in names):
        raise ValueError('Unrecognized state/UT identities: ' + ', '.join(sorted(set(names) - EXPECTED)))
    if len(set(names)) != len(names):
        raise ValueError('Duplicate administrative names: dissolve explicitly and recheck source')
    if require_complete and set(names) != EXPECTED:
        raise ValueError('Missing top-level regions: ' + ', '.join(sorted(EXPECTED - set(names))))
    # Safe geographic envelope; not a legal/political boundaries test.
    minx, miny, maxx, maxy = dataframe.total_bounds
    if not (60 <= minx < maxx <= 102 and 3 <= miny < maxy <= 41):
        raise ValueError('Coordinates outside the supported India geographic envelope')

    features = []
    for region, geom in zip(names, dataframe.geometry):
        features.append({'type': 'Feature', 'properties': {'name': region}, 'geometry': mapping(geom)})
    candidate = {'type': 'FeatureCollection', 'features': features}
    canonical_bytes = (json.dumps(candidate, ensure_ascii=False, sort_keys=True,
                                  separators=(',', ':')) + '\n').encode('utf-8')
    if len(canonical_bytes) > 80_000_000:
        raise ValueError('Candidate GeoJSON is too large for this import pipeline')

    with tempfile.TemporaryDirectory(prefix='.atlas-candidate-', dir=output_dir.parent) as tmp:
        tmp = Path(tmp)
        (tmp / 'candidate.geojson').write_bytes(canonical_bytes)
        report = audit(tmp / 'candidate.geojson', require_complete=require_complete)
        if report['invalidGeometry'] or report['overlapsKm2'] or report['duplicateRegions'] or report['unexpectedRegions']:
            raise ValueError('Candidate failed topological audit: ' +
                             json.dumps({k: report[k] for k in ('invalidGeometry','overlapsKm2','duplicateRegions','unexpectedRegions')}))
        # Sample-point failure is reported, NOT patched or disguised as official compliance.
        report.update({
            'candidateSha256': hashlib.sha256(canonical_bytes).hexdigest(),
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'sourceType': source.suffix.lower(), 'originalCrs': original_crs,
            'normalizedCrs': 'EPSG:4326', 'nameField': name_field,
            'sourceUrl': source_url, 'licence': licence, 'attribution': attribution,
            'officiallyVerified': False,
            'approvalRequired': 'Licensed official reference vector and manual GIS comparison; sample checks are insufficient',
            'status': 'RESEARCH CANDIDATE — NOT FOR PRODUCTION'
        })
        # Keep manifest independent of temporary paths.
        report.pop('sourceFile', None)
        (tmp / 'review-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
        # os.rename is atomic on the same filesystem. A previous candidate is never replaced.
        os.rename(tmp, output_dir)
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input', type=Path)
    p.add_argument('--output-dir', type=Path, required=True)
    p.add_argument('--name-field', required=True)
    p.add_argument('--source-url', required=True)
    p.add_argument('--licence', required=True)
    p.add_argument('--attribution', required=True)
    p.add_argument('--allow-partial', action='store_true', help='For unit-testing or incomplete research only')
    args = p.parse_args()
    try:
        result = import_dataset(args.input, args.output_dir, name_field=args.name_field,
                                source_url=args.source_url, licence=args.licence,
                                attribution=args.attribution, require_complete=not args.allow_partial)
        print(json.dumps({'output': str(args.output_dir), 'regions': result['regions'],
                          'geographicSamplePass': all(p['matches'] for p in result['sampleLocations']),
                          'officiallyVerified': False}, indent=2))
    except Exception as e:
        raise SystemExit(f'Import rejected: {e}')
