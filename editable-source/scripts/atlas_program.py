#!/usr/bin/env python3
"""Single entrypoint for Bharat Atlas research build, static verification and audit.

All outputs are local. Never downloads, deploys, edits GitHub or promotes production.
"""
import argparse,hashlib,json,subprocess,sys,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def command(args):
    p=subprocess.run(args,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    return {'command':' '.join(args),'passed':p.returncode==0,'exitCode':p.returncode,'tail':p.stdout[-2500:]}

def run(test=False,output=None):
    steps=[]
    if test:
        steps.append(command(['node','--test',*sorted(str(p.relative_to(ROOT)) for p in (ROOT/'tests').glob('*.test.mjs'))]))
        steps.append(command([sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py','-q']))
    if not steps or all(x['passed'] for x in steps):
        steps.append(command([sys.executable,'scripts/build.py']))
    if steps[-1]['passed']:
        steps.append(command([sys.executable,'scripts/verify_preview.py']))
    # A failed production release guard is expected, not a test failure.
    release=command([sys.executable,'scripts/release_guard.py','--target','production']) if steps[-1]['passed'] else None
    static=(ROOT/'dist/build-manifest.json')
    manifest=json.loads(static.read_text()) if static.is_file() else {}
    source=ROOT/'data/tiles/atlas-tiles.json'
    catalog=json.loads(source.read_text()) if source.exists() else {}
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    report={
      'format':'BharatAtlasEndToEndProgramAudit1','generatedAtUtc':now,
      'project':'Bharat Atlas','sourceVersion':manifest.get('version','unknown'),
      'programStatus':'RESEARCH DEVELOPMENT ONLY','productionApproved':False,
      'automatedChecksPassed':all(s['passed'] for s in steps),
      'productionGuardRejects':release is not None and release['exitCode']!=0,
      'bundledTileCount':catalog.get('tileCount',0),'tileLayerKinds':catalog.get('layers',[]),
      'officialPoliticalGeometryVerified':False,'nationalTransportComplete':False,
      'realGpuAndPhysicalDevicesValidated':False,
      'steps':steps,'releaseGuard':release,
      'noDeploymentOrRepoMutation':True,
      'remainingHardGates':['Legal rights and Survey of India territory audit','Nationwide roads/rail/settlement datasets','Unmocked MapLibre/WebGL2 on actual desktop and phones','Load, accessibility, security, monitoring and rollback acceptance']
    }
    if output:
        out=Path(output).resolve()
        if out.is_relative_to((ROOT/'dist').resolve()):raise ValueError('Audit evidence cannot be written into verified preview')
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run-tests',action='store_true',help='Also run JS and Python tests before build')
    p.add_argument('--output',default='docs/BHARAT_PROGRAM_AUDIT_LOCAL.json')
    a=p.parse_args();result=run(test=a.run_tests,output=a.output)
    print(json.dumps({k:result[k] for k in ('programStatus','sourceVersion','automatedChecksPassed','productionGuardRejects','bundledTileCount')},indent=2))
    sys.exit(0 if result['automatedChecksPassed'] and result['productionGuardRejects'] else 1)
