#!/usr/bin/env python3
"""Compare a candidate state/UT dataset to a separately obtained authoritative geographic reference.

Both inputs must be polygon GeoJSON (WGS84) with distinct state/UT identifiers.
This script reports geometric differences, it does NOT certify official accuracy.
The reference must be actually derived from an authorised, documented source.
"""
import argparse
import hashlib
import json
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point, mapping
from shapely.validation import explain_validity
from prepare_boundaries import ALIASES, STATES, UTS, CHECKS

REQ = STATES | UTS


def _digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _normalise(path):
    g = gpd.read_file(path)
    if g.crs is None:
        raise ValueError(f'{path}: CRS unknown; do not assume WGS84')
    fields = ('name', 'NAME_1', 'ST_NM', 'st_nm', 'STATE', 'STATE_NAME', 'state_name', 'Name')
    field = next((f for f in fields if f in g.columns), None)
    if field is None:
        raise ValueError(f'{path}: missing state or UT name property; found {list(g.columns)}')
    g = g.to_crs('EPSG:4326')
    names = [ALIASES.get(str(x).strip(),str(x).strip()) for x in g[field]]
    if len(names) != len(set(names)):
        raise ValueError(f'{path}: duplicate region features; dissolve intentionally before comparing')
    bad = [names[i] for i,geom in enumerate(g.geometry) if geom is None or geom.is_empty or not geom.is_valid]
    if bad:
        raise ValueError(f'{path}: invalid or empty geometries: {bad[:5]}')
    if not all(t in ('Polygon','MultiPolygon') for t in g.geom_type):
        raise ValueError(f'{path}: nonpolygon geometries found')
    g = g.set_geometry('geometry').assign(name=names)[['name','geometry']]
    return g


def run(reference_path, candidate_path, threshold=0.995, discrepancy_output=None):
    ref = _normalise(reference_path)
    cand = _normalise(candidate_path)
    ref_names, cand_names = set(ref.name), set(cand.name)
    missing_in_reference=sorted(REQ-ref_names)
    missing_in_candidate=sorted(REQ-cand_names)
    unexpected_reference=sorted(ref_names-REQ)
    unexpected_candidate=sorted(cand_names-REQ)
    a=ref.set_index('name').to_crs('EPSG:6933')
    b=cand.set_index('name').to_crs('EPSG:6933')
    regions=[]
    diffs=[]
    for name in sorted(ref_names & cand_names):
        rg,cg=a.loc[name].geometry,b.loc[name].geometry
        common=rg.intersection(cg).area
        union=rg.union(cg).area
        jaccard=common/union if union else 0.0
        missing=rg.difference(cg)
        extra=cg.difference(rg)
        different=rg.symmetric_difference(cg)
        row={
            'name':name,
            'intersection_over_union':round(jaccard,9),
            'reference_km2':round(rg.area/1e6,2),
            'candidate_km2':round(cg.area/1e6,2),
            'missing_from_candidate_km2':round(missing.area/1e6,2),
            'extra_in_candidate_km2':round(extra.area/1e6,2),
            'symmetric_difference_km2':round(different.area/1e6,2),
            'hausdorff_distance_km':round(rg.hausdorff_distance(cg)/1000,2),
            'screen_pass':jaccard >= threshold,
        }
        regions.append(row)
        if discrepancy_output and not different.is_empty:
            diffs.append({'type':'Feature','properties':{'region':name,'kind':'geometry_disagreement'},'geometry':mapping(different)})
    points=[]
    for title,lon,lat,expected in CHECKS:
        p=Point(lon,lat)
        in_ref=[str(row['name']) for _,row in ref.iterrows() if row.geometry.covers(p)]
        in_candidate=[str(row['name']) for _,row in cand.iterrows() if row.geometry.covers(p)]
        points.append({'checkpoint':title,'reference':in_ref,'candidate':in_candidate,'expected':expected,
                       'same_assignment':in_ref==in_candidate,'expected_assignment':in_ref==[expected] and in_candidate==[expected]})
    summary={
        'reference_sha256':_digest(reference_path),'candidate_sha256':_digest(candidate_path),
        'reference_features':len(ref),'candidate_features':len(cand),
        'missing_in_reference':missing_in_reference,'missing_in_candidate':missing_in_candidate,
        'unexpected_reference':unexpected_reference,'unexpected_candidate':unexpected_candidate,
        'min_region_iou':min((r['intersection_over_union'] for r in regions),default=None),
        'discrepant_regions':sum(not r['screen_pass'] for r in regions),
        'regions':regions,'checkpoints':points,'automated_screen_pass':(
            not(missing_in_reference or missing_in_candidate or unexpected_reference or unexpected_candidate)
            and len(regions)==36 and all(x['screen_pass'] for x in regions)
            and all(x['same_assignment'] and x['expected_assignment'] for x in points)),
        'official_certification':False,
        'review_note':'Geographic similarity is only a machine check. Reference provenance, official map equivalence, administrative vintages, disputed borders and licence need human review.'
    }
    if discrepancy_output:
        # Differences are in EPSG:6933 equal-area metres; GeoJSON output reprojected to WGS84.
        from shapely.ops import transform
        from pyproj import Transformer
        proj=Transformer.from_crs('EPSG:6933','EPSG:4326',always_xy=True).transform
        for feature in diffs:
            from shapely.geometry import shape
            feature['geometry']=mapping(transform(proj,shape(feature['geometry'])))
        dest=Path(discrepancy_output);dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(json.dumps({'type':'FeatureCollection','features':diffs}),encoding='utf-8')
    return summary


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--reference',required=True,help='Authoritative polygon GeoJSON manually confirmed from the approved source')
    ap.add_argument('--candidate',required=True,help='Candidate atlas polygon GeoJSON')
    ap.add_argument('--threshold',type=float,default=0.995,help='Per-region intersection-over-union threshold for screening only (default 0.995)')
    ap.add_argument('--report',required=True)
    ap.add_argument('--discrepancies',help='Optional GeoJSON of all geometric disagreements')
    args=ap.parse_args()
    if not .0 < args.threshold <= 1.0:ap.error('--threshold must be > 0 and <= 1')
    result=run(args.reference,args.candidate,args.threshold,args.discrepancies)
    target=Path(args.report);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:result[k] for k in ['reference_features','candidate_features','missing_in_candidate','discrepant_regions','min_region_iou','automated_screen_pass','official_certification']},indent=2))
    return 0 if result['automated_screen_pass'] else 1

if __name__=='__main__':raise SystemExit(main())
