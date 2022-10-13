const LAT_LNG = [53.905, -3.2];
const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';
let map;
let freeDraw;
drawing = true;
editing = false;
const controlShapes = L.featureGroup();
const smooth = L.featureGroup();
const smoothPoints = L.featureGroup();
const snapGeometry = [[55.59076338488528,-6.586303710937501],[55.606281251302114,-6.476440429687501],[55.55970923563198,-6.3885498046875],[55.522411831398216,-6.39404296875],[55.51619215717891,-6.383056640625001],[55.506860802459855,-6.2347412109375],[55.519302117174405,-6.163330078125],[55.593867449197575,-6.026000976562501],[55.61869112567042,-5.9271240234375],[55.575239380091226,-5.828247070312501],[55.5099714998319,-5.811767578125],[55.32914440840507,-5.844726562500001],[55.247815044675555,-5.806274414062501],[55.247815044675555,-5.641479492187501],[55.3915921070334,-5.460205078125001],[55.41342553237582,-5.3228759765625],[55.3791104480105,-5.245971679687501],[55.32289421921913,-5.169067382812501],[55.319768755010216,-5.119628906250001],[55.32601943701404,-5.075683593750001],[55.36662484928637,-4.993286132812501],[55.39471190628709,-4.960327148437501],[55.584554519645074,-4.921875000000001],[55.658996099428364,-4.718627929687501],[55.71164005362048,-4.548339843750001],[55.76112258901995,-4.284667968750001],[55.896876336360755,-3.6968994140625004],[55.94919982336746,-3.5485839843750004],[55.97687190359469,-3.4387207031250004],[55.986091533808384,-3.3782958984375004],[56.05363501913437,-3.1475830078125004],[56.1210604250441,-2.96630859375],[56.17002298293205,-2.889404296875],[56.22197738278634,-2.5762939453125004],[56.237244700410336,-2.5488281250000004],[56.29520504055592,-2.5323486328125004],[56.33785649441104,-2.6037597656250004],[56.39566444471659,-2.6696777343750004],[56.46249048388979,-2.6422119140625],[56.56856276386726,-2.4774169921875004],[56.683391113557796,-2.3345947265625004],[56.81892067431724,-2.2137451171875004],[56.96893619436121,-2.0324707031250004],[57.073588970827934,-1.9445800781250002],[57.24339368551158,-1.9006347656250002],[57.38578314962142,-1.7578125000000002],[57.486308980380834,-1.6918945312500002],[57.58950321946176,-1.6754150390625002],[57.65127960812027,-1.7578125000000002],[57.69534131685637,-1.9335937500000002],[57.733484833831604,-2.1752929687500004],[57.73934950049299,-2.6422119140625],[57.71295101113572,-3.1915283203125004],[57.71295101113572,-3.5815429687500004],[57.65421872137725,-3.8946533203125004],[57.610107020683905,-4.026489257812501],[57.54531289147553,-4.136352539062501],[57.37097663816299,-4.361572265625001],[57.016814017391106,-4.779052734375001],[56.92999009791262,-4.899902343750001],[56.83995912075802,-5.075683593750001],[56.638105865056424,-5.350341796875001],[56.435166753146135,-5.603027343750001],[56.139428693863266,-5.921630859375001],[56.145549500679074,-6.036987304687501],[56.17002298293205,-6.075439453125001],[56.17308107207619,-6.229248046875001],[56.105746831832064,-6.328125000000001],[55.92766341247032,-6.498413085937501],[55.819801652442436,-6.553344726562501],[55.59076338488528,-6.586303710937501]];
const existingPolygon = L.polygon(snapGeometry,
	{color: '#FFE923', weight: 2, fillOpacity: 0.5, fillColor: '#FFE923'});
let snapTo = false;
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
	mergePolygons(latLngs);
	// console.log('draw', rawPolys);
	createControlShape();

}
createControlShape = function (){
	const polygon = L.polygon(rawPolys, {opacity: 0.8, weight:1, dashArray:4, fill:false});
	controlShapes.clearLayers();
	controlShapes.addLayer(polygon);

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
			// console.log('merging', 'existing:', (L.polygon(existingLatLngs).toGeoJSON()).geometry.coordinates, 'new', polygon.geometry.coordinates, turf.union(polygon, L.polygon(existingLatLngs).toGeoJSON()))

			polygon = turf.union(polygon, L.polygon(existingLatLngs).toGeoJSON());
		} catch (e) {
			console.log(e); // ¯\_(ツ)_/¯ ignore errors there shouldn't be any
		}
		return polygon.geometry.coordinates;
	});
	if (snapTo){
		polygon = snapPolygons(polygon);
	}
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
	// console.log('edit', rawPolys);
	mergePolygons(rawPolys);
	createControlShape();
}
snapPolygons = function (polygon) {
	// console.log(polygon, existingPolygon.toGeoJSON(), turf.difference(polygon, existingPolygon.toGeoJSON()))
	// at this point polygon is GeoJSON of either a polygon or multipolygon of all the shapes merged/combined/etc
	// so we need to perform any snapping, & then flip & format it before adding to history + map
	polygon = turf.difference(polygon, existingPolygon.toGeoJSON());
	try {
		// find & remove kinks/selfIntersections after snapping
		const kinks = turf.kinks(polygon);
		if (kinks.features.length > 0) {
			polygon = turf.buffer(polygon, 0, {units:'meters'});
		}
		return polygon;
	} catch (e) {
		// ¯\_(ツ)_/¯ can't snap an empty polygon
		return [];
	}
}

formListeners = function () {
	const toggleDrawing = function (on) {
		drawing = (typeof on === 'undefined')? !drawing : on;
		if (!drawing) {
			freeDraw.mode(FreeDraw.NONE);
			$('#Draw').html('Drawing is off').removeClass('on');
		} else {
			freeDraw.mode(FreeDraw.ALL);
			$('#Draw').html('Drawing is on').addClass('on');
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
				$('#Edit').html('Editing is on').addClass('on');
			} else {
				layer.disableEdit();
				$('#Edit').html('Editing is off').removeClass('on');
			}
		});
	}
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
	if($('#shape').is(':checked')){
		existingPolygon.addTo(map);
		snapTo = true;
	}
	$('#shape').change(function () {
		if ($(this).is(':checked')) {
			existingPolygon.addTo(map);
			snapTo = true;
			mergePolygons(rawPolys);
			createControlShape();
		} else {
			existingPolygon.remove();
			snapTo = false;
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

	$(document).keypress(function (e) {
		if (e.keyCode === 32){
			toggleDrawing(!drawing);
			if (editing){
				toggleEditMode(false);
			}
		}
	})
	$('#Edit').click(function(){
		if (drawing){
			toggleDrawing(false);
		}
		toggleEditMode(!editing);
	});

}
