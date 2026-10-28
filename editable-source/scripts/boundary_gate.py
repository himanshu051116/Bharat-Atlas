#!/usr/bin/env python3
"""Refuse unsafe bundled boundary geometry; report unresolved claim discrepancies.

The check is intentionally *not* official geographic certification. It verifies
administrative identity, finite WGS84 coordinates, GEOS topology, and overlaps,
and records geographic sample failures for human review. It does not silently
repair inputs or promote them to authoritative status.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path


def screen_file(path, *, overlap_tolerance_km2=1.0):
    from geometry_audit import audit
    from import_boundary_data import EXPECTED, ALIASES
    from shapely.geometry import shape

    path = Path(path)
    raw_bytes = path.read_bytes()
    if len(raw_bytes) > 16_000_000:
        raise ValueError('Bundled boundaries exceed 16 MB geographic safety limit')
    source = json.loads(raw_bytes)
    if not isinstance(source, dict):
        raise ValueError('Bundled data must be a GeoJSON FeatureCollection object')
    feats = source.get('features', [])
    if source.get('type') != 'FeatureCollection' or not isinstance(feats, list) or len(feats) != 36:
        raise ValueError('Bundled atlas must contain exactly 36 region polygons')
    names = []
    total_vertices = 0
    for feature in feats:
        if not isinstance(feature, dict) or feature.get('type') != 'Feature':
            raise ValueError('Expected valid GeoJSON Features')
        props = feature.get('properties') or {}
        candidate = (props.get('name') or props.get('NAME_1') or props.get('st_nm') or props.get('STNAME') or props.get('STATE'))
        name = ALIASES.get(candidate, candidate)
        if not isinstance(name, str) or name not in EXPECTED:
            raise ValueError(f'Unknown administrative feature: {str(candidate)[:100]}')
        names.append(name)
        geometry = feature.get('geometry')
        if not isinstance(geometry, dict) or geometry.get('type') not in ('Polygon', 'MultiPolygon'):
            raise ValueError(f'{name}: polygon geometry required')
        poly = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for part in poly:
            if not isinstance(part, list) or not part:
                raise ValueError(f'{name}: empty polygon')
            for ring in part:
                if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
                    raise ValueError(f'{name}: polygon ring must be closed')
                total_vertices += len(ring)
                if total_vertices > 450000:
                    raise ValueError('Boundary complexity exceeds maximum vertex count')
                for point in ring:
                    if (not isinstance(point, list) or len(point) < 2 or
                            any(type(x) not in (float, int) or not math.isfinite(x) for x in point[:2]) or
                            not (60 <= point[0] <= 102 and 3 <= point[1] <= 41)):
                        raise ValueError(f'{name}: coordinates must be finite WGS84 lon/lat inside India envelope')
        if shape(geometry).is_empty:
            raise ValueError(f'{name}: empty geometry')
    if set(names) != EXPECTED or len(set(names)) != 36:
        raise ValueError('Missing or duplicated administrative identities')
    report = audit(path, require_complete=True, overlap_threshold_km2=overlap_tolerance_km2)
    blockers = {k: report[k] for k in ('missingRegions', 'unexpectedRegions', 'duplicateRegions', 'invalidGeometry', 'overlapsKm2') if report[k]}
    if blockers:
        raise ValueError('Unsafe geographic dataset: ' + json.dumps(blockers, ensure_ascii=False)[:1200])
    return {
        'schema': 'BharatAtlasBoundaryScreen1',
        'sha256': hashlib.sha256(raw_bytes).hexdigest(),
        'regionCount': len(feats),
        'vertexCount': total_vertices,
        'invalidGeometryCount': 0,
        'overlapCountOverTolerance': 0,
        'sampleLocations': report['sampleLocations'],
        'failedSamples': [p['sample'] for p in report['sampleLocations'] if not p['matches']],
        'topologyScreenPassed': True,
        'officialGeometryVerified': False,
        'note': 'Topology and four geographic sample points cannot establish agreement with Survey of India. Missing disputed areas remain possible.'
    }


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('file', type=Path)
    p.add_argument('--output', type=Path)
    args=p.parse_args()
    summary=screen_file(args.file)
    if args.output:
        args.output.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(summary, indent=2, ensure_ascii=False))
