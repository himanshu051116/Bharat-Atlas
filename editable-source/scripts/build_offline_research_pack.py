#!/usr/bin/env python3
"""Create a checksum-verified fully local *research* map package from a built preview.

Preserves explicit non-certification. With no vendored MapLibre the offline browser
uses SVG, not an invented offline WebGL engine. This packages only public staged
assets (never source, personal files, provisional unpublished geometry).
"""
import argparse,hashlib,json,zipfile
from pathlib import Path

def package(site,output):
 site,output=Path(site),Path(output)
 if output.exists():raise ValueError('Refusing to overwrite an offline package')
 manifest=json.loads((site/'build-manifest.json').read_text())
 if manifest.get('noProductionPromotion') is not True or manifest.get('officialGeometryVerified') is not False:
  raise ValueError('Research preview safety assertions missing')
 if not manifest.get('bundledPhysicalLand'):
  raise ValueError('Offline physical coverage cannot be verified')
 records=manifest.get('assets',[])
 if not records or len(records)>15000:raise ValueError('Invalid file catalogue')
 digest={r['path']:r for r in records}
 total=sum(r['bytes'] for r in records)
 if total>250_000_000:raise ValueError('Offline package exceeds 250MB research limit')
 with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for relative,item in sorted(digest.items()):
   path=Path(relative)
   if path.is_absolute() or '..' in path.parts or not (site/path).is_file() or (site/path).is_symlink():raise ValueError('Unsafe offline asset')
   data=(site/path).read_bytes()
   if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Invalid checksum for '+relative)
   z.writestr(str(path).replace('\\','/'),data)
  z.writestr('build-manifest.json',(site/'build-manifest.json').read_bytes())
  z.writestr('OFFLINE_PACK_NOTE.txt',('Bharat Atlas offline research pack\n'
    'Extract to a local folder and serve with: py -3 -m http.server 8000 --bind 127.0.0.1\n'
    'No network is necessary for the bundled historical SVG physical map.\n'
    'Real MapLibre graphics are offline only when self-hosted verified vendor assets are included.\n'
    'This does not supply modern nationwide roads, address search or certified political boundaries.\n'))
 return {'archive':str(output),'files':len(records)+2,'uncompressedBytes':total,'mapLibreAvailableOffline':manifest.get('externalMapLibreDependency') is False,'researchOnly':True}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--site',type=Path,default=Path(__file__).resolve().parents[1]/'dist');p.add_argument('--output',required=True,type=Path)
 a=p.parse_args();print(json.dumps(package(a.site,a.output),indent=2))
