// Canvas street basemap for Leaflet. OpenLayers is deliberately used without
// WebGL: ol-mapbox-style builds ol.layer.VectorTile (Canvas) layers.
// Vendored globals: OpenLayers 10.6.1 and ol-mapbox-style 13.1.1.
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const ATTRIBUTION='<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

/** Add a non-interactive Canvas basemap beneath Leaflet's markers.
 * The returned ready promise settles after the first successful vector-tile
 * rendering, or false on error/removal; it never creates an unhandled rejection.
 * All pan, zoom, selection and keyboard interaction remain with Leaflet.
 */
export function addStreetBase(leafletMap,{onReady=()=>{},onError=()=>{}}={}){
 const L=globalThis.L,ol=globalThis.ol,olms=globalThis.olms;
 if(!L||!ol?.Map||!olms?.apply){
  const error=new Error('A biblioteca da base de ruas não carregou.');onError(error);
  return {layer:null,ready:Promise.resolve(false),remove(){}};
 }
 let alive=true,ready=false,reported=false,frame=0,timer=0,resolveReady;
 const result=new Promise(resolve=>{resolveReady=resolve;}),eventKeys=[],seenLayers=new Set(),seenSources=new Set();
 const group=new ol.layer.Group();
 const layer=new (L.Layer.extend({
  onAdd(map){
   this._host=L.DomUtil.create('div','leaflet-layer leaflet-zoom-hide radar-street-base');
   this._host.setAttribute('aria-hidden','true');
   Object.assign(this._host.style,{position:'absolute',pointerEvents:'none',overflow:'hidden',background:'#f3f2ef'});
   const initialSize=map.getSize();this._host.style.width=Math.max(1,initialSize.x)+'px';this._host.style.height=Math.max(1,initialSize.y)+'px';
   map.getPane('tilePane').appendChild(this._host);
   const c=map.getCenter();
   this._view=new ol.View({center:ol.proj.fromLonLat([c.lng,c.lat]),zoom:map.getZoom(),minZoom:0,maxZoom:22});
   this._ol=new ol.Map({target:this._host,layers:[group],view:this._view,controls:[],interactions:[],pixelRatio:Math.min(globalThis.devicePixelRatio||1,2)});
   map.attributionControl?.addAttribution(ATTRIBUTION);
   map.on('move zoomend viewreset resize',this._queue,this);
   this._sync();
  },
  onRemove(map){
   alive=false;clearTimeout(timer);cancelAnimationFrame(frame);
   map.off('move zoomend viewreset resize',this._queue,this);
   for(const key of eventKeys)ol.Observable.unByKey(key);
   this._ol?.setTarget(undefined);this._ol?.dispose();this._host?.remove();
   map.attributionControl?.removeAttribution(ATTRIBUTION);
   resolveReady(false);
  },
  _queue(){if(!alive||frame)return;frame=requestAnimationFrame(()=>{frame=0;this._sync();});},
  _sync(){
   if(!alive||!this._host)return;
   const size=leafletMap.getSize(),center=leafletMap.getCenter();
   // The tile pane moves during Leaflet pans. Keep the OL viewport anchored to
   // the visible map's top-left using the documented coordinate conversion.
   L.DomUtil.setPosition(this._host,leafletMap.containerPointToLayerPoint([0,0]));
   this._host.style.width=size.x+'px';this._host.style.height=size.y+'px';
   if(size.x<1||size.y<1)return;
   this._ol.updateSize();
   this._view.setCenter(ol.proj.fromLonLat([center.lng,center.lat]));
   this._view.setZoom(leafletMap.getZoom());
  }
 }))();
 function report(error){if(!alive||ready||reported)return;reported=true;resolveReady(false);onError(error instanceof Error?error:new Error('Não foi possível carregar a base de ruas.'));}
 function rendered(){if(!alive||ready)return;ready=true;clearTimeout(timer);resolveReady(true);onReady();}
 function watchSource(source){
  if(!source||seenSources.has(source))return;seenSources.add(source);
  let failures=0;
  eventKeys.push(source.on('tileloadend',()=>{
   failures=0;if(!alive||ready)return;
   eventKeys.push(layer._ol.once('postrender',rendered));layer._ol.render();
  }));
  eventKeys.push(source.on('tileloaderror',()=>{if(++failures>=4)report(new Error('A fonte cartográfica não respondeu. A lista de unidades continua disponível.'));}));
 }
 function watchLayer(item){
  if(!item||seenLayers.has(item))return;seenLayers.add(item);
  if(item.getLayers){
   const items=item.getLayers();items.forEach(watchLayer);
   eventKeys.push(items.on('add',event=>watchLayer(event.element)));
  }else if(item.getSource){
   watchSource(item.getSource());eventKeys.push(item.on('change:source',()=>watchSource(item.getSource())));
  }
 }
 watchLayer(group);
 try{
  layer.addTo(leafletMap);
  timer=setTimeout(()=>report(new Error('A base de ruas está demorando para responder. Tente atualizar o mapa.')),25000);
  Promise.resolve(olms.apply(group,STYLE_URL)).then(()=>{
   if(!alive)return;group.getLayers().forEach(watchLayer);layer._sync();layer._ol.render();
  }).catch(report);
 }catch(error){report(error);if(leafletMap.hasLayer(layer))layer.remove();}
 return {layer,ready:result,remove(){if(leafletMap.hasLayer(layer))layer.remove();}};
}
