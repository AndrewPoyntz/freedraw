const LAT_LNG = [53.905, -3.2];
const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';
let map;
let freeDraw;
drawing = true;
editing = false;
const controlShapes = L.featureGroup();
const smooth = L.featureGroup();
const currentPoints = L.featureGroup();
const smoothPoints = L.featureGroup();
let rawPolys = [];
let rTree;
let affectedRegionIDs = []

function getRegions() {
	return fetch('UK_Child_Regions.geojson')
		.then(function(response) {
			return response.json();
		});
}
const regionStyle = function (feature) {
	const styleOptions = {
		color: '#000',
		weight: 0.5,
		opacity: 1,
		fill: false,
		clickable: false,
		fillColor: 'orange',
		fillOpacity: 0.4
	};
	if (affectedRegionIDs.indexOf(feature.properties.GSSCode) !== -1) {
		styleOptions.fill = true;
	}
	return styleOptions;
}
$(document).ready(async function() {
	rTree = RTree(20);
	map = new L.Map(document.querySelector('section.map'), { doubleClickZoom: false, editable:true }).setView(LAT_LNG, 6);
	const regionData = await getRegions();
	rTree.geoJSON(regionData)
	regions = L.geoJSON(regionData, {
		style: regionStyle
	}).addTo(map);
	L.tileLayer(TILE_URL).addTo(map);
	formListeners();
	addFreedraw();
	freeDraw.on('markers', freedrawEvent);
	L.Editable.VertexIcon = L.DivIcon.extend({
		options: {
			iconSize: new L.Point(12, 12)
		}
	});
	L.Editable.TouchVertexIcon = L.Editable.VertexIcon.extend({
		options: {
			iconSize: new L.Point(12, 12)
		}
	});
	const editEvents = ['editable:vertex:dragend', 'editable:vertex:deleted'];
	editEvents.map(eventString => {
		map.on(eventString, () => {
			handleShapeEdits();
		});
	});
	smooth.addTo(map);

})
addFreedraw = function () {
	freeDraw = new FreeDraw({ mode: FreeDraw.ALL});
	map.addLayer(freeDraw);
}
freedrawEvent = function(event) {
	if (event.eventType === 'create'){
		drawPolygons(event.latLngs);
		freeDraw.clear();
	}
}
drawPolygons = function (latLngs) {
	// console.log('create poly with', latLngs)
	mergePolygons(latLngs);
	console.log('draw', rawPolys);
	createControlShape();

}
createControlShape = function (){
	const polygon = L.polygon(rawPolys, {opacity: 0.8, weight:1, dashArray:4, fill:false});
	controlShapes.clearLayers();
	controlShapes.addLayer(polygon);
	// for (let i = 0; i < latLngs[0].length; i++) {
	// 	currentPoints.addLayer(L.circleMarker(latLngs[0][i], {radius: 2}));
	// }
	controlShapes.eachLayer((layer) => {
		if (editing) {
			layer.enableEdit();
		} else {
			layer.disableEdit();
		}
	});
	drawSmoothedPolygon();
}
mergePolygons = function (latLngs) {
	let polygon = L.polygon(latLngs).toGeoJSON(); // take the points & convert into geojson (flips the points the wrong way round for leaflet)
	// find & remove kinks/selfIntersections
	const kinks = turf.kinks(polygon);
	if (kinks.features.length > 0) {
		polygon = turf.buffer(polygon, 0, {units:'meters'});
	}
	rawPolys.map(existingLatLngs => { // loop through the polygons
		try {
			// for each one, try a turf.union with the new shape
			// each iteration of the loop overwrites 'polygon' with the result, resulting in a cumulative merge
			console.log('merging', 'existing:', (L.polygon(existingLatLngs).toGeoJSON()).geometry.coordinates, 'new', polygon.geometry.coordinates, turf.union(polygon, L.polygon(existingLatLngs).toGeoJSON()))

			polygon = turf.union(polygon, L.polygon(existingLatLngs).toGeoJSON());
		} catch (e) {
			console.log(e); // ¯\_(ツ)_/¯ ignore errors there shouldn't be any
		}
		return polygon.geometry.coordinates;
	});
	// polygon = this.snapPolygons(polygon);
	rawPolys = turf.flip(polygon).geometry.coordinates;
}
drawSmoothedPolygon = function () {
	smooth.clearLayers();
	smoothPoints.clearLayers();
	controlShapes.eachLayer((layer) => {
		const latlngs = layer.getLatLngs(); // grab it's lat longs
		let poly = L.polygon(latlngs).toGeoJSON();
		const smoothedLatLngs = (turf.flip(turf.polygonSmooth(poly, {iterations: 3}))).features[0].geometry.coordinates;
		// console.log(smoothedLatLngs);
		smooth.addLayer(L.polygon(smoothedLatLngs, {color: '#000', weight: 0.9, fillOpacity: 0.5, fillColor: '#FF9900'}));
		const allSmoothedPoints = (smoothedLatLngs.length > 1)? smoothedLatLngs.flat(2) : smoothedLatLngs.flat(1);
		for (let i = 0; i < allSmoothedPoints.length; i++) {
			smoothPoints.addLayer(L.circleMarker(allSmoothedPoints[i], {radius: 1, color: 'black'}));
		}
	});
	highlightRegions();
}
highlightRegions = function (){
	affectedRegionIDs = [];
	smooth.eachLayer((layer) => {
		const latlngs = layer.getLatLngs(); // grab it's lat longs
		const polygon = L.polygon(latlngs); // make them into a polygon
		const drawnPolyGeo = polygon.toGeoJSON(); // push geojson version into an array for later
		const polyBounds = polygon.getBounds(); // get the bounds for rtree
		// find regions which cross or are in the regions bounding box via rTree & for each one stick them in an array for later
		const affectedRegions = rTree.bbox([[polyBounds.getSouthWest().lng, polyBounds.getSouthWest().lat], [polyBounds.getNorthEast().lng, polyBounds.getNorthEast().lat]]);
		// loop the regions found by rTree
		for (let j = 0; j < affectedRegions.length; j++) {
			const affectedRegion = affectedRegions[j];
			// if we've not already detected an intersection with this region....
			if (affectedRegionIDs.indexOf(affectedRegion.properties.GSSCode) === -1) {
				// check for intersections with this region
				if (turf.intersect(affectedRegion, drawnPolyGeo) !== null) {
					// if we find one, push the region into the relevant arrays
					affectedRegionIDs.push(affectedRegion.properties.GSSCode);
				}
			}
		}
	});
	regions.setStyle(regionStyle);
	// this.checkGeometryForErrors();
}
handleShapeEdits = function (){
	let polygon;
	// for edits the polygons are changed directly so it's best to pull the lat longs directly from the map
	// loop through the feature group layers (i.e. each polygon)
	controlShapes.eachLayer((layer) => {
		const latlngs = layer.getLatLngs(); // grab it's lat longs
		let poly = L.polygon(latlngs).toGeoJSON();
		// find & remove any kinks/self intersections
		const kinks = turf.kinks(poly);
		if (kinks.features.length > 0) {
			poly = turf.buffer(poly, 0, {units:'meters'});
		}
		if (polygon) { // if var 'polygon' isn't undefined...
			try { // do a turf union with it + the polygon we're on in the loop, (cumulative merge like with drawing)
				polygon = turf.union(polygon, poly);
			} catch (e) {
				console.log(e); // ¯\_(ツ)_/¯
			}
		} else {// otherwise, it's the first iteration of the loop, so use the polygon as is
			polygon = poly;
		}
	});
	rawPolys = turf.flip(polygon).geometry.coordinates;
	console.log('edit', rawPolys);
	mergePolygons(rawPolys);
	createControlShape();
}

