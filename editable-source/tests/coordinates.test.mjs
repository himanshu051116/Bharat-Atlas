import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAtlasCoordinates} from '../src/coordinates.mjs';
test('parses standard decimal latitude/longitude and cardinal labels',()=>{
 assert.deepEqual(parseAtlasCoordinates('23.1815, 79.9864'),{lat:23.1815,lon:79.9864,name:'23.1815°N, 79.9864°E'});
 assert.equal(parseAtlasCoordinates('23.18°N, 79.98°E').lon,79.98);
});
test('rejects invalid, out-of-view and contradictory coordinates',()=>{
 for(const text of ['hello','100,100','19,-72','28 N, -75 E','28.5 75.3','NaN, 79','59, 80','10,200'])
  assert.equal(parseAtlasCoordinates(text),null,text);
});