formListeners = function () {
	const toggleDrawing = function (on) {
		drawing = (typeof on === 'undefined')? !drawing : on;
		if (!drawing) {
			freeDraw.mode(FreeDraw.NONE);
			$('#Draw').html('Drawing is off');
		} else {
			freeDraw.mode(FreeDraw.ALL);
			$('#Draw').html('Drawing is on');
		}
	}
	const toggleEditMode = function (on){
		editing = (typeof on === 'undefined')? !editing : on;
		if (editing) {
			controlShapes.addTo(map);
		} else {
			controlShapes.remove()

		}
		controlShapes.eachLayer((layer) => {
			if (editing) {
				layer.enableEdit();
				$('#Edit').html('Editing is on');
			} else {
				layer.disableEdit();
				$('#Edit').html('Editing is off');
			}
		});
	}
	$(document).keypress(function (e) {
		if (e.keyCode === 32){
			toggleDrawing();
		}
	})
	if($('#points').is(':checked')){
		smoothPoints.addTo(map);
	}
	$('#points').change(function () {
		if ($(this).is(':checked')) {
			smoothPoints.addTo(map);
		} else {
			smoothPoints.remove();
		}
	});
	$('#clear').click(function() {
		controlShapes.clearLayers();
		smooth.clearLayers();
		smoothPoints.clearLayers();
		rawPolys = [];
		highlightRegions();
	});
	$('#Draw').click(function(){
		if (editing){
			toggleEditMode(false);
		}
		toggleDrawing(!drawing);
	});
	$('#Edit').click(function(){
		if (drawing){
			toggleDrawing(false);
		}
		toggleEditMode(!editing);
	});

}
